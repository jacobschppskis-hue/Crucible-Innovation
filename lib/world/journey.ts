// The journey: scroll -> one set of channel values (camera, sun, module extras) through keyframes anchored to places.
//
// A place is a section of the page (`data-place="<name>"`). A keyframe is anchored to a place and a fraction of its pin:
// `at: ['hero', 0]` is the scroll position where the hero's top meets the viewport top, `['hero', 1]` where its bottom
// meets the viewport bottom (for a section one viewport tall, both are the same position). The loop: the last place,
// `loop`, is a copy of the hero's first screen, and its key is the hero's first key with the travel one lap further
// round the planet (s + 2PI R), so the journey's end IS its start.
//
// Channels (all numbers):
//   s      travel along the great circle (world units). One lap = 2 PI R. Must rise monotonically through the lap.
//   x      lateral offset (world units, + = right of the travel direction)
//   h      altitude above the sea (world units). Interpolated in log space, so a zoom out to orbit feels even.
//   yaw    degrees, 0 = facing the travel direction, + = turning right; 180 = looking back
//   pitch  degrees, + = up
//   roll   degrees
//   fov    vertical field of view (degrees)
//   sunU, sunV, sunY  where the sun (the mark's glowing core) is: a world point at surface coords (sunU across, sunV
//          along: ABSOLUTE, like s; the loop key adds LAP to it as to s) and height sunY above the sea. In the hero it
//          hangs over the sea ~150 units in front of the camera (the mark floats above its own reflection, with real
//          parallax as the camera moves); far away (sunY ~1e6) it is effectively a fixed star. sunY is log-interpolated.
//   sunR   the sun's (the core's) physical radius in world units; its angular radius is sunR / distance.
//          Between two keys the sun is NOT interpolated channel by channel: its direction from the camera slerps and its
//          distance and radius interpolate in log space (camera.ts sunFrom), so a near sun recedes into the sky along a
//          clean path instead of sweeping past the camera.
//   exposure (stops, 0 = neutral)
//   quiet  0..1: long running text on screen (the founders' accounts): look dims the rivers and disk glow under it
//          (GLSL uQuiet), smoothly with the keys
//   anything with a dot ('mark.size', 'lava.calm', ...): a module's own channel, default from its module's `channels`.
//
// Phones: a key's `ph` overrides its values when the layout is narrow.

import { cameraFrom, surfOf } from './camera';
import { clamp, type Channels } from './frame';

export const R = 6000; // planet radius (world units). 1 unit ~ 1 m at the low swoops.
export const LAP = 2 * Math.PI * R;

type Ease = 'smooth' | 'linear' | 'in' | 'out';
export type Key = {
  at: [place: string, f: number];
  /** Shift this key's scroll anchor by a number of viewports (e.g. -0.6 = 0.6 vh before the anchor). */
  dy?: number;
  /** Easing of the segment that ENDS at this key: 'smooth' (default: eases out of the previous key and into this one),
   * 'linear' (constant speed, for a key in the middle of a move), 'in' / 'out'. */
  ease?: Ease;
  /** Phone overrides. */
  ph?: Channels;
  /** Channel values (numbers). */
  [channel: string]: number | string | Channels | [string, number] | undefined;
};

export const CAMERA_DEFAULTS: Channels = {
  s: 0,
  x: 0,
  h: 2,
  yaw: 0,
  pitch: 0,
  roll: 0,
  fov: 50,
  sunU: 0,
  sunV: -150,
  sunY: 30,
  sunR: 4.2,
  exposure: 0,
  quiet: 0,
};

/** Channels interpolated in log space. */
const LOG = new Set(['h', 'sunY']);

/**
 * The places, in page order. `owner` is the role that owns the section's content and its scene (see ARCHITECTURE.md).
 * The world lead owns the keys; owners ask for changes.
 */
export const PLACES = [
  { name: 'hero', owner: 'mark' },
  { name: 'together', owner: 'mark' },
  { name: 'story', owner: 'story' },
  { name: 'paypal', owner: 'paypal' },
  { name: 'story-2', owner: 'story' },
  { name: 'story-3', owner: 'story' },
  { name: 'ventures', owner: 'ventures' },
  { name: 'thesis', owner: 'story' },
  { name: 'shore', owner: 'story' },
  { name: 'dawn', owner: 'story' },
  { name: 'loop', owner: 'world' },
] as const;
export type PlaceName = (typeof PLACES)[number]['name'];

