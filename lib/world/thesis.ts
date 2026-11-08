// The Thesis heat (owner: story). V2 (Jacob, Nov 8 evening: "after it gets black, when the temperature is rising from
// 293 to 1,811, there's the base part, and then only at the front part of the planet, there's a bunch of stuff moving
// around, it just doesn't look good"; "Always make it so that you can see the planet").
//
// Rebuilt as the simplest thing that reads: the whole visible planet heats evenly. As the visitor scrolls the Thesis
// (components/world/Thesis.tsx, place `thesis`), the readout climbs from room temperature (293 K) to iron's melting point
// (1811 K) and the planet's own molten sea climbs with it, everywhere at once, through the lava's own material (one
// temperature offset, SeaMod.heat, in lava's 850 K-per-unit scale, so the near sea and the far disk are one material):
// - at 293 K nothing new happens: the planet is exactly the reference look (a dark red disk, its rivers, the limb);
//   never darker, never black;
// - heating, the dark sea between the rivers comes up toward the rivers' own glow, until the disk is one molten surface
//   that runs orange toward yellow (the metals become one material: the alloy), on a true Planck curve;
// - no pattern of our own, no screen-space pooling, nothing local "at the front": one number for the whole planet;
// - the camera (keys below) climbs from the sea into an orbit view like the reference frame, the limb low in the frame
//   and the type above it in the black sky, so the type never sits on the hot disk.
// It eases in over the last stretch of ventures and back out by shore 0.45 (as the sunrise arc begins), so the loop is untouched.
// The DOM (readout, the two lines' crossfade) is written here too, so the single-file preview behaves like the site.

import type { WorldModule } from './modules';
import type { Key } from './journey';

const ROOM = 293;
const IRON = 1811;
/** Kelvin for a heat value (readouts, tests). */
export const kelvin = (k: number) => ROOM + k * (IRON - ROOM);

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** The live state (tests, other modules): heat k 0..1, how much the thesis owns the sea (w). */
export const thesisState = { k: 0, w: 0, kelvin: ROOM };

/** How far the planet's sea heats at 1811 K, in lava's heat units (850 K each). */
const HEAT = 0.3;

const GLSL = /* glsl */ `
uniform float thesis_uHeat;  // the whole planet's added heat (lava's units), already weighted
void thesis_sea(Ray r, Sea s, inout SeaMod m){
  m.heat += thesis_uHeat;
}
`;

/** Camera keys for the Thesis: from the sea up into an orbit view like the reference frame. */
export function thesisKeys(R: number): Key[] {
  const deg = (a: number) => (a * Math.PI * R) / 180;
  const FAR = { sunU: 0, sunV: -deg(80), sunY: 1e6, sunR: 1.2e4 };
  return [
    // leaving the sea where ventures ends: the horizon low in the frame, the glowing sea under it (never a black frame)
    { at: ['thesis', 0], s: deg(151.5), h: 30, yaw: 0, pitch: -2, fov: 50, ...FAR, ph: { fov: 64, pitch: -3 } },
    // climbing: the horizon drops, the sea below opens out
    { at: ['thesis', 0.4], s: deg(153.8), h: 360, yaw: 0, pitch: -16, fov: 48, ...FAR, ph: { fov: 62, pitch: -5 } },
    // in orbit: the limb in the lower part of the frame (~73% down), the disk under it, the type in the sky above
    { at: ['thesis', 1], s: deg(156.5), h: 850, yaw: 0, pitch: -22, fov: 46, ...FAR, ph: { fov: 60, pitch: -10 } },
  ];
}

let els: { root: HTMLElement; num: HTMLElement | null; cap: HTMLElement | null } | null = null;
let shown = -1;
let wrote = '';

export const thesis: WorldModule & { keys: (R: number) => Key[] } = {
  id: 'thesis',
  glsl: GLSL,
  hooks: ['sea'],
  keys: thesisKeys,
  init({ root }) {
    const el = root.querySelector<HTMLElement>('[data-place="thesis"]');
    if (el) els = { root: el, num: el.querySelector('[data-thesis-num]'), cap: el.querySelector('[data-thesis-cap]') };
  },
  update(f, u) {
    const p = f.at('thesis');
    // the heat starts with the first scroll into the pin and eases out at the top (smoother at both ends)
    const k = smoother(seg(p, 0.02, 0.82));
    // the thesis owns the sea's heat from the last stretch of ventures until the sunrise arc begins in the shore
    const into = smooth(seg(f.at('ventures'), 0.85, 1));
    const away = 1 - smooth(seg(f.at('shore'), 0, 0.45));
    const w = p > 0 ? (p < 1 ? 1 : away) : into;
    thesisState.k = k;
    thesisState.w = w;
    thesisState.kelvin = kelvin(k);
    // a warm floor from the moment the thesis owns the sea (the night sea after ventures is close to black otherwise)
    u.set('thesis_uHeat', HEAT * (0.22 + 0.78 * k) * w);
    if (!els) return;
    // the DOM: temperature, and the two lines' crossfade (a long, eased hand-over around the middle of the climb)
    const xa = smooth(seg(p, 0.26, 0.44));
    const xb = smooth(seg(p, 0.4, 0.6));
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
