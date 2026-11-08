// The wake: what a moving cursor or finger leaves on the liquid, like a boat. Real water makes a V behind a boat at any
// speed because it is dispersive; the wave grid (sim.ts) is not, and a source in it slower than its waves can only
// make rings from the points it passed (v2: "a few different ripples out emanating from just the dots"). So the wake
// is its own model, a Kelvin-like pattern built from the pointer's recent path:
//
// - the path is kept as samples a few px apart (position, direction, the speed and strength it had, when);
// - each sample carries a cross-section of the wake as it is `age` seconds after the pointer passed: two arms, each a
//   short ripple train, that leave the path sideways at a fixed fraction of the pointer's speed (so the arms of a
//   straight stroke are two straight lines in a V of ~19 degrees, like a boat's, at every speed), broadening as they go
//   (the train lengthens, as dispersion spreads it) and fading; plus faint transverse ridges between the arms at medium
//   speeds (their wavelength grows with the square of the speed, as in a ship's wake);
// - along the path, each sample is spread by a normalised Gaussian weighted by the length of path it stands for, so the
//   sum over samples is one continuous surface along any path, straight or curved, at any sample spacing (no beads).
//
// The wake is evaluated into the very height grid the shader draws and floaters sample (sim.ts adds it after each
// step), so what you see and what rocks things are the same numbers. Samples live in page px (a mouse: its path through
// the page's liquid, including a resting cursor the page scrolls past) or in viewport px (a finger: its trail on the
// glass, see input.ts), converted at the current scroll when evaluated.

/** Tunables (the look lab overrides them). spread: the arms' sideways speed per px/s of the pointer (tan of the V's
 *  half-angle; a ship's Kelvin wake: 0.354), between cMin and cMax px/s. len: the arms' ripple wavelength (px). w0 / wGrow:
 *  an arm's half-width (Gaussian sigma, px) at the pointer, its growth per px it has spread, and at most
 *  (a train of two or three ridges). life: amplitude
 *  e-folding (s); max: when a sample is dropped (s). trans / tg / tWin: the transverse ridges' strength (relative), their
 *  "gravity" (wavelength = 2 pi v^2 / tg px) and the wavelengths over which they fade in and out (px). */
export const WAKE = { spread: 0.33, cMin: 14, cMax: 300, len: 46, w0: 8, wGrow: 0.13, wMax: 34, life: 1.6, max: 3.2, trans: 0.32, tg: 9000, tWin: [44, 70, 220, 420] as number[] };

const TAU = Math.PI * 2;
const MAX_SAMPLES = 900;

type Stroke = { phi: number; dx: number; dy: number; lx: number; ly: number; rem: number; fr: 0 | 1; v: number; a: number; on: boolean; vs: number };
type Sample = { x: number; y: number; dx: number; dy: number; t0: number; v: number; a: number; l: number; sg: number; phi: number; kt: number; st: Stroke; fr: 0 | 1 };

/** The spacing (px of path) between samples at speed v, and the along-path spread (sigma, px) of one. */
const gap = (v: number) => Math.min(28, Math.max(10, v * 0.03));
const sigmaFor = (g: number) => 0.75 * g;

// exp(-x) for x in [0, 13] and cos, tabulated (linear interpolation; the wake's inner loop is all exp and cos)
const EN = 2048;
const EMAX = 13;
const EXP = new Float32Array(EN + 2);
for (let i = 0; i <= EN + 1; i++) EXP[i] = Math.exp((-i * EMAX) / EN);
const ex_ = (x: number) => {
  if (x >= EMAX) return 0;
  const f = (x * EN) / EMAX;
  const i = f | 0;
  return EXP[i] + (EXP[i + 1] - EXP[i]) * (f - i);
};
const CN = 2048;
const COS = new Float32Array(CN + 2);
for (let i = 0; i <= CN + 1; i++) COS[i] = Math.cos((i * 2 * Math.PI) / CN);
const cos_ = (x: number) => {
  let f = (x * CN) / (2 * Math.PI);
  f -= Math.floor(f / CN) * CN;
  const i = f | 0;
  return COS[i] + (COS[i + 1] - COS[i]) * (f - i);
};

