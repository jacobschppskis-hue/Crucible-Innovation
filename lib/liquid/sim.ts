// The liquid's surface: a damped 2D wave equation on a grid of heights (CSS px), stepped on the main thread at a fixed
// 120 Hz. Everything that touches the page (the cursor's path, taps, finger drags, scrolling past a resting cursor,
// floating things) adds smooth Gaussian impulses here; rings, wakes and the V behind a fast flick come out of the
// physics, with interference for free. The renderer draws this grid as a shaded surface (B-spline upsampled) and the
// floaters read the very same numbers, so what you see is what rocks them.
//
// The grid is anchored to the PAGE: its rows are page rows, it covers the viewport plus half a viewport above and below,
// and when the page scrolls it shifts by whole cells (the renderer gets the exact scroll, so motion stays smooth).
// Left and right of the viewport there is a sponge (and above and below the margins), so waves leave instead of
// bouncing off the screen edge. A quiet grid costs nothing: stepping stops until something touches it again.

export const HZ = 120; // fixed substeps per second
const DT = 1 / HZ;
/** Tunables (the look lab overrides them): wave speed (px/s), amplitude damping (1/s), viscosity of the shortest waves
 *  (per substep). Ripples travel 300-600 px before they fade. At 8 px cells and 120 Hz the Courant number is capped well
 *  inside the 9-point scheme's stability limit (see r2). */
export const SIM = { speed: 420, damp: 0.6, visc: 0.01 };
const SPONGE = 8; // cells of absorbing border
const MAX_SUB = 8; // substeps per frame at most (a long frame slows the water down instead of stalling the page)

export type Stamp = { x: number; y: number; a: number; s: number; f: number }; // page px, amplitude, sigma px, frame fraction

export type Sim = ReturnType<typeof createSim>;

