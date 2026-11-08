// The liquid's surface: a damped 2D wave equation on a grid of heights (CSS px), stepped on the main thread at a fixed
// 120 Hz. Drops (taps, ripples shed by floating things, the pour landing) add smooth ringing impulses here, and rings
// with interference come out of the physics. The pointer's wake is its own model (wake.ts), evaluated into the same
// display grid after each step (`advance(dt, stamps, extra)`). The renderer draws this grid as a shaded surface
// (B-spline upsampled) and the floaters read the very same numbers, so what you see is what rocks them.
//
// The grid is anchored to the PAGE: its rows are page rows, it covers the viewport plus half a viewport above and below,
// and when the page scrolls it shifts by whole cells (the renderer gets the exact scroll, so motion stays smooth).
// Left and right of the viewport there is a sponge (and above and below the margins), so waves leave instead of
// bouncing off the screen edge. A quiet grid costs nothing: stepping stops until something touches it again.

export const HZ = 120; // fixed substeps per second
const DT = 1 / HZ;
/** Tunables (the look lab overrides them): wave speed (px/s), amplitude damping (1/s), viscosity of the shortest waves
 *  (per substep). Ripples travel 200-400 px before they fade, so a wake trails the pointer instead of filling the page.
 *  At 8 px cells and 120 Hz the Courant number is capped well inside the 9-point scheme's stability limit (see r2). */
export const SIM = { speed: 420, damp: 1.2, visc: 0.01 };
const SPONGE = 8; // cells of absorbing border
const MAX_SUB = 8; // substeps per frame at most (a long frame slows the water down instead of stalling the page)

/** An impulse: page px, peak amplitude, sigma px (t: sigma along y if not s), frame fraction. */
export type Stamp = { x: number; y: number; a: number; s: number; f: number; t?: number };

export type Sim = ReturnType<typeof createSim>;

// The waves live inside a box of cells (i0..i1, j0..j1) that grows faster than they travel, so only that box is
// stepped (a scroll wake or a cursor's first ripples cost a fraction of the grid); outside it every array is 0.
type Band = { P: typeof SIM; u: Float32Array; p: Float32Array; n: Float32Array; quiet: boolean; calm: number; peak: number; i0: number; i1: number; j0: number; j1: number; grow: number };
const band = (P: typeof SIM): Band => ({ P, u: new Float32Array(0), p: new Float32Array(0), n: new Float32Array(0), quiet: true, calm: 0, peak: 0, i0: 0, i1: -1, j0: 0, j1: -1, grow: 0 });