export function createWake() {
  const S: Sample[] = [];
  const tips: Sample[] = [];
  let last = -9; // clock time of the last sample

  const kt = (v: number) => TAU / Math.max(1, (TAU * v * v) / WAKE.tg);

  /** A new stroke (a pointer starting to move; a jump starts another). fr: 0 = page px, 1 = viewport px. */
  function stroke(fr: 0 | 1): Stroke {
    return { phi: 0, dx: 1, dy: 0, lx: NaN, ly: NaN, rem: 0, fr, v: 0, a: 0, on: false, vs: 0 };
  }

  /**
   * The pointer went along `path` ([x, y, ...] in its stroke's frame, starting where it was last frame) between clock
   * times t0 and t1, at speed v (px/s, smoothed) with strength a (px of height). Emits samples along it.
   */
  function move(st: Stroke, path: number[], t0: number, t1: number, v: number, a: number) {
    if (Number.isNaN(st.lx)) {
      st.lx = path[0];
      st.ly = path[1];
      st.rem = 0;
      st.vs = v;
    }
    // the speed that sets the V's spread and the ridges' wavelength follows the pointer slowly (0.2 s): uneven events
    // (a finger's touchmoves come in bursts) would otherwise make the arms wobble
    st.vs += (v - st.vs) * (1 - Math.exp(-Math.max(0, t1 - t0) / 0.2));
    v = st.vs;
    st.v = v;
    st.a = a;
    let L = 0;
    for (let i = 2; i < path.length; i += 2) L += Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
    if (L <= 0) return;
    const g = gap(v);
    const k = kt(v);
    let s = 0;
    for (let i = 2; i < path.length; i += 2) {
      const ax = path[i - 2];
      const ay = path[i - 1];
      const sx = path[i] - ax;
      const sy = path[i + 1] - ay;
      const l = Math.hypot(sx, sy);
      if (l < 1e-6) continue;
      // direction: eased along the path (a few px of memory), so a jittery pointer still has a clean heading
      const e = 1 - Math.exp(-l / 16);
      st.dx += (sx / l - st.dx) * e;
      st.dy += (sy / l - st.dy) * e;
      const n = Math.hypot(st.dx, st.dy) || 1;
      st.dx /= n;
      st.dy /= n;
      let u = 0;
      while (st.rem + (l - u) >= g) {
        const take = g - st.rem;
        u += take;
        st.phi += k * take;
        const x = ax + (sx * u) / l;
        const y = ay + (sy * u) / l;
        const tt = t0 + ((t1 - t0) * (s + u)) / L;
        if (a > 0) S.push({ x, y, dx: st.dx, dy: st.dy, t0: tt, v, a, l: g, sg: sigmaFor(g), phi: st.phi, kt: k, st, fr: st.fr });
        st.rem = 0;
      }
      st.phi += k * (l - u);
      st.rem += l - u;
      s += l;
    }
    st.lx = path[path.length - 2];
    st.ly = path[path.length - 1];
    st.on = true;
    last = t1;
    if (S.length > MAX_SAMPLES) S.splice(0, S.length - MAX_SAMPLES);
  }

  /** The stroke ends (pointer left, finger lifted, a jump): the next move starts a fresh one. */
  function end(st: Stroke) {
    st.on = false;
    st.lx = NaN;
    st.rem = 0;
  }

  /** Is there anything to draw at time t? */
  const active = (t: number) => S.length > 0 && t - last < WAKE.max + 0.1;

  // cos/exp are the cost here: a few tens of thousands per frame at most (only the cells near each sample's arms)
  /**
   * Add the wake at time t into a height grid (`out`, cols x rows, cell centres at x0 + (i + 0.5) cell, y0 + (j + 0.5)
   * cell, page px), page scrolled to (sx, sy). `heads` are the live pointer tips this frame (a sample at each pointer
   * standing for the path since its last sample), so the wake always reaches the pointer. Returns whether it wrote.
   */
  function addTo(out: Float32Array, cols: number, rows: number, x0: number, y0: number, cell: number, t: number, sx: number, sy: number, heads: Stroke[]) {
    const tStart = typeof performance === 'undefined' ? 0 : performance.now();
    while (S.length && t - S[0].t0 > WAKE.max) S.shift();
    if (S.length > budget) merge(t);
    tips.length = 0;
    for (const st of heads) {
      if (!st.on || st.rem <= 0 || st.a <= 0) continue;
      const g = gap(st.v);
      tips.push({ x: st.lx, y: st.ly, dx: st.dx, dy: st.dy, t0: t, v: st.v, a: st.a, l: st.rem, sg: sigmaFor(g), phi: st.phi, kt: kt(st.v), st, fr: st.fr });
    }
    if (!S.length && !tips.length) return false;
    const kappa = TAU / WAKE.len;
    const [t0w, t1w, t2w, t3w] = WAKE.tWin;
    const inv = 1 / cell;
    let wrote = false;
    const one = (s: Sample) => {
      const age = Math.max(0, t - s.t0);
      const c = Math.min(WAKE.cMax, Math.max(WAKE.cMin, WAKE.spread * s.v));
      const R = c * age;
      const W = Math.min(WAKE.wMax, WAKE.w0 + WAKE.wGrow * R);
      const q = age / WAKE.max;
      const fade = 1 - q * q;
      const A = ((s.a * s.l) / (Math.sqrt(TAU) * s.sg)) * Math.exp(-age / WAKE.life) * (WAKE.w0 / W) ** 0.3 * fade * fade;
      if (A < 0.01) return;
      // transverse ridges: only where their wavelength is one the grid shows well, and not too long to read as ridges
      const lt = TAU / s.kt;
      const tw = lt < t0w || lt > t3w ? 0 : Math.min(1, (lt - t0w) / (t1w - t0w), (t3w - lt) / (t3w - t2w));
      const T = WAKE.trans * tw * Math.min(1, age / 0.08);
      const Rt = Math.max(W, 0.75 * R);
      const PH = s.st.phi; // the stroke's phase at its head (crests keep their distance behind the pointer)
      const px = s.x + (s.fr ? sx : 0);
      const py = s.y + (s.fr ? sy : 0);
      const ha = 2.8 * s.sg;
      const ia = 1 / (2 * s.sg * s.sg);
      const iw = 1 / (2 * W * W);
      const it = 1 / (2 * Rt * Rt);
      const ex = s.dx;
      const ey = s.dy;
      const dph = PH - s.phi;
      const k1 = s.kt;
      // cells to visit: the whole cross-section while the arms are close or ridges fill the middle, else each arm's band
      const reach = 2.8 * W;
      const trans = T > 0.01;
      const spans: [number, number][] = trans || R < reach ? [[-(R + reach), R + reach]] : [[R - reach, R + reach], [-R - reach, -R + reach]];
      const ry0 = y0 + 0.5 * cell - py;
      const rx0 = x0 + 0.5 * cell - px;
      for (const [d0, d1] of spans) {
        // rows the rotated box covers, then on each row the exact run of cells inside it (|a| <= ha, d0 <= d <= d1)
        const ys = [ey * -ha + ex * d0, ey * -ha + ex * d1, ey * ha + ex * d0, ey * ha + ex * d1];
        const j0 = Math.max(1, Math.ceil((Math.min(ys[0], ys[1], ys[2], ys[3]) - ry0) * inv));
        const j1 = Math.min(rows - 2, Math.floor((Math.max(ys[0], ys[1], ys[2], ys[3]) - ry0) * inv));
        for (let j = j0; j <= j1; j++) {
          const ry = ry0 + j * cell;
          // a = rx ex + ry ey in [-ha, ha]; d = ry ex - rx ey in [d0, d1]: each bounds rx to an interval
          let lo = -Infinity;
          let hi = Infinity;
          if (Math.abs(ex) > 1e-6) {
            const p1 = (-ha - ry * ey) / ex;
            const p2 = (ha - ry * ey) / ex;
            lo = Math.max(lo, Math.min(p1, p2));
            hi = Math.min(hi, Math.max(p1, p2));
          } else if (Math.abs(ry * ey) > ha) continue;
          if (Math.abs(ey) > 1e-6) {
            const q1 = (ry * ex - d0) / ey;
            const q2 = (ry * ex - d1) / ey;
            lo = Math.max(lo, Math.min(q1, q2));
            hi = Math.min(hi, Math.max(q1, q2));
          } else if (ry * ex < d0 || ry * ex > d1) continue;
          const i0 = Math.max(1, Math.ceil((lo - rx0) * inv));
          const i1 = Math.min(cols - 2, Math.floor((hi - rx0) * inv));
          let k = j * cols + i0;
          for (let i = i0; i <= i1; i++, k++) {
            const rx = rx0 + i * cell;
            const a = rx * ex + ry * ey;
            const d = ry * ex - rx * ey;
            const u1 = d - R;
            const u2 = d + R;
            let v = ex_(u1 * u1 * iw) * cos_(kappa * u1) + ex_(u2 * u2 * iw) * cos_(kappa * u2);
            if (trans) v += T * ex_(d * d * it) * cos_(dph - k1 * a);
            out[k] += A * ex_(a * a * ia) * v;
          }
        }
      }
      wrote = true;
    };
    for (const s of S) one(s);
    for (const s of tips) one(s);
    // the budget follows the cost: a slow device keeps fewer, longer samples in the older part of the wake
    if (tStart) {
      cost += (performance.now() - tStart - cost) * 0.1;
      budget = Math.min(900, Math.max(60, budget * (cost > 4 ? 0.9 : cost < 2 ? 1.03 : 1)));
    }
    return wrote;
  }

  let budget = 400; // samples kept before the older ones are merged
  let cost = 0; // ms per frame, smoothed
  /** Merge neighbouring samples of the same stroke in the older part of the wake (age > 0.5 s, where it is broad and
   *  smooth) into one that stands for both, until the count fits the budget. */
  function merge(t: number) {
    for (let pass = 0; pass < 3 && S.length > budget; pass++) {
      for (let i = 0; i + 1 < S.length && S.length > budget; i++) {
        const p = S[i];
        const q = S[i + 1];
        if (p.st !== q.st || t - q.t0 < 0.5 || p.l + q.l > 120) continue;
        const l = p.l + q.l;
        const u = q.l / l;
        p.x += (q.x - p.x) * u;
        p.y += (q.y - p.y) * u;
        const dx = p.dx + (q.dx - p.dx) * u;
        const dy = p.dy + (q.dy - p.dy) * u;
        const n = Math.hypot(dx, dy) || 1;
        p.dx = dx / n;
        p.dy = dy / n;
        p.t0 += (q.t0 - p.t0) * u;
        p.v += (q.v - p.v) * u;
        p.a += (q.a - p.a) * u;
        p.phi += (q.phi - p.phi) * u;
        p.kt += (q.kt - p.kt) * u;
        p.l = l;
        p.sg = Math.max(p.sg, 0.7 * l);
        S.splice(i + 1, 1);
      }
    }
  }

  return { stroke, move, end, addTo, active, get count() { return S.length; } };
}

export type Wake = ReturnType<typeof createWake>;
export type WakeStroke = Stroke;