const D2R = Math.PI / 180;
/** s at a given angle round the planet (degrees). */
const deg = (a: number) => a * D2R * R;

/**
 * The first-pass journey (world lead + look tune it). One day passes in one lap: the hero sits on the evening
 * terminator looking back west into the sunset (yaw 180), the camera turns to the night and climbs; the PayPal scene
 * is seen from high orbit over the night side (cosmic scale); it comes back down to skim the sea for the ventures
 * (cursor waves live there), climbs again for the thesis, meets the sunrise over the limb from orbit, races across the
 * day side high up and comes down on the evening terminator, which is the hero again.
 */
export function keys(): Key[] {
  // the sun: near = the mark's core hanging over the sea in front of the hero camera; far = a fixed star over
  // longitude 280 deg (so from the hero at theta 0 it stands ~10 deg over the western horizon, right where the near core
  // hangs; the morning terminator is at theta 190, the day side runs 190..370)
  const NEAR = { sunU: 0, sunV: -170, sunY: 34, sunR: 4.0 };
  const FAR = { sunU: 0, sunV: -deg(80), sunY: 1e6, sunR: 1.2e4 };
  const FAR2 = { ...FAR, sunV: deg(280) }; // the same place, written one lap on, for the run home
  // V2, the reference look in orbit (plan/v2/reference-orbit.webp): dusk on the limb. The far sun sits a few degrees
  // under the limb straight ahead, so the atmosphere lights a sunset band along it: over longitude L, a camera at angle
  // th and height h sees it at elevation 90 - (L - th), the limb at -acos(R / (R + h)); L = th + 94 + dip.
  const dusk = (lonDeg: number) => ({ ...FAR, sunV: deg(lonDeg) });
  // story: the climb out of the swoop up to PayPal's orbit, written densely (like paypal's own keys: no kinks) so the
  // limb can be HELD low in the frame all the way up. Two keys alone let it rise to mid-frame half way (the dip grows
  // with sqrt(h) while the pitch falls evenly), straight through the paragraph being read. Same path as before: s,
  // yaw and fov evenly, h in log space, the sun round to dusk(170), all on the smooth ease; only the pitch follows
  // the limb (phones: 79% -> 87% down a 390 x 844 frame, whose fov is width-locked; wide screens 78% -> 86%)
  const climb: Key[] = [];
  for (let k = 1; k <= 12; k++) {
    const e = EASE.smooth(k / 12);
    const mix = (a: number, b: number) => a + (b - a) * e;
    const h = 6 * Math.pow(1300 / 6, e);
    const pitchFor = (y: number, fov: number) => (Math.atan((y - 0.5) * 2 * Math.tan(0.5 * fov * D2R)) - Math.acos(R / (R + h))) / D2R;
    const phFov = mix(64, 62);
    climb.push({
      at: ['story', 0.35 + (0.65 * k) / 12], ease: 'linear',
      s: mix(360, deg(14)), h, yaw: mix(80, 6), fov: mix(50, 48), pitch: pitchFor(mix(0.78, 0.86), mix(50, 48)),
      ...FAR, sunV: k === 12 ? deg(170) : -deg(80 + 110 * e),
      ph: { fov: phFov, pitch: pitchFor(mix(0.79, 0.87), (2 * Math.atan((Math.tan(0.5 * phFov * D2R) * 0.6 * 844) / 390)) / D2R) },
    });
  }
  return [
    // hero: low over the molten sea at sunset, the mark floating over its reflection, its core the sun; stars above
    { at: ['hero', 0], s: 0, h: 1.6, yaw: 162, pitch: -0.2, fov: 46, ...NEAR, ph: { fov: 62, pitch: -2.7, yaw: 169.7 } }, // mark: phone core right of the type, so the glitter column never crosses it
    { at: ['hero', 1], s: 4, h: 1.8, yaw: 162, pitch: 0, fov: 46, ...NEAR, ph: { fov: 62, pitch: -2.4, yaw: 169.7 } },
    // stronger together: still on the sunset, a slow rise so the mark has the sky
    { at: ['together', 0], s: 8, h: 2.2, yaw: 180, pitch: -0.5, fov: 46, ...NEAR, ph: { fov: 62, pitch: -2 } },
    { at: ['together', 1], s: 30, h: 7, yaw: 178, pitch: 1, fov: 46, ...NEAR, ph: { fov: 62, pitch: 0 } },
    // story: the core recedes into the sky and sets as the camera turns to the night and climbs
    // ... and swoops low over the night sea while Jacob's first paragraphs are read: the visitor's cursor and finger
    // make wakes here (lava: full wakes below h 14). Film titles: the type has the dark sky, the horizon runs low in
    // the frame (phones ~79% down, wide screens ~78%), so the glow on it never passes behind the lines being read
    { at: ['story', 0], s: 90, h: 7, yaw: 118, pitch: 12, fov: 50, ...FAR, ph: { fov: 64, pitch: 22.4 } },
    { at: ['story', 0.35], s: 360, h: 6, yaw: 80, pitch: 12, fov: 50, ...FAR, ph: { fov: 64, pitch: 22.6 } },
    // V2: one slow climb from the swoop straight up to PayPal's orbit (no zoom onto the vent's glowing patch); it ends
    // with the limb ~87% down (the last lines leave upward, away from it)
    ...climb,
    // paypal: high orbit over the night side, looking down at the planet (cosmic scale)
    { at: ['paypal', 0], s: deg(28), h: 2600, yaw: 0, pitch: -36, fov: 42, ...FAR, ph: { fov: 58, pitch: -46 } },
    { at: ['paypal', 1], s: deg(38), h: 2900, yaw: 0, pitch: -38, fov: 42, ...FAR, ph: { fov: 58, pitch: -48 } },
    // story-2 (the rest of Jacob's account) and story-3 (Charlie): long text, read like film titles over the planet,
    // dusk on the limb. The limb never stands behind the lines being read (pitch = the limb's angle off the axis -
    // dip; dip = acos(R / (R + h))): on phones it lies ~80% down the frame, the type above it on the sky; on wide
    // screens the camera banks (roll -82) so the planet stands on the RIGHT, its limb ~235 px right of centre at
    // 900 px high, and the column has the left half (Story.css keeps it there). `quiet`: look dims the rivers under
    // the few lines that do cross the disk (phones: the lines coming in at the bottom; wide screens: none until the
    // camera levels out in story-3). 'look.stars' 0.5: fewer specks between the letters
    // the swing from PayPal's view into this one is over 0.45 of a screen BEFORE the place starts, in the gap between
    // the two scenes: by the time Jacob's break-out sentence comes up, the limb already stands where it stays
    { at: ['story-2', 0], dy: -0.45, s: deg(31.4), h: 3340, yaw: 0, pitch: -37.5, roll: -82, fov: 46, quiet: 0.25, 'look.stars': 0.5, ...duskSun(deg(31.4), 3340, 0), ph: { fov: 60, pitch: -25.8, roll: 0, quiet: 1 } },
    { at: ['story-2', 0], s: deg(32), h: 3400, yaw: 0, pitch: -37.8, roll: -82, fov: 46, quiet: 0.25, 'look.stars': 0.5, ...duskSun(deg(32), 3400, 0), ph: { fov: 60, pitch: -26.1, roll: 0, quiet: 1 } },
    { at: ['story-2', 1], s: deg(80), h: 2200, yaw: 8, pitch: -30.5, roll: -82, fov: 46, quiet: 0.25, 'look.stars': 0.5, ...duskSun(deg(80), 2200, 8), ph: { fov: 60, pitch: -18.8, roll: 0, quiet: 1 } },
    // story-3 (Charlie): coming down slowly over the night side, dusk still on the limb; it stays above ~300 (lower,
    // the air's blue band grows tall enough to stand behind the lines). On wide screens the camera levels out as it
    // comes down: the limb swings from the right down to a low horizon, never through the upper left where the lines
    // are read. The stars are back to full by the end (the channel carries on into the ventures)
    { at: ['story-3', 0], s: deg(100), h: 900, yaw: 0, pitch: -16.5, roll: -82, fov: 48, quiet: 0.6, 'look.stars': 0.5, ...duskSun(deg(100), 900, 0), ph: { fov: 62, pitch: -4.5, roll: 0, quiet: 1 } },
    { at: ['story-3', 1], s: deg(146), h: 320, yaw: -6, pitch: 0.4, roll: 0, fov: 48, quiet: 0, 'look.stars': 1, ...duskSun(deg(146), 320, -6), ph: { fov: 62, pitch: 11 } },
    // ventures: skimming the night sea before dawn, monoliths rising out of it; cursor and finger waves here
    { at: ['ventures', 0], s: deg(150), h: 3.2, yaw: 0, pitch: -5, fov: 50, ...FAR, ph: { fov: 64, pitch: -7 } },
    { at: ['ventures', 1], s: deg(150) + 60, h: 3.4, yaw: 0, pitch: -5, fov: 50, ...FAR, ph: { fov: 64, pitch: -7 } },
    // thesis: climb; the sea heats from 293 K to 1811 K below (the sun still well under the limb ahead)
    { at: ['thesis', 0], s: deg(151.5), h: 30, yaw: 0, pitch: 4, fov: 50, ...FAR, ph: { fov: 64, pitch: 8 } },
    // climb early, so the heating sea is seen from above (the hot metal reads as a planet, not a black strip)
    { at: ['thesis', 0.4], s: deg(153.5), h: 260, yaw: 0, pitch: -9, fov: 48, ...FAR, ph: { fov: 62, pitch: -6 } },
    { at: ['thesis', 1], s: deg(156), h: 480, yaw: 0, pitch: -6, fov: 46, ...FAR, ph: { fov: 60, pitch: -4 } },
    // shore: the sunrise over the limb, made by the climb (the horizon drops away under the sun ahead)
    { at: ['shore', 0], s: deg(158), h: 700, yaw: 0, pitch: -24, fov: 46, ...FAR, ph: { fov: 60, pitch: -22 } },
    { at: ['shore', 1], s: deg(160.5), h: 1300, yaw: 0, pitch: -27, fov: 46, ...FAR, ph: { fov: 60, pitch: -25 } },
    // dawn: across the day side high and fast, then the turn back to the setting sun; the last stretch is the hero's
    // own move (pulling back from the sun, low over the sea), so the seam is inside one continuous motion, and the core
    // comes in from the far sky along its own line of sight to hang over the sea again
    { at: ['dawn', 0], s: deg(235), h: 4600, yaw: 25, pitch: -38, fov: 46, ...FAR2, ph: { fov: 60 } },
    { at: ['loop', 0], dy: -0.6, s: LAP - 40, h: 8, yaw: 168, pitch: -1.5, fov: 46, ...FAR2, ph: { fov: 62, pitch: -3, yaw: 172 } },
    // loop: exactly the hero's first key, one lap on
    { at: ['loop', 0], s: LAP, h: 1.6, yaw: 162, pitch: -0.2, fov: 46, ...NEAR, sunV: LAP - 170, ph: { fov: 62, pitch: -2.7, yaw: 169.7 } },
  ];
}