export function createSim() {
  let cell = 8;
  let cols = 0;
  let rows = 0;
  let x0 = 0; // page px of the left edge of column 0
  let r0 = 0; // page row index of row 0 (y0 = r0 * cell)
  let vh = 0;
  let u = new Float32Array(0); // now
  let p = new Float32Array(0); // one substep ago
  let n = new Float32Array(0); // scratch: next
  let out = new Float32Array(0); // display state (between p and u)
  let mask = new Uint8Array(0);
  let fx = new Float32Array(0);
  let fy = new Float32Array(0);
  let acc = 0;
  let quiet = true;
  let calm = 0; // substeps in a row with nothing visible left
  let peak = 0; // largest |h| of the last substep
  let maskKey = '';
  let maskDirty = true;
  let version = 0; // bumps when the display state changes
  const r2 = () => Math.min(0.55, ((SIM.speed * DT) / cell) ** 2); // margin below the 0.75 limit (damping, viscosity)

  const sponge = (k: number, len: number, edge: number) => {
    // 1 inside, falling towards the border over `edge` cells (quadratic), so waves are absorbed, not reflected
    const d = Math.min(k, len - 1 - k);
    if (d >= edge) return 1;
    const q = (edge - d) / edge;
    return 1 - 0.25 * q * q;
  };

  function resize(w: number, h: number, c: number, scrollY: number) {
    cell = c;
    vh = h;
    cols = Math.ceil(w / c) + 2 * SPONGE;
    rows = Math.ceil((2 * h) / c) + 2;
    x0 = -SPONGE * c;
    r0 = Math.floor((scrollY - 0.5 * h) / c);
    const N = cols * rows;
    u = new Float32Array(N);
    p = new Float32Array(N);
    n = new Float32Array(N);
    out = new Float32Array(N);
    mask = new Uint8Array(N);
    fx = new Float32Array(cols);
    fy = new Float32Array(rows);
    for (let i = 0; i < cols; i++) fx[i] = sponge(i, cols, SPONGE);
    for (let j = 0; j < rows; j++) fy[j] = sponge(j, rows, SPONGE);
    acc = 0;
    quiet = true;
    calm = 0;
    maskKey = '';
    maskDirty = true;
    version++;
  }

  /** Keep the window on the viewport: shift by whole rows when the page has scrolled. */
  function follow(scrollY: number) {
    const want = Math.floor((scrollY - 0.5 * vh) / cell);
    const d = want - r0;
    if (!d) return false;
    r0 = want;
    maskKey = '';
    if (quiet) return true;
    const N = cols * rows;
    if (Math.abs(d) >= rows) {
      u.fill(0);
      p.fill(0);
      out.fill(0);
    } else if (d > 0) {
      for (const a of [u, p, out]) {
        a.copyWithin(0, d * cols, N);
        a.fill(0, N - d * cols);
      }
    } else {
      for (const a of [u, p, out]) {
        a.copyWithin(-d * cols, 0, N + d * cols);
        a.fill(0, 0, -d * cols);
      }
    }
    version++;
    return true;
  }

  // Gaussian weights along one axis, reused
  const wx = new Float32Array(64);
  const wy = new Float32Array(64);
  /** Add a smooth velocity kick (a Gaussian of `sig` px, peak `a`) at page px (x, y). */
  function impulse(x: number, y: number, a: number, sig: number) {
    if (!cols) return;
    const gx = (x - x0) / cell - 0.5;
    const gy = y / cell - r0 - 0.5;
    const rad = Math.min(31, Math.ceil((2.6 * sig) / cell));
    const ci = Math.round(gx);
    const cj = Math.round(gy);
    const i0 = Math.max(1, ci - rad);
    const i1 = Math.min(cols - 2, ci + rad);
    const j0 = Math.max(1, cj - rad);
    const j1 = Math.min(rows - 2, cj + rad);
    if (i0 > i1 || j0 > j1) return;
    const k2 = (cell * cell) / (2 * sig * sig);
    for (let i = i0; i <= i1; i++) wx[i - i0] = Math.exp(-(i - gx) * (i - gx) * k2);
    for (let j = j0; j <= j1; j++) wy[j - j0] = a * Math.exp(-(j - gy) * (j - gy) * k2);
    for (let j = j0; j <= j1; j++) {
      const row = j * cols;
      const b = wy[j - j0];
      for (let i = i0; i <= i1; i++) u[row + i] += b * wx[i - i0];
    }
    quiet = false;
    calm = 0;
  }

  /** One substep of u_tt = c^2 lap u - damping, with a 9-point (isotropic) Laplacian. */
  function step() {
    const C = cols;
    const R2 = r2() / 6;
    const keep = 1 - SIM.damp * DT;
    const mu = SIM.visc;
    let m = 0;
    for (let j = 1; j < rows - 1; j++) {
      const fj = fy[j];
      let k = j * C + 1;
      for (let i = 1; i < C - 1; i++, k++) {
        const uc = u[k];
        const ue = u[k + 1], uw = u[k - 1], un = u[k - C], us = u[k + C];
        const edge = ue + uw + un + us;
        const lap = 4 * edge + (u[k - C - 1] + u[k - C + 1] + u[k + C - 1] + u[k + C + 1]) - 20 * uc;
        const pc = p[k];
        // velocity (per substep) and its 5-point Laplacian: a touch of viscosity on the shortest waves
        const lv = edge - 4 * uc - (p[k + 1] + p[k - 1] + p[k - C] + p[k + C] - 4 * pc);
        let v = uc + keep * (uc - pc) + R2 * lap + mu * lv;
        v *= fj * fx[i];
        n[k] = v;
        if (v > m) m = v;
        else if (-v > m) m = -v;
      }
    }
    const t = p;
    p = u;
    u = n;
    n = t;
    peak = m;
  }

  /**
   * Advance by dt seconds of real time: the stamps (taps, path impulses; `f` = when in the frame, 0..1) are applied in
   * the substep they belong to. Then the display state is interpolated between the last two substeps.
   */
  function advance(dt: number, stamps: Stamp[]) {
    if (!cols) return;
    if (quiet && !stamps.length) {
      acc = 0;
      return;
    }
    acc += dt;
    let ns = Math.floor(acc / DT);
    if (ns > MAX_SUB) {
      ns = MAX_SUB;
      acc = ns * DT;
    }
    let si = 0;
    if (ns === 0 && stamps.length) {
      // a fast display (or a tiny dt): apply now, they are drawn after the next substep
      for (const s of stamps) impulse(s.x, s.y, s.a, s.s);
      si = stamps.length;
    }
    for (let k = 0; k < ns; k++) {
      const until = (k + 1) / ns;
      while (si < stamps.length && stamps[si].f <= until + 1e-9) {
        const s = stamps[si++];
        impulse(s.x, s.y, s.a, s.s);
      }
      step();
      // Nothing visible left (a twentieth of a px everywhere) for half a second: stop until something touches it.
      if (peak < 0.05) {
        if (++calm > HZ / 2) {
          quiet = true;
          u.fill(0);
          p.fill(0);
          n.fill(0);
          out.fill(0);
          acc = 0;
          version++;
          return;
        }
      } else calm = 0;
    }
    acc -= ns * DT;
    while (si < stamps.length) {
      const s = stamps[si++];
      impulse(s.x, s.y, s.a, s.s);
    }
    // display: where the surface is now, between the last two substeps (smooth on any refresh rate)
    const al = Math.min(1, acc / DT);
    const N = u.length;
    for (let k = 0; k < N; k++) out[k] = p[k] + al * (u[k] - p[k]);
    version++;
  }

  /** Text and portraits: page px rects [x, y, w, h, level 0..255] (glints are capped behind them). */
  function setMask(rects: number[]) {
    const pad = cell * 0.75;
    // only rebuild when the cells covered change
    let key = r0 + ':';
    for (let q = 0; q < rects.length; q += 5) {
      key += `${Math.floor((rects[q] - pad - x0) / cell)},${Math.floor((rects[q + 1] - pad) / cell)},${Math.ceil((rects[q] + rects[q + 2] + pad - x0) / cell)},${Math.ceil((rects[q + 1] + rects[q + 3] + pad) / cell)},${rects[q + 4]};`;
    }
    if (key === maskKey) return false;
    maskKey = key;
    mask.fill(0);
    for (let q = 0; q < rects.length; q += 5) {
      const i0 = Math.max(0, Math.floor((rects[q] - pad - x0) / cell));
      const i1 = Math.min(cols - 1, Math.ceil((rects[q] + rects[q + 2] + pad - x0) / cell) - 1);
      const j0 = Math.max(0, Math.floor((rects[q + 1] - pad) / cell) - r0);
      const j1 = Math.min(rows - 1, Math.ceil((rects[q + 1] + rects[q + 3] + pad) / cell) - 1 - r0);
      const lv = rects[q + 4];
      for (let j = j0; j <= j1; j++) {
        const row = j * cols;
        for (let i = i0; i <= i1; i++) if (mask[row + i] < lv) mask[row + i] = lv;
      }
    }
    maskDirty = true;
    return true;
  }

  // cubic B-spline weights (the renderer uses the same reconstruction)
  const bw = new Float64Array(4);
  const bd = new Float64Array(4);
  const bw2 = new Float64Array(4);
  const bd2 = new Float64Array(4);
  const bspline = (t: number, w: Float64Array, d: Float64Array) => {
    const s = 1 - t;
    w[0] = (s * s * s) / 6;
    w[1] = (3 * t * t * t - 6 * t * t + 4) / 6;
    w[2] = (-3 * t * t * t + 3 * t * t + 3 * t + 1) / 6;
    w[3] = (t * t * t) / 6;
    d[0] = -0.5 * s * s;
    d[1] = 1.5 * t * t - 2 * t;
    d[2] = -1.5 * t * t + t + 0.5;
    d[3] = 0.5 * t * t;
  };

  /** Height (px) and slope of the displayed surface at page px (x, y): the same B-spline the shader draws. */
  function sample(x: number, y: number, o: { h: number; gx: number; gy: number }) {
    o.h = 0;
    o.gx = 0;
    o.gy = 0;
    if (quiet || !cols) return o;
    const gx = (x - x0) / cell - 0.5;
    const gy = y / cell - r0 - 0.5;
    const fi = Math.floor(gx);
    const fj = Math.floor(gy);
    if (fi < 0 || fj < 0 || fi > cols - 2 || fj > rows - 2) return o;
    bspline(gx - fi, bw, bd);
    bspline(gy - fj, bw2, bd2);
    let h = 0;
    let hx = 0;
    let hy = 0;
    for (let b = 0; b < 4; b++) {
      const j = Math.min(rows - 1, Math.max(0, fj - 1 + b));
      const row = j * cols;
      let sh = 0;
      let sd = 0;
      for (let a = 0; a < 4; a++) {
        const i = Math.min(cols - 1, Math.max(0, fi - 1 + a));
        const v = out[row + i];
        sh += bw[a] * v;
        sd += bd[a] * v;
      }
      h += bw2[b] * sh;
      hx += bw2[b] * sd;
      hy += bd2[b] * sh;
    }
    o.h = h;
    o.gx = hx / cell;
    o.gy = hy / cell;
    return o;
  }

  /** Steepest slope and rms height of the surface within r px of page px (x, y) (tests, harness). */
  function near(x: number, y: number, r: number) {
    let smax = 0;
    let s2 = 0;
    let h2 = 0;
    let cnt = 0;
    if (!quiet && cols) {
      const ci = (x - x0) / cell - 0.5;
      const cj = y / cell - r0 - 0.5;
      const rad = Math.ceil(r / cell);
      for (let j = Math.max(1, Math.floor(cj) - rad); j <= Math.min(rows - 2, Math.ceil(cj) + rad); j++) {
        for (let i = Math.max(1, Math.floor(ci) - rad); i <= Math.min(cols - 2, Math.ceil(ci) + rad); i++) {
          if ((i - ci) ** 2 + (j - cj) ** 2 > (r / cell) ** 2) continue;
          const k = j * cols + i;
          const sx = (out[k + 1] - out[k - 1]) / (2 * cell);
          const sy = (out[k + cols] - out[k - cols]) / (2 * cell);
          const s = Math.hypot(sx, sy);
          if (s > smax) smax = s;
          s2 += s * s;
          h2 += out[k] * out[k];
          cnt++;
        }
      }
    }
    return { slopeMax: smax, slopeRms: cnt ? Math.sqrt(s2 / cnt) : 0, hRms: cnt ? Math.sqrt(h2 / cnt) : 0, cells: cnt };
  }

  return {
    resize,
    follow,
    impulse,
    advance,
    setMask,
    sample,
    near,
    /** The display state (heights, px) and its layout; `version` bumps whenever it changes. */
    get out() {
      return out;
    },
    get mask() {
      return mask;
    },
    takeMaskDirty() {
      const d = maskDirty;
      maskDirty = false;
      return d;
    },
    get cell() {
      return cell;
    },
    get cols() {
      return cols;
    },
    get rows() {
      return rows;
    },
    get x0() {
      return x0;
    },
    get y0() {
      return r0 * cell;
    },
    get quiet() {
      return quiet;
    },
    get peak() {
      return peak;
    },
    get version() {
      return version;
    },
  };
}
