// The Thesis heat (owner: planet). Jacob, Nov 8 evening: "after it gets black, when the temperature is rising from 293
// to 1,811, there's the base part, and then only at the front part of the planet, there's a bunch of stuff moving
// around, it just doesn't look good"; "Always make it so that you can see the planet"; later: "That animation is okay,
// but see if you can change it out for something else that fits better".
//
// V3: the heating is an event you can read in the picture at every scroll position, across the whole visible planet,
// filmed from orbit. As the visitor scrolls the Thesis (components/world/Thesis.tsx, place `thesis`) the readout climbs
// from room temperature (293 K) to iron's melting point (1811 K) and the planet goes with it, through its own
// temperature field (look_thesisT in lib/world/glsl/planet.glsl; one material with the near sea):
// - cold: the world has cooled on the climb out of ventures: a dark, barely glowing sea, the rivers faint veins; the
//   limb's airglow, its sheen on the sea and the stars carry the frame (never black);
// - the rivers come up first, brightening to yellow-white and widening;
// - heat spreads from their banks across the basins, everywhere at once (the front is a distance from the nearest
//   river, the same rule over the whole planet: nothing local, nothing "at the front");
// - the whole sea passes dull red, Ember and orange to yellow-white as its skin thins, the river network still its
//   hottest lines, its flow carried along them; the limb blazes and the air over it warms (look.ts scales the air's
//   own glow by the same heat).
// - the camera (keys below) is in orbit from the first frame of the pin: the limb ~60% down, the planet large under the
//   type, the type in the black sky above it, so the type never sits on the hot disk.
// The world cools over the climb out of ventures and is the normal planet again 60% of the way from the pin's end to
// the shore (before the footer's lines are over it), so the loop is untouched.
// The DOM (readout, the two lines' crossfade) is written here too, so the single-file preview behaves like the site.

import type { WorldModule } from './modules';
import type { Key } from './journey';
import type { Frame } from './frame';

const ROOM = 293;
const IRON = 1811;
/** Kelvin for a heat value (readouts, tests). */
export const kelvin = (k: number) => ROOM + k * (IRON - ROOM);

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The live state (tests, other modules): heat k 0..1, how much the thesis owns the sea (w). */
export const thesisState = { k: 0, w: 0, kelvin: ROOM };

/**
 * The thesis at this frame: k (0..1: 293 K -> 1811 K) and w (0..1: how far the world is the thesis's: cooled to its
 * cold state at k 0, molten at k 1) and dim (0..1: how far the air's own glow has gone out, a little ahead of w on the
 * way in). look.ts reads it for the planet's shader and the air's glow.
 */
export function thesisHeat(f: Frame): { k: number; w: number; dim: number } {
  const p = f.at('thesis');
  // the heat starts with the first scroll into the pin and eases out at the top
  const k = smooth(seg(p, 0.02, 0.82));
  // the world cools over the climb out of ventures (from its pin's end to the thesis's start, one screen of scroll)...
  let into = 0,
    dim = 0;
  const pv = f.places['ventures'],
    pt = f.places['thesis'];
  if (pv && pt) {
    const y0 = pv.top + pv.h - f.h;
    into = pt.top > y0 + 1 ? smooth(seg(f.y, y0 + 0.15 * (pt.top - y0), pt.top)) : f.y >= pt.top ? 1 : 0;
    // the air's glow from below goes first (the first 40% of the climb), so the climb is through a clear dark sky
    dim = pt.top > y0 + 1 ? smooth(seg(f.y, y0, y0 + 0.4 * (pt.top - y0))) : into;
  }
  // ... and cools back to the normal planet as the pin lets go: the footer's lines scroll in over the lower frame right
  // behind the thesis, and bone type on a yellow-white sea does not read. Done 60% of the way to the shore's first
  // frame (it used to last until shore 0.45, when the hot sea was a dull orange), so the loop is untouched.
  let away = 1 - smooth(seg(f.at('shore'), 0, 0.45));
  const ps = f.places['shore'];
  if (pt && ps) {
    const y1 = pt.top + pt.h - f.h;
    // (lead) it starts a little before the pin lets go and is done a third of a screen after: the footer's heading
    // comes in at the bottom the moment the pin ends, and at 60% of the way it was still over an orange sea
    if (ps.top > y1 + 1) away = 1 - smooth(seg(f.y, y1 - 0.15 * (ps.top - y1), y1 + 0.3 * (ps.top - y1)));
  }
  const w = p > 0 ? (p < 0.9 ? 1 : away) : into;
  return { k, w, dim: p > 0 ? w : dim };
}

/** Camera keys for the Thesis: in orbit from its first frame, the planet large under the type. The limb sits ~61% down
 * a phone and ~64% down a desktop the whole way (pitch = -(dip - offset), dip = acos(R / (R + h))), while the camera
 * climbs and drifts on, so the heating sea slides slowly under it. It looks left of the track (phones 32 deg, toward
 * a river system; desktop 48 deg: from this high the limb straight ahead is already past the morning terminator, and
 * the first sliver of the shore's sunrise showed there as a broken dash; the shore then pans right to reveal it). */
export function thesisKeys(R: number): Key[] {
  const deg = (a: number) => (a * Math.PI * R) / 180;
  const FAR = { sunU: 0, sunV: -deg(80), sunY: 1e6, sunR: 1.2e4 };
  return [
    // the climb out of ventures ends here: already in low orbit (the screen of scroll before the pin is the climb)
    { at: ['thesis', 0], s: deg(152.2), h: 800, yaw: -48, pitch: -21, fov: 48, ...FAR, ph: { fov: 60, pitch: -18.7, yaw: -32 } },
    { at: ['thesis', 0.45], s: deg(154.2), h: 1400, yaw: -48, pitch: -28.9, fov: 47, ...FAR, ph: { fov: 60, pitch: -26.4, yaw: -32 } },
    // (the shore's first key is at h 900, turned toward the sunrise: the camera comes down into it as the sea cools)
    { at: ['thesis', 1], s: deg(156.5), h: 1800, yaw: -48, pitch: -32.9, fov: 46, ...FAR, ph: { fov: 60, pitch: -30.3, yaw: -32 } },
  ];
}

let els: { root: HTMLElement; num: HTMLElement | null; cap: HTMLElement | null } | null = null;
let shown = -1;
let wrote = '';

export const thesis: WorldModule & { keys: (R: number) => Key[] } = {
  id: 'thesis',
  keys: thesisKeys,
  init({ root }) {
    const el = root.querySelector<HTMLElement>('[data-place="thesis"]');
    if (el) els = { root: el, num: el.querySelector('[data-thesis-num]'), cap: el.querySelector('[data-thesis-cap]') };
  },
  update(f) {
    const p = f.at('thesis');
    const { k, w } = thesisHeat(f);
    thesisState.k = k;
    thesisState.w = w;
    thesisState.kelvin = kelvin(k);
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
