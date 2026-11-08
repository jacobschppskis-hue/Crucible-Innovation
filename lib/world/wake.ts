// The visitor's waves on the molten sea: a boat's wake along each pointer's path, and clean rings from taps. lava.glsl
// draws them (lava_interact); `sampleAt` is the same sum on the CPU.
//
// The model is the production liquid's (lib/liquid/wake.ts, the version Jacob approved): real water leaves a V behind
// a boat at any speed because it is dispersive, so the wake is the pattern itself, built from the pointer's recent path:
// - the path is kept as samples 10-28 px apart (position on the sea, direction, speed, strength, when);
// - each sample carries the wake's cross-section `age` s after the pointer passed: two arms, each a short ridge train,
//   leaving the path sideways at 0.33x the pointer's speed (a ~19 deg V at any speed), broadening and fading;
// - along the path each sample is a normalised Gaussian weighted by the path length it stands for, so the sum over
//   samples is one continuous surface along any path, straight or curved (no beads, no end rings, no seams).
// Everything is in CSS px and scaled by the units-per-px where the sample was laid, so a wake keeps its on-screen size
// at any altitude. Samples live in the sea's surface coords (u, v); older ones are merged when there are too many.

/** Tunables (px, s). spread: the arms' sideways speed per px/s (tan of the V's half-angle), between cMin and cMax.
 *  w0 / wGrow / wMax: an arm's half-width at the pointer, its growth per px of spread, its cap. life: amplitude e-folding;
 *  max: when a sample is dropped. budget: samples kept (older ones merge). energy: how much a px of wake heats. */
export const WAKE = { spread: 0.33, cMin: 14, cMax: 300, w0: 8, wGrow: 0.13, wMax: 34, life: 1.6, max: 3.2, budget: 96, energy: 0.38 };

const TAU = Math.PI * 2;
const N = 128;
const gap = (v: number) => Math.min(28, Math.max(10, v * 0.03));

export type Stroke = { lu: number; lv: number; rem: number; du: number; dv: number; vs: number; a: number; sc: number; on: boolean };
type Sample = { u: number; v: number; du: number; dv: number; t0: number; vel: number; a: number; l: number; sg: number; sc: number; st: Stroke };
type Ring = { u: number; v: number; t0: number; speed: number; W0: number; slope: number; tau: number; life: number };