/**
 * V2, the reference's dusk (plan/v2/reference-orbit.webp): sun channels that put the far sun `below` degrees under the
 * visible limb, straight along the camera's heading (s, h, yaw as in a key). From orbit the atmosphere then lights a
 * sunset line along the limb with the blue glow above it; low over the sea it is a sunset glow on the horizon ahead.
 */
export function duskSun(s: number, h: number, yaw: number, below = 4): Channels {
  const cam = cameraFrom(R, { s, h, yaw, pitch: 0, fov: 50 }, 1, 1);
  const dip = Math.acos(R / (R + h));
  const el = -dip - (below * Math.PI) / 180;
  const d = [0, 1, 2].map((i) => cam.f[i] * Math.cos(el) + cam.up[i] * Math.sin(el));
  const p = [0, 1, 2].map((i) => cam.pos[i] + d[i] * 1e6) as [number, number, number];
  const [u, v, y] = surfOf(R, p);
  return { sunU: u, sunV: v, sunY: y, sunR: 1.2e4 };
}

export type Anchor = { y: number; key: Key; ch: Channels };

/**
 * Resolves keys to scroll positions and full channel sets. `pinY(place, f)` gives the scroll position of a place's pin
 * fraction. Module channel defaults are merged in. Keys whose place is missing are dropped.
 */