export function createSim() {
  let cell = 8;
  let cols = 0;
  let rows = 0;
  let x0 = 0; // page px of the left edge of column 0
  let r0 = 0; // page row index of row 0 (y0 = r0 * cell)
  let vh = 0;
  // the wave field: u = now, p = one substep ago, n = scratch (next)
  const bands = [band(SIM)];
  let out = new Float32Array(0); // display state (between p and u, plus the wake)
  let extraOn = false; // the wake wrote into out this frame
  let fx = new Float32Array(0);
  let fy = new Float32Array(0);
  let acc = 0;
  let version = 0; // bumps when the display state changes
  const quietAll = () => bands[0].quiet && !extraOn;
  // margin below the 0.75 limit (damping, viscosity)
  const r2 = (P: typeof SIM) => Math.min(0.55, ((P.speed * DT) / cell) ** 2);

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
    for (const B of bands) {
      B.u = new Float32Array(N);
      B.p = new Float32Array(N);
      B.n = new Float32Array(N);
      B.quiet = true;
      B.calm = 0;
      B.peak = 0;
      B.i1 = B.j1 = -1;
    }
    out = new Float32Array(N);
    extraOn = false;
    fx = new Float32Array(cols);
    fy = new Float32Array(rows);
    for (let i = 0; i < cols; i++) fx[i] = sponge(i, cols, SPONGE);
    for (let j = 0; j < rows; j++) fy[j] = sponge(j, rows, SPONGE);
    acc = 0;
    version++;
  }

  /** Keep the window on the viewport: shift by whole rows when the page has scrolled. */
  function follow(scrollY: number) {
    const want = Math.floor((scrollY - 0.5 * vh) / cell);
    const d = want - r0;
    if (!d) return false;
    r0 = want;
    if (quietAll()) return true;
    const N = cols * rows;
    const arrays: Float32Array[] = [out];
    for (const B of bands) {
      if (B.quiet) continue;
      arrays.push(B.u, B.p, B.n); // (n too: outside its box every array must stay 0)
      // the box moves with its waves
      B.j0 = Math.max(1, B.j0 - d);
      B.j1 = Math.min(rows - 2, B.j1 - d);
    }
    if (Math.abs(d) >= rows) {
      for (const a of arrays) a.fill(0);
    } else if (d > 0) {
      for (const a of arrays) {
        a.copyWithin(0, d * cols, N);
        a.fill(0, N - d * cols);
      }
    } else {
      for (const a of arrays) {
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
  /** Add a smooth velocity kick (a Gaussian of `sig` px, `sigY` px along y if different, peak `a`) at page px (x, y). */
  function impulse(x: number, y: number, a: number, sig: number, sigY = sig) {
    if (!cols) return;
    const gx = (x - x0) / cell - 0.5;
    const gy = y / cell - r0 - 0.5;
    const radX = Math.min(31, Math.ceil((2.6 * sig) / cell));
    const radY = Math.min(31, Math.ceil((2.6 * sigY) / cell));
    const ci = Math.round(gx);
    const cj = Math.round(gy);
    const i0 = Math.max(1, ci - radX);
    const i1 = Math.min(cols - 2, ci + radX);
    const j0 = Math.max(1, cj - radY);
    const j1 = Math.min(rows - 2, cj + radY);
    if (i0 > i1 || j0 > j1) return;
    const kx = (cell * cell) / (2 * sig * sig);
    const ky = (cell * cell) / (2 * sigY * sigY);
    for (let i = i0; i <= i1; i++) wx[i - i0] = Math.exp(-(i - gx) * (i - gx) * kx);
    for (let j = j0; j <= j1; j++) wy[j - j0] = a * Math.exp(-(j - gy) * (j - gy) * ky);
    const B = bands[0];
    const u = B.u;
    for (let j = j0; j <= j1; j++) {
      const row = j * cols;
      const w = wy[j - j0];
      for (let i = i0; i <= i1; i++) u[row + i] += w * wx[i - i0];
    }
    if (B.quiet || B.i1 < B.i0 || B.j1 < B.j0) {
      B.i0 = i0;
      B.i1 = i1;
      B.j0 = j0;
      B.j1 = j1;
    } else {
      B.i0 = Math.min(B.i0, i0);
      B.i1 = Math.max(B.i1, i1);
      B.j0 = Math.min(B.j0, j0);
      B.j1 = Math.max(B.j1, j1);
    }
    B.quiet = false;
    B.calm = 0;
  }
  const apply = (s: Stamp) => impulse(s.x, s.y, s.a, s.s, s.t);

  /** One substep of u_tt = c^2 lap u - damping, with a 9-point (isotropic) Laplacian, for one band. */
  function step(B: Band) {
    const C = cols;
    const R2 = r2(B.P) / 6;
    const keep = 1 - B.P.damp * DT;
    const mu = B.P.visc;
    const u = B.u;
    const p = B.p;
    const n = B.n;
    let m = 0;
    // the box grows by 1.5x the distance a wave travels per substep (whole cells, at least one every few substeps)
    B.grow += (1.5 * B.P.speed * DT) / cell;
    const g = Math.floor(B.grow);
    B.grow -= g;
    B.i0 = Math.max(1, B.i0 - g);
    B.i1 = Math.min(C - 2, B.i1 + g);
    B.j0 = Math.max(1, B.j0 - g);
    B.j1 = Math.min(rows - 2, B.j1 + g);
    const I0 = B.i0;
    const I1 = B.i1;
    for (let j = B.j0; j <= B.j1; j++) {
      const fj = fy[j];
      let k = j * C + I0;
      for (let i = I0; i <= I1; i++, k++) {
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
    B.p = u;
    B.u = n;
    B.n = p;
    B.peak = m;
    // Nothing visible left (a twentieth of a px everywhere) for half a second: stop until something touches it.
    if (m < 0.05) {
      if (++B.calm > HZ / 2) {
        B.quiet = true;
        B.u.fill(0);
        B.p.fill(0);
        B.n.fill(0);
        B.i1 = B.j1 = -1;
      }
    } else B.calm = 0;
  }

  /** Extra heights added into the display state after each step (the wake): writes into `out` (cols x rows, cell
   *  centres at x0 + (i + 0.5) cell, y0 + (j + 0.5) cell, page px) and says whether it wrote anything. */
  type Extra = (out: Float32Array, cols: number, rows: number, x0: number, y0: number, cell: number) => boolean;

  /**
   * Advance by dt seconds of real time: the stamps (drops; `f` = when in the frame, 0..1) are applied in the substep
   * they belong to. Then the display state is interpolated between the last two substeps, and `extra` adds the wake.
   */
  function advance(dt: number, stamps: Stamp[], extra?: Extra, extraLive = false) {
    if (!cols) return;
    const B = bands[0];
    if (B.quiet && !stamps.length && !extraOn && !extraLive) {
      acc = 0;
      return;
    }
    if (!B.quiet || stamps.length) {
      acc += dt;
      let ns = Math.floor(acc / DT);
      if (ns > MAX_SUB) {
        ns = MAX_SUB;
        acc = ns * DT;
      }
      let si = 0;
      if (ns === 0 && stamps.length) {
        // a fast display (or a tiny dt): apply now, they are drawn after the next substep
        for (const s of stamps) apply(s);
        si = stamps.length;
      }
      for (let k = 0; k < ns; k++) {
        const until = (k + 1) / ns;
        while (si < stamps.length && stamps[si].f <= until + 1e-9) apply(stamps[si++]);
        if (!B.quiet) step(B);
      }
      acc -= ns * DT;
      while (si < stamps.length) apply(stamps[si++]);
    } else acc = 0;
    // display: where the surface is now, between the last two substeps (smooth on any refresh rate), plus the wake
    const al = Math.min(1, acc / DT);
    out.fill(0);
    if (!B.quiet) {
      const bu = B.u;
      const bp = B.p;
      for (let j = B.j0; j <= B.j1; j++) {
        const k1 = j * cols + B.i1;
        for (let k = j * cols + B.i0; k <= k1; k++) out[k] = bp[k] + al * (bu[k] - bp[k]);
      }
    }
    extraOn = !!extra && extra(out, cols, rows, x0, r0 * cell, cell);
    version++;
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
    if (quietAll() || !cols) return o;
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
    if (!quietAll() && cols) {
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
    sample,
    near,
    /** The display state (heights, px) and its layout; `version` bumps whenever it changes. */
    get out() {
      return out;
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
      return quietAll();
    },
    get peak() {
      return bands[0].quiet ? 0 : bands[0].peak;
    },
    get version() {
      return version;
    },
  };
}
