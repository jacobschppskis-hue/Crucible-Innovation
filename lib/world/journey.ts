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
//   sunLon the sun's longitude round the great circle (degrees; the sun sits over the point at angle sunLon). Fixed in
//          the world by default (a real day passes in one lap); keyframe `sunLon` only for art direction and keep the
//          lap start/end equal mod 360.
//   sunLat the sun's latitude (degrees, + = right of the great circle)
//   sunSize the sun's angular diameter (degrees)
//   exposure (stops, 0 = neutral)
//   anything with a dot ('mark.size', 'lava.calm', ...): a module's own channel, default from its module's `channels`.
//
// Phones: a key's `ph` overrides its values when the layout is narrow.

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
  sunLon: -87,
  sunLat: 4,
  sunSize: 3.2,
  exposure: 0,
};

/** Channels interpolated in log space. */
const LOG = new Set(['h']);

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
  return [
    // hero: low over the molten sea at sunset, the sun (the mark's core) on the horizon, stars above it
    { at: ['hero', 0], s: 0, h: 1.6, yaw: 180, pitch: 4, fov: 46, ph: { fov: 62, pitch: 6 } },
    { at: ['hero', 1], s: 6, h: 1.9, yaw: 180, pitch: 4.5, fov: 46, ph: { fov: 62, pitch: 6.5 } },
    // stronger together: still on the sunset, a slow rise so the mark has the sky
    { at: ['together', 0], s: 10, h: 2.4, yaw: 180, pitch: 5, fov: 46, ph: { fov: 62, pitch: 7 } },
    { at: ['together', 1], s: 40, h: 6, yaw: 176, pitch: 6, fov: 46, ph: { fov: 62, pitch: 8 } },
    // story: turn away from the sun to the night sea, the type has the stars
    { at: ['story', 0], s: 120, h: 14, yaw: 40, pitch: 8, fov: 50, ph: { fov: 64 } },
    { at: ['story', 1], s: 900, h: 160, yaw: 10, pitch: -4, fov: 50, ph: { fov: 64 } },
    // paypal: high orbit over the night side, looking down at the planet (cosmic scale)
    { at: ['paypal', 0], s: deg(35), h: 2600, yaw: 0, pitch: -38, fov: 42, ph: { fov: 58, pitch: -48 } },
    { at: ['paypal', 1], s: deg(45), h: 2900, yaw: 0, pitch: -40, fov: 42, ph: { fov: 58, pitch: -50 } },
    // story-2 (the rest of Jacob's account): the limb and the stars from orbit
    { at: ['story-2', 0], s: deg(62), h: 3400, yaw: 0, pitch: -14, fov: 46, ph: { fov: 60 } },
    { at: ['story-2', 1], s: deg(100), h: 2200, yaw: 8, pitch: -12, fov: 46, ph: { fov: 60 } },
    // story-3 (Charlie): coming down over the night side
    { at: ['story-3', 0], s: deg(115), h: 900, yaw: 0, pitch: -16, fov: 48, ph: { fov: 62 } },
    { at: ['story-3', 1], s: deg(150), h: 60, yaw: -6, pitch: -8, fov: 48, ph: { fov: 62 } },
    // ventures: skimming the night sea, monoliths rising out of it; cursor and finger waves here
    { at: ['ventures', 0], s: deg(160), h: 3.2, yaw: 0, pitch: -6, fov: 50, ph: { fov: 64, pitch: -8 } },
    { at: ['ventures', 1], s: deg(160) + 60, h: 3.4, yaw: 0, pitch: -6, fov: 50, ph: { fov: 64, pitch: -8 } },
    // thesis: climb; the planet heats from 293 K to 1811 K below
    { at: ['thesis', 0], s: deg(170), h: 30, yaw: 0, pitch: -10, fov: 50, ph: { fov: 64 } },
    { at: ['thesis', 1], s: deg(200), h: 2400, yaw: 0, pitch: -24, fov: 46, ph: { fov: 60 } },
    // shore + dawn (the footer): the sunrise over the limb from orbit, then the day side at speed, coming down to the
    // evening terminator
    { at: ['shore', 0], s: deg(250), h: 3600, yaw: 0, pitch: -10, fov: 46, ph: { fov: 60 } },
    { at: ['dawn', 0], s: deg(345), h: 60, yaw: 150, pitch: 2, fov: 46, ph: { fov: 62 } },
    // loop: exactly the hero's first key, one lap on
    { at: ['loop', 0], s: LAP, h: 1.6, yaw: 180, pitch: 4, fov: 46, ph: { fov: 62, pitch: 6 } },
  ];
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
  const out: Anchor[] = [];
  let prev: Channels = base;
  for (const k of list) {
    const y0 = pinY(k.at[0], k.at[1]);
    if (y0 == null) continue;
    const y = y0 + (k.dy ?? 0) * vh;
    const ch: Channels = { ...prev };
    for (const [n, v] of Object.entries(k)) if (typeof v === 'number' && n !== 'dy') ch[n] = v;
    if (narrow && k.ph) Object.assign(ch, k.ph as Channels);
    // channels carry over from the previous key unless set (except camera channels, which every key should set)
    prev = ch;
    out.push({ y, key: k, ch });
  }
  // keep anchors in scroll order (equal y is a cut: avoid it, keys should be at least a few px apart)
  for (let i = 1; i < out.length; i++) if (out[i].y <= out[i - 1].y) out[i].y = out[i - 1].y + 1;
  return out;
}

const EASE = {
  smooth: (t: number) => t * t * t * (t * (t * 6 - 15) + 10),
  linear: (t: number) => t,
  in: (t: number) => t * t * t,
  out: (t: number) => 1 - (1 - t) ** 3,
};

/** Channel values at scroll position y (within the lap). */
export function evaluate(anchors: Anchor[], y: number, into: Channels = {}): Channels {
  const n = anchors.length;
  if (!n) return Object.assign(into, CAMERA_DEFAULTS);
  if (y <= anchors[0].y) return Object.assign(into, anchors[0].ch);
  if (y >= anchors[n - 1].y) return Object.assign(into, anchors[n - 1].ch);
  let i = 0;
  while (i < n - 2 && y > anchors[i + 1].y) i++;
  const a = anchors[i],
    b = anchors[i + 1];
  const t = clamp((y - a.y) / (b.y - a.y));
  const e = EASE[(b.key.ease as Ease | undefined) ?? 'smooth'](t);
  for (const k in b.ch) {
    const va = a.ch[k] ?? b.ch[k],
      vb = b.ch[k];
    into[k] = LOG.has(k) ? Math.exp(Math.log(Math.max(va, 1e-3)) + (Math.log(Math.max(vb, 1e-3)) - Math.log(Math.max(va, 1e-3))) * e) : va + (vb - va) * e;
  }
  return into;
}