export function resolve(
  list: Key[],
  pinY: (place: string, f: number) => number | null,
  vh: number,
  narrow: boolean,
  extras: Channels,
): Anchor[] {
  const base = { ...CAMERA_DEFAULTS, ...extras };
  // place every key, then sort by scroll position (module keys interleave with the lead's), then carry channels over
  const placed: { y: number; k: Key; i: number }[] = [];
  list.forEach((k, i) => {
    const y0 = pinY(k.at[0], k.at[1]);
    if (y0 != null) placed.push({ y: y0 + ((k.dy as number | undefined) ?? 0) * vh, k, i });
  });
  placed.sort((a, b) => a.y - b.y || a.i - b.i);
  const out: Anchor[] = [];
  let prev: Channels = base;
  for (const { y, k } of placed) {
    const ch: Channels = { ...prev };
    for (const [n, v] of Object.entries(k)) if (typeof v === 'number' && n !== 'dy') ch[n] = v;
    if (narrow && k.ph) Object.assign(ch, k.ph as Channels);
    prev = ch;
    out.push({ y, key: k, ch });
  }
  // keys at the same position: keep them a pixel apart (no cuts)
  for (let i = 1; i < out.length; i++) if (out[i].y <= out[i - 1].y) out[i].y = out[i - 1].y + 1;
  return out;
}

