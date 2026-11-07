// The idle swell: a few long, slow waves that are always there, so the surface keeps a gentle sheen and floating things
// keep rocking when nobody touches the page. It is analytic (no grid): `swellAt` here and `swellGLSL` in the shader
// evaluate exactly the same sum, in PAGE CSS px, heights in px. It never makes Ember glints (the shader only lets the
// interaction grid glint) and it never draws lines.

/** [direction (rad), wavelength (px), period (s), amplitude (px), phase]. Two of them run against each other, so the
 *  pattern breathes in place more than it travels. Exactly four (one vec4 of phases in the shader). */
export const SWELL: readonly (readonly [number, number, number, number, number])[] = [
  [0.42, 1050, 7.8, 4.0, 0.3],
  [0.42 + Math.PI, 1050, 8.6, 3.2, 2.1],
  [2.2, 760, 6.1, 2.6, 4.0],
  [-1.2, 520, 3.6, 1.8, 5.3],
];

const W = SWELL.map(([a, len, per, amp, ph]) => {
  const k = (2 * Math.PI) / len;
  return { kx: Math.cos(a) * k, ky: Math.sin(a) * k, w: (2 * Math.PI) / per, amp, ph };
});

export type HG = { h: number; gx: number; gy: number };

/** Swell height (px) and slope at page px (x, y), time t (s). Writes into `out`. */
export function swellAt(x: number, y: number, t: number, out: HG): HG {
  let h = 0;
  let gx = 0;
  let gy = 0;
  for (let i = 0; i < W.length; i++) {
    const c = W[i];
    const ar = c.kx * x + c.ky * y - c.w * t + c.ph;
    h += c.amp * Math.sin(ar);
    const d = c.amp * Math.cos(ar);
    gx += d * c.kx;
    gy += d * c.ky;
  }
  out.h = h;
  out.gx = gx;
  out.gy = gy;
  return out;
}

const TAU = Math.PI * 2;
/** The shader's `uSwell` uniform: each wave's phase at page px (rx, ry) and time t, wrapped (computed here in double
 *  precision, so the shader only adds k . (p - ref) and never sees large page coordinates or times). */
export function swellPhases(rx: number, ry: number, t: number, out: Float32Array) {
  for (let i = 0; i < 4; i++) {
    const c = W[i];
    const ar = (c.kx * rx + c.ky * ry - c.w * t + c.ph) % TAU;
    out[i] = ar < 0 ? ar + TAU : ar;
  }
  return out;
}

const g = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** GLSL: `vec3 swell(vec2 q)` = (h, dh/dx, dh/dy) at q = page px minus the reference point of `uSwell` (see
 *  `swellPhases`). Same sum as `swellAt`. */
export function swellGLSL() {
  const body = W.map(
    (c, i) =>
      `{ float ar = ${g(c.kx)} * q.x + ${g(c.ky)} * q.y + uSwell.${'xyzw'[i]}; h += ${g(c.amp)} * sin(ar); gr += ${g(c.amp)} * cos(ar) * vec2(${g(c.kx)}, ${g(c.ky)}); }`,
  ).join('\n  ');
  return /* glsl */ `
uniform vec4 uSwell;
vec3 swell(vec2 q) {
  float h = 0.0;
  vec2 gr = vec2(0.0);
  ${body}
  return vec3(h, gr);
}`;
}
