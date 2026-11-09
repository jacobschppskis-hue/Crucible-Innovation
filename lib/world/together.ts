// "Stronger together" (role: mark). Framework-free.
//
// A confluence on the molten sea: two rivers of molten metal run toward each other across the sea below the camera and
// join into one river that runs on hotter, so it glows brighter and more yellow (colour means temperature: the joined
// river is literally the stronger one). The logo stays whole and still in the sky; nothing goes round in a circle.
// The rivers are heat added to lava's own sea (the `sea` hook in lib/world/glsl/mark.glsl, SeaMod.heat), so they are
// the world's own material. Everything is a pure function of the `together` place's pin progress (reversible), with
// one line of copy when they meet.

import type { Key } from './journey';

export const BEAT = {
  flow: 0.08, // the two rivers start to run
  meet: 0.45, // they meet
  joinFrom: 0.48, // the joined river runs on toward the viewer...
  joinTo: 0.85, // ...and has arrived
} as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** How far each source river has run (0..1 of its length): it gathers speed, like anything flowing downhill. */
export function sourceFront(b: number) {
  const u = clamp01((b - BEAT.flow) / (BEAT.meet - BEAT.flow));
  return 0.35 * u + 0.65 * u * u;
}
/** How far the joined river has run (0..1). */
export function joinedFront(b: number) {
  return smooth(BEAT.joinFrom, BEAT.joinTo, b);
}
/** The flash where they meet, 0..1. */
export function meetFlash(b: number) {
  return smooth(BEAT.meet - 0.01, BEAT.meet + 0.02, b) * (1 - smooth(BEAT.meet + 0.04, BEAT.meet + 0.14, b));
}

/** The one line: it arrives when the rivers meet and stays while the section is pinned. */
export const LINES = [{ id: 'together', text: 'Stronger together', from: 0.47, in: 0.56 }] as const;
export function lineOpacity(i: number, b: number) {
  const L = LINES[i];
  return L ? smooth(L.from, L.in, b) : 0;
}

/** The together camera: from the hero's last framing it rises and tips down onto the sea, so the rivers below are
 *  seen whole (the zoomed-in sea Jacob likes just past the headline), then holds while they join. */
const NEAR = { sunU: 0, sunV: -170, sunY: 34, sunR: 4.0 };
export function togetherKeys(): Key[] {
  return [
    // the mark fades as the camera tips down off it (it would otherwise slide up half under the nav), and comes back
    // round the far sun as the journey climbs into story
    { at: ['together', 0], s: 8, h: 2.2, yaw: 180, pitch: -0.5, fov: 46, ...NEAR, 'mark.vis': 1, ph: { fov: 62, pitch: -2 } },
    { at: ['together', 0.22], s: 12, h: 18, yaw: 180, pitch: -16, fov: 48, ...NEAR, 'mark.vis': 0, ph: { fov: 63, pitch: -20 } },
    { at: ['together', 0.3], s: 14, h: 30, yaw: 180, pitch: -26, fov: 50, ...NEAR, 'mark.vis': 0, ph: { fov: 64, pitch: -31 } },
    { at: ['together', 1], s: 22, h: 44, yaw: 180, pitch: -29, fov: 50, ...NEAR, 'mark.vis': 0, ease: 'linear', ph: { fov: 64, pitch: -34 } },
  ];
}
