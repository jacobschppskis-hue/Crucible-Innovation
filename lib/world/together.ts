// "Stronger together": the hero's beat after the headline (role: mark). Framework-free.
//
// Jacob's logo is two rings, half drawn as continuous lines and half as pixels, meeting at an orange core: "The human
// half and the machine half." The beat shows why they belong together without ever taking the mark apart: two runs of
// molten metal leave the top together, one down the arcs (one continuous line), one filling the squares one at a time
// (steps). Neither half closes the ring alone; they meet at the bottom, the weld flashes, heat runs back up both halves
// at once and the whole ring blazes, then it sets to bone in the order it was poured. Everything is a pure function of
// the beat's progress (scroll), so it plays backwards exactly; nothing moves.
//
// The GLSL side (lib/world/glsl/mark.glsl) reads the same beat; keep the constants below and `MK_POUR`/`MK_MEET` there
// in step.

export const BEAT = {
  pour: 0.08, // the runs leave the top
  meet: 0.6, // both reach the bottom: the weld
  blaze: 0.66, // heat has run back up both halves: the whole ring blazes
  setFrom: 0.7, // the bone set front starts at the top...
  setTo: 0.95, // ...and has reached the weld
  done: 0.97, // nothing hot is left
} as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Angle the runs have reached, from the top (0) to the bottom (π): accelerating, as if by gravity. */
export function runAngle(b: number) {
  const u = clamp01((b - BEAT.pour) / (BEAT.meet - BEAT.pour));
  return Math.PI * (0.3 * u + 0.7 * u * u);
}
/** The weld's flash at the bottom, 0..1 (a short pulse right after the runs meet). */
export function weldFlash(b: number) {
  return smooth(BEAT.meet - 0.005, BEAT.meet + 0.01, b) * (1 - smooth(BEAT.meet + 0.015, BEAT.meet + 0.07, b));
}
/** The core (the sun) flares with the blaze, 0..1. The sea answers with one ring when it peaks (see `seaRing`). */
export function coreFlare(b: number) {
  return smooth(BEAT.meet, BEAT.meet + 0.05, b) * (1 - smooth(BEAT.meet + 0.08, BEAT.meet + 0.3, b));
}
/** How much of the mark is hot, 0..1 (for the sea's glitter tint and the bloom): rises with the pour, peaks in the
 *  blaze, falls as it sets. */
export function heatAmount(b: number) {
  if (b <= BEAT.pour || b >= BEAT.done) return 0;
  const pour = runAngle(b) / Math.PI;
  const blaze = smooth(BEAT.meet, BEAT.blaze, b);
  const set = smooth(BEAT.setFrom, BEAT.setTo, b);
  return clamp01((0.35 * pour + 0.65 * blaze) * (1 - set));
}
/** A rough linear colour of the hot metal (what the sea mirrors), from blackbody at the beat's mean temperature. */
export function heatColor(b: number): [number, number, number] {
  const k = heatAmount(b);
  const f = weldFlash(b);
  // orange body, toward yellow-white in the flash
  return [1.6 * k + 1.2 * f, 0.42 * k + 0.75 * f, 0.06 * k + 0.35 * f];
}
/** One ring across the sea when the weld flashes: true for the frame the beat crosses `meet` going forward. The world
 *  turns it into a ripple under the core (lava's ring source). Returns 0 or the ring's strength. */
let lastB = 0;
export function seaRing(b: number) {
  const fire = lastB < BEAT.meet && b >= BEAT.meet;
  lastB = b;
  return fire ? 1 : 0;
}

/** The captions, as opacity 0..1 per line at the beat's progress (display lines: no periods; unslop). Each line
 *  arrives with the run it names and they hand over to the payoff when the ring closes. */
export const LINES = [
  { id: 'human', text: 'The human half', from: 0.1, in: 0.18, out: 0.56, gone: 0.62 },
  { id: 'machine', text: 'The machine half', from: 0.2, in: 0.28, out: 0.56, gone: 0.62 },
  { id: 'together', text: 'Stronger together', from: 0.6, in: 0.66, out: 2, gone: 3 }, // stays: it leaves with the section
] as const;
export function lineOpacity(i: number, b: number) {
  const L = LINES[i];
  return smooth(L.from, L.in, b) * (1 - smooth(L.out, L.gone, b));
}
