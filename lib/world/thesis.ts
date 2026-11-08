// The Thesis heat (owner: story). As the visitor scrolls the Thesis (components/world/Thesis.tsx, place `thesis`), the
// planet's sea heats from room temperature (293 K) to iron's melting point (1811 K), then cools back over the shore so
// the journey arrives at the hero exactly as it left it (the loop).
//
// Cold, the sea is cold metal: the lava's own glow is taken down (SeaMod.heat, negative) and nothing is emitted, so it
// is a dark mirror of the stars. Heating, it glows from within through the Nov 2 build's domain-warped flow
// (lib/gl/molten.ts), re-done for the world:
// - on the sea in surface coordinates (it foreshortens with the surface and stays put as the camera climbs);
// - three nested scales (metres, tens of metres, kilometres), each used where it is resolved, so the same flowing
//   metal reads low over the sea and from 2400 m up, and nothing zooms;
// - stretched along a slow current, so it streams instead of boiling in blobs;
// - every octave fades out once it is finer than ~2 px (pixel footprint): no shimmer, no specks at distance;
// - smooth everywhere: no crust, no plates, no cracks (Jacob, Nov 8: dark crust plates read as "specks", "dirty");
// - pooled toward the viewer, reaching further as it heats, so the far sea and the horizon stay calm under the type;
// - coloured by Planck's law at three wavelengths (deep red near the Draper point, orange at 1811 K; the tone curve
//   takes the hottest streams toward yellow-white), with a softened monotone intensity so dull red and white-hot both
//   read. Linear HDR radiance into SeaMod.emit.
// The DOM (readout, line crossfade) is written here too, so the single-file preview behaves exactly like the site.

import type { WorldModule } from './modules';

const ROOM = 293;
const IRON = 1811;
/** Kelvin for a heat value (readouts, tests). */
export const kelvin = (k: number) => ROOM + k * (IRON - ROOM);

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The live state (tests, other modules): heat k 0..1, how much the thesis owns the sea (w), how cold it is. */
export const thesisState = { k: 0, w: 0, cold: 0, kelvin: ROOM };

const GLSL = /* glsl */ `
uniform float thesis_uK;     // heat 0..1 (293 K .. 1811 K)
uniform float thesis_uW;     // how much the thesis owns the sea (0 elsewhere)
uniform float thesis_uCold;  // 0..1: the lava's own glow taken down (cold metal)
uniform float thesis_uClear; // fraction of the frame height (from the top) the type occupies: the metal pools below it
vec2 thesis_h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
float thesis_noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = dot(thesis_h2(i), f), b = dot(thesis_h2(i+vec2(1,0)), f-vec2(1,0));
  float c = dot(thesis_h2(i+vec2(0,1)), f-vec2(0,1)), d = dot(thesis_h2(i+vec2(1,1)), f-vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float thesis_fbm(vec2 p, float fp, int oct){
  float v = 0.0, a = 0.5, f = 1.0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){
    if (i >= oct) break;
    float w = 1.0 - smoothstep(0.25, 0.6, fp * f);
    if (w <= 0.0) break;
    v += a * thesis_noise(p) * w;
    p = m * p; a *= 0.5; f *= 2.0;
  }
  return v;
}
// the domain-warped flow at one scale: q in noise units, nfp = noise units per px; returns ~[0,1] and how resolved it is
vec2 thesis_flow(vec2 q, float nfp, float sp, int oct){
  vec2 w1 = vec2(thesis_fbm(q + vec2(0.0, sp), nfp, oct), thesis_fbm(q + vec2(5.2, 1.3) - sp, nfp, oct));
  vec2 w2 = vec2(thesis_fbm(q + 2.6 * w1 + vec2(1.7, 9.2) + sp * 1.3, nfp, oct), thesis_fbm(q + 2.6 * w1 + vec2(8.3, 2.8), nfp, oct));
  float n = clamp(0.5 + thesis_fbm(q + 2.2 * w2 + vec2(0.0, -sp * 2.0), nfp, oct) * 0.9, 0.0, 1.0);
  return vec2(n, 1.0 - smoothstep(0.08, 0.35, nfp));
}
void thesis_sea(Ray r, Sea s, inout SeaMod m){
  if (thesis_uW <= 0.001) return;
  // where in the frame this pixel is (0 top .. 1 bottom): the metal pools low, under the type (the Nov 2 build pooled
  // it in the lower 60%); above that line the sea stays cold, still metal, so the type always has dark behind it
  float z = max(dot(r.rd, uCam[2]), 1e-3);
  float sy = 0.5 - dot(r.rd, uCam[1]) / z * uFocal / uRes.y;
  float low = smoothstep(thesis_uClear, thesis_uClear + 0.22, sy);
  m.heat -= thesis_uW * mix(1.0, thesis_uCold, low);
  float k = thesis_uK;
  if (k <= 0.001) return;
  // a slow current; the field stretched along it
  vec2 dir = normalize(vec2(0.35, -1.0));
  mat2 Rm = mat2(dir.y, -dir.x, dir.x, dir.y);
  vec2 w = Rm * s.w; w.y *= 0.55;
  float sp = uTime * (0.02 + k * 0.09) * (1.0 - uStill);
  int oct = uQ > 0.5 ? 5 : 4;
  // three scales, 40x apart; each counts where it is resolved (fine over coarse)
  float n = 0.5, wsum = 0.0;
  for (int i = 0; i < 3; i++){
    float sc = 0.16 / pow(40.0, float(i));
    vec2 f = thesis_flow(w * sc + float(i) * 17.3, s.fw * sc, sp, oct);
    float wi = f.y * (1.0 - wsum);
    n = mix(n, f.x, wi / max(wsum + wi, 1e-4));
    wsum += wi;
    if (wsum > 0.98) break;
  }
  // pooled toward the viewer, but the whole visible sea heats (the far sea a little cooler, so the horizon stays calm)
  float reach = 60.0 + uCamH * 4.0;
  float pool = exp(-max(s.t - uCamH, 0.0) / reach);
  // the temperature the eye sees, on look's true Planck curve (the same as the lava's): from below the Draper point at
  // the start to flowing orange-yellow metal at the readout's 1811 K. (Displayed kelvin are compressed: a true 1811 K
  // next to the ~1050 K sea would be ~100x brighter; this keeps it molten, not blown out.)
  float T = 700.0 + k * 720.0 * (0.62 + 0.62 * n * n * (3.0 - 2.0 * n)) * mix(0.82, 1.0, pool);
  m.emit += look_planck(T) * look_uLavaGain * 0.95 * thesis_uW * low;
}
`;