export function createWake() {
  const S: Sample[] = [];
  const rings: Ring[] = [];
  const tips: Sample[] = [];
  const tex = new Float32Array(N * 3 * 4);
  const U = { tex, n: 0, ver: 0, box: new Float32Array(4), ring: new Float32Array(32), ringW: new Float32Array(8), ringN: 0 };

  const stroke = (): Stroke => ({ lu: NaN, lv: NaN, rem: 0, du: 1, dv: 0, vs: 0, a: 0, sc: 1, on: false });
  function end(st: Stroke) {
    st.on = false;
    st.lu = NaN;
    st.rem = 0;
  }

  /** The pointer went along `path` ([u, v, ...] surface coords, starting where it was last frame) between clock times
   *  t0 and t1, at speed `vel` px/s with strength `a` (px of height), `sc` units per CSS px there. */
  function move(st: Stroke, path: number[], t0: number, t1: number, vel: number, a: number, sc: number) {
    if (Number.isNaN(st.lu)) {
      st.lu = path[0];
      st.lv = path[1];
      st.rem = 0;
      st.vs = vel;
    }
    // the speed that sets the V's spread follows slowly (0.2 s): bursty events would make the arms wobble
    st.vs += (vel - st.vs) * (1 - Math.exp(-Math.max(0, t1 - t0) / 0.2));
    st.a = a;
    st.sc = sc;
    let L = 0;
    for (let i = 2; i < path.length; i += 2) L += Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]) / sc;
    if (L <= 0) return;
    const g = gap(st.vs);
    let s = 0;
    for (let i = 2; i < path.length; i += 2) {
      const au = path[i - 2];
      const av = path[i - 1];
      const su = path[i] - au;
      const sv = path[i + 1] - av;
      const l = Math.hypot(su, sv) / sc; // px
      if (l < 1e-6) continue;
      // the heading eases along the path (a few px of memory): a jittery pointer still has a clean direction
      const e = 1 - Math.exp(-l / 16);
      st.du += (su / sc / l - st.du) * e;
      st.dv += (sv / sc / l - st.dv) * e;
      const n = Math.hypot(st.du, st.dv) || 1;
      st.du /= n;
      st.dv /= n;
      let w = 0;
      while (st.rem + (l - w) >= g) {
        w += g - st.rem;
        const tt = t0 + ((t1 - t0) * (s + w)) / L;
        if (a > 0) S.push({ u: au + (su * w) / l, v: av + (sv * w) / l, du: st.du, dv: st.dv, t0: tt, vel: st.vs, a, l: g, sg: 0.75 * g, sc, st });
        st.rem = 0;
      }
      st.rem += l - w;
      s += l;
    }
    st.lu = path[path.length - 2];
    st.lv = path[path.length - 1];
    st.on = true;
  }

  /** A tap on the sea: one clean ring (sized in CSS px through sc). */
  function tap(u: number, v: number, sc: number, t: number) {
    ring(u, v, t, { speed: 150 * sc, W0: 9 * sc, slope: 0.3, tau: 1.5, life: 4.5 });
  }
  /** A scripted ring (surface units): something breaking the surface. */
  function ring(u: number, v: number, t: number, o: Partial<Ring>) {
    rings.push({ u, v, t0: t, speed: 140, W0: 9, slope: 0.25, tau: 1.6, life: 4.5, ...o });
    while (rings.length > 8) rings.shift();
  }

  /** Merge neighbouring samples of one stroke in the older part of the wake (broad and smooth there). */
  function merge(t: number) {
    for (let pass = 0; pass < 4 && S.length > WAKE.budget; pass++) {
      for (let i = 0; i + 1 < S.length && S.length > WAKE.budget; i++) {
        const p = S[i];
        const q = S[i + 1];
        if (p.st !== q.st || t - q.t0 < 0.4 || p.l + q.l > 140) continue;
        const l = p.l + q.l;
        const w = q.l / l;
        p.u += (q.u - p.u) * w;
        p.v += (q.v - p.v) * w;
        const du = p.du + (q.du - p.du) * w;
        const dv = p.dv + (q.dv - p.dv) * w;
        const n = Math.hypot(du, dv) || 1;
        p.du = du / n;
        p.dv = dv / n;
        p.t0 += (q.t0 - p.t0) * w;
        p.vel += (q.vel - p.vel) * w;
        p.a += (q.a - p.a) * w;
        p.sc += (q.sc - p.sc) * w;
        p.l = l;
        p.sg = Math.max(p.sg, 0.7 * l);
        S.splice(i + 1, 1);
      }
    }
    // still too many (a long, fast scribble): the oldest go
    if (S.length > WAKE.budget) S.splice(0, S.length - WAKE.budget);
  }

  /** The cross-section of one sample at time t: [A, R, W] (px), or null when spent. */
  function params(s: Sample, t: number): [number, number, number] | null {
    const age = Math.max(0, t - s.t0);
    if (age > WAKE.max) return null;
    const c = Math.min(WAKE.cMax, Math.max(WAKE.cMin, WAKE.spread * s.vel));
    const R = c * age;
    const W = Math.min(WAKE.wMax, WAKE.w0 + WAKE.wGrow * R);
    const q = age / WAKE.max;
    const fade = 1 - q * q;
    // grows in over the first 60 ms, so the wake rises out of the pointer instead of popping in under it
    const A = ((s.a * s.l) / (Math.sqrt(TAU) * s.sg)) * Math.exp(-age / WAKE.life) * (WAKE.w0 / W) ** 0.3 * fade * fade * (1 - Math.exp(-age / 0.06));
    return A < 0.004 ? null : [A, R, W];
  }

  /** Fill the texture and uniforms for time t. `heads`: the live strokes (a sample at each pointer stands for the path
   *  since its last sample, so the wake always reaches the pointer). */
  function pack(t: number, heads: Stroke[]) {
    while (S.length && (t - S[0].t0 > WAKE.max || S[0].t0 > t + 0.01)) S.shift();
    if (S.length > WAKE.budget) merge(t);
    tips.length = 0;
    for (const st of heads) {
      if (!st.on || st.rem <= 0.5 || st.a <= 0) continue;
      tips.push({ u: st.lu, v: st.lv, du: st.du, dv: st.dv, t0: t, vel: st.vs, a: st.a, l: st.rem, sg: 0.75 * gap(st.vs), sc: st.sc, st });
    }
    let n = 0;
    let u0 = 1e30;
    let v0 = 1e30;
    let u1 = -1e30;
    let v1 = -1e30;
    for (const s of S.concat(tips)) {
      if (n >= N) break;
      const p = params(s, t);
      if (!p) continue;
      const [A, R, W] = p;
      tex.set([s.u, s.v, A, R, s.du, s.dv, W, s.sg, s.sc, WAKE.energy, 0, 0], n * 12);
      const reach = (Math.max(3 * s.sg, R + 3 * W) + 4) * s.sc;
      u0 = Math.min(u0, s.u - reach);
      u1 = Math.max(u1, s.u + reach);
      v0 = Math.min(v0, s.v - reach);
      v1 = Math.max(v1, s.v + reach);
      n++;
    }
    U.n = n;
    U.box.set(n ? [u0, v0, u1, v1] : [0, 0, 0, 0]);
    U.ver++;
    for (let i = rings.length - 1; i >= 0; i--) if (t - rings[i].t0 > rings[i].life || t < rings[i].t0 - 0.01) rings.splice(i, 1);
    U.ring.fill(0);
    U.ringW.fill(1);
    rings.forEach((R, i) => {
      const age = Math.max(t - R.t0, 0);
      const r = R.speed * age;
      const W = R.W0 * (1 + 0.35 * age);
      const env = (Math.exp(-age / R.tau) * (1 - Math.exp(-age / 0.06))) / Math.sqrt(1 + r / (6 * R.W0));
      U.ring.set([R.u, R.v, r, ((R.slope * W) / 2.4) * env], i * 4);
      U.ringW[i] = W;
    });
    U.ringN = rings.length;
  }

  /** [height (units), d/du, d/dv, energy] of the visitor's waves at (u, v), as last packed (lava_interact on the CPU,
   *  without the footprint filter). */
  function sampleAt(u: number, v: number): [number, number, number, number] {
    let h = 0;
    let gu = 0;
    let gv = 0;
    let en = 0;
    for (let i = 0; i < U.ringN; i++) {
      const qx = u - U.ring[i * 4];
      const qz = v - U.ring[i * 4 + 1];
      const rr = Math.hypot(qx, qz) + 1e-6;
      const W = U.ringW[i];
      const x = (rr - U.ring[i * 4 + 2]) / W;
      if (Math.abs(x) > 3.5) continue;
      const a = U.ring[i * 4 + 3];
      const g = Math.exp(-x * x);
      const c = Math.cos(2.4 * x);
      const s = Math.sin(2.4 * x);
      h += a * g * c;
      const dg = (a * g * (-2 * x * c - 2.4 * s)) / W;
      gu += (dg * qx) / rr;
      gv += (dg * qz) / rr;
      en += (Math.abs(a * g * c) / W) * 6;
    }
    const b = U.box;
    if (U.n && u > b[0] && v > b[1] && u < b[2] && v < b[3]) {
      const K = TAU / 46;
      for (let i = 0; i < U.n; i++) {
        const o = i * 12;
        const sc = tex[o + 8];
        const qx = (u - tex[o]) / sc;
        const qy = (v - tex[o + 1]) / sc;
        const eu = tex[o + 4];
        const ev = tex[o + 5];
        const a = qx * eu + qy * ev;
        const d = qx * ev - qy * eu;
        const R = tex[o + 3];
        const W = tex[o + 6];
        const sg = tex[o + 7];
        if (Math.abs(a) > 3 * sg || Math.abs(d) > R + 3 * W) continue;
        const ia = 1 / (2 * sg * sg);
        const iw = 1 / (2 * W * W);
        const w1 = d - R;
        const w2 = d + R;
        const e1 = Math.exp(-w1 * w1 * iw);
        const e2 = Math.exp(-w2 * w2 * iw);
        const val = e1 * Math.cos(K * w1) + e2 * Math.cos(K * w2);
        const dvd = e1 * (-2 * w1 * iw * Math.cos(K * w1) - K * Math.sin(K * w1)) + e2 * (-2 * w2 * iw * Math.cos(K * w2) - K * Math.sin(K * w2));
        const ga = Math.exp(-a * a * ia);
        const A = tex[o + 2];
        h += A * ga * val * sc;
        const hd = A * ga * dvd;
        const ha = A * ga * val * (-2 * a * ia);
        gu += hd * ev + ha * eu;
        gv += -hd * eu + ha * ev;
        en += Math.abs(A * ga * val) * tex[o + 9];
      }
    }
    return [h, gu, gv, en];
  }

  return {
    stroke,
    end,
    move,
    tap,
    ring,
    pack,
    sampleAt,
    U,
    get count() {
      return S.length;
    },
  };
}

export type Wake = ReturnType<typeof createWake>;
