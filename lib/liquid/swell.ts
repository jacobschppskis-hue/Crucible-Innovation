// The idle ocean: long, slow swell that always rolls across the page, so the surface is never dead still and floating
// things keep rocking when nobody touches it. Long-crested waves all travelling the same general way (down the screen
// and to the right, crests rising across it at about 35 degrees; each a few degrees off the mean), on deep-water
// dispersion (the longer ones are faster), at irrational ratios of wavelength and period, so the sum never repeats into a pattern or a moire. It is analytic (no
// grid): `swellAt` here and `swellGLSL` in the shaders evaluate exactly the same sum, in PAGE CSS px, heights in px. The
// shader gives its crests a soft warm sheen (never Ember glints: those are for waves the visitor makes) and never
// draws lines.

/** Deep-water dispersion in page px: phase speed = sqrt(G * wavelength / 2 pi). 32 px/s^2: 700 px waves roll at 60 px/s
 *  (12 s a crest), 190 px chop at 31 px/s. */
const G = 32;

/** [direction of travel (rad, x right, y down the screen), wavelength (px), amplitude (px), phase]. The first four are
 *  the primary swell (the only ones the flame and furnace shaders bend with: one vec4 of phases); the second four are
 *  its shorter chop, in the liquid's shader and on the CPU. */
export const SWELL: readonly (readonly [number, number, number, number])[] = [
  [0.95, 700, 2.6, 0.3],
  [1.08, 473, 1.5, 2.1],
  [0.84, 561, 1.4, 4.0],
  [1.17, 331, 0.75, 5.3],
  [0.7, 241, 0.32, 1.2],
  [1.3, 193, 0.22, 3.7],
  [1.01, 283, 0.38, 0.6],
  [0.58, 409, 0.45, 2.9],
];

const W = SWELL.map(([a, len, amp, ph]) => {
  const k = (2 * Math.PI) / len;
  return { kx: Math.cos(a) * k, ky: Math.sin(a) * k, w: Math.sqrt(G * k), amp, ph };
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
/** The shaders' swell uniforms: each wave's phase at page px (rx, ry) and time t, wrapped (computed here in double
 *  precision, so a shader only adds k . (p - ref) and never sees large page coordinates or times). Fills `out` (4: the
 *  primary swell, `uSwell`; 8: all of it, `uSwell` then `uSwellB`). */
export function swellPhases(rx: number, ry: number, t: number, out: Float32Array) {
  const n = Math.min(out.length, W.length);
  for (let i = 0; i < n; i++) {
    const c = W[i];
    const ar = (c.kx * rx + c.ky * ry - c.w * t + c.ph) % TAU;
    out[i] = ar < 0 ? ar + TAU : ar;
  }
  return out;
}

const g = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** GLSL: `vec3 swell(vec2 q)` = (h, dh/dx, dh/dy) at q = page px minus the reference point of the phases (see
 *  `swellPhases`). `all`: the whole sum (uniforms `uSwell` and `uSwellB`, as `swellAt`); otherwise the primary swell
 *  only (`uSwell`). */
export function swellGLSL(all = false) {
  const n = all ? 8 : 4;
  const body = W.slice(0, n)
    .map(
      (c, i) =>
        `{ float ar = ${g(c.kx)} * q.x + ${g(c.ky)} * q.y + ${i < 4 ? 'uSwell' : 'uSwellB'}.${'xyzw'[i % 4]}; h += ${g(c.amp)} * sin(ar); gr += ${g(c.amp)} * cos(ar) * vec2(${g(c.kx)}, ${g(c.ky)}); }`,
    )
    .join('\n  ');
  return /* glsl */ `
uniform vec4 uSwell;${all ? '\nuniform vec4 uSwellB;' : ''}
vec3 swell(vec2 q) {
  float h = 0.0;
  vec2 gr = vec2(0.0);
  ${body}
  return vec3(h, gr);
}`;
}