let els: { root: HTMLElement; inner: HTMLElement | null; num: HTMLElement | null; cap: HTMLElement | null } | null = null;
let clear = 0.5;
let shown = -1;
let wrote = '';

export const thesis: WorldModule = {
  id: 'thesis',
  glsl: GLSL,
  hooks: ['sea'],
  init({ root }) {
    const el = root.querySelector<HTMLElement>('[data-place="thesis"]');
    if (el) els = { root: el, inner: el.querySelector('.wthesis-in'), num: el.querySelector('[data-thesis-num]'), cap: el.querySelector('[data-thesis-cap]') };
  },
  update(f, u) {
    const p = f.at('thesis');
    // The Nov 2 timing: the heat eases in and out between 8% and 78% of the pin.
    const k = inOut(seg(p, 0.08, 0.78));
    // The sea is the thesis's from the last fifth of ventures (it cools to still metal for "Nothing new happens at
    // 293 K") until the sunrise starts in the shore (it cools back to the lava, so the loop arrives unchanged).
    const into = smooth(seg(f.at('ventures'), 0.8, 1));
    const away = 1 - smooth(seg(f.at('shore'), 0, 0.2));
    const w = p > 0 ? (p < 1 ? 1 : away) : into;
    // cold: the lava's own glow goes down while the metal is cold, and comes back as the heat takes over
    const cold = 1 - smooth(seg(k, 0.15, 0.6));
    thesisState.k = k;
    thesisState.w = w;
    thesisState.cold = cold;
    thesisState.kelvin = kelvin(k);
    u.set('thesis_uK', k);
    u.set('thesis_uW', w);
    u.set('thesis_uCold', cold);
    // composition: the bottom of the pinned type (headline, line, readout) is where the metal may start; measured
    // while the thesis is on screen (it is sticky, so it holds still there)
    if (els?.inner && w > 0 && p > 0 && p < 1) {
      const r = els.inner.getBoundingClientRect();
      let bottom = 0;
      for (const c of Array.from(els.inner.querySelectorAll<HTMLElement>('.wthesis-ro, .wthesis-s'))) bottom = Math.max(bottom, c.getBoundingClientRect().bottom);
      if (r.height > 0 && bottom > 0) clear = Math.min(0.8, (bottom + 16) / f.h);
    }
    u.set('thesis_uClear', clear);
    if (!els) return;
    // the DOM: temperature, the line crossfade (one line fully leaves before the next arrives), the readout
    const xa = inOut(seg(p, 0.3, 0.42));
    const xb = out(seg(p, 0.46, 0.6));
    const key = `${k.toFixed(4)}|${xa.toFixed(4)}|${xb.toFixed(4)}`;
    if (key !== wrote) {
      wrote = key;
      const s = els.root.style;
      s.setProperty('--k', k.toFixed(4));
      s.setProperty('--xa', xa.toFixed(4));
      s.setProperty('--xb', xb.toFixed(4));
    }
    const t = Math.round(kelvin(k));
    if (t !== shown) {
      shown = t;
      if (els.num) els.num.textContent = String(t);
      if (els.cap) els.cap.textContent = t >= IRON ? 'Iron melts' : t <= ROOM ? 'Room temperature' : 'Heating';
    }
  },
  dispose() {
    els = null;
    shown = -1;
    wrote = '';
  },
};