/** The lead's keys with each module's own keys swapped in for the places the module claims. */
export function mergeKeys(lead: Key[], mods: { keys?: (R: number) => Key[] }[]): Key[] {
  let list = lead;
  for (const m of mods) {
    if (!m.keys) continue;
    const mk = m.keys(R);
    const claimed = new Set(mk.map((k) => k.at[0]));
    list = list.filter((k) => !claimed.has(k.at[0])).concat(mk);
  }
  return list;
}

const EASE = {
  smooth: (t: number) => t * t * t * (t * (t * 6 - 15) + 10),
  linear: (t: number) => t,
  in: (t: number) => t * t * t,
  out: (t: number) => 1 - (1 - t) ** 3,
};

/** The segment the last evaluate() landed in: its keys' channels and the eased fraction (for channels that need their
 * own interpolation, like the sun). */
export const lastSeg: { a: Channels; b: Channels; e: number } = { a: CAMERA_DEFAULTS, b: CAMERA_DEFAULTS, e: 0 };

/** Channel values at scroll position y (within the lap). */
export function evaluate(anchors: Anchor[], y: number, into: Channels = {}): Channels {
  const n = anchors.length;
  if (!n) return Object.assign(into, CAMERA_DEFAULTS);
  if (y <= anchors[0].y || y >= anchors[n - 1].y) {
    const k = y <= anchors[0].y ? anchors[0] : anchors[n - 1];
    lastSeg.a = lastSeg.b = k.ch;
    lastSeg.e = 0;
    return Object.assign(into, k.ch);
  }
  let i = 0;
  while (i < n - 2 && y > anchors[i + 1].y) i++;
  const a = anchors[i],
    b = anchors[i + 1];
  const t = clamp((y - a.y) / (b.y - a.y));
  const e = EASE[(b.key.ease as Ease | undefined) ?? 'smooth'](t);
  lastSeg.a = a.ch;
  lastSeg.b = b.ch;
  lastSeg.e = e;
  for (const k in b.ch) {
    const va = a.ch[k] ?? b.ch[k],
      vb = b.ch[k];
    into[k] = LOG.has(k) ? Math.exp(Math.log(Math.max(va, 1e-3)) + (Math.log(Math.max(vb, 1e-3)) - Math.log(Math.max(va, 1e-3))) * e) : va + (vb - va) * e;
  }
  return into;
}
