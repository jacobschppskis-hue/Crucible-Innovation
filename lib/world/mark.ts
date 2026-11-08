// The hero's mark in the world (role: mark). Framework-free. The world calls `markFrame()` once per clock tick with
// where the mark hangs (the journey decides: in the hero the core is the sun over the sunset sea) and the beat's
// progress; it gets back the uniforms for lib/world/glsl/mark.glsl and what the rest of the world needs from the mark
// (the core as a light, the heat for the sea's glitter, a ring request when the weld flashes).
import { coreFlare, heatAmount, heatColor, seaRing, weldFlash } from './together';
import { MARK_GLSL } from './glsl/mark';

export { MARK_GLSL };
export type Vec3 = [number, number, number];

export type MarkPlace = {
  /** the core's centre (world) */
  centre: Vec3;
  /** world units per mark unit (the outer ring's radius is 26.67 mark units; the whole mark spans 57.6) */
  scale: number;
  /** the mark's axes in world space: right, up, toward the viewer (orthonormal). Usually facing the camera. */
  right: Vec3;
  up: Vec3;
  out: Vec3;
  /** 0..1: fades the whole mark and core (e.g. as the journey leaves the hero) */
  visible?: number;
};

export type MarkInput = {
  place: MarkPlace;
  /** the stronger-together beat's progress, 0..1 (scroll; 0 before it starts, 1 after it ends) */
  beat: number;
  /** the one clock, seconds */
  t: number;
  /** fill light: the sky above the mark and the sea below it, linear radiance (from look/lava; defaults are a dusk
   *  sky over a glowing sea) */
  skyFill?: Vec3;
  seaFill?: Vec3;
  /** quality step 0 (lowest) .. 1: the soft shadows toward the core cost the most and go first */
  quality?: number;
};

export type MarkUniforms = {
  uMarkC: [number, number, number, number];
  uMarkB: number[]; // mat3, column-major
  uMarkBeat: [number, number, number, number];
  uMarkLook: [number, number, number, number];
  uMarkSky: Vec3;
  uMarkSea: Vec3;
};

export type MarkFrame = {
  uniforms: MarkUniforms;
  /** the core as a light for the rest of the world */
  core: { pos: Vec3; radius: number; radiance: Vec3 };
  /** linear colour of the hot metal now (0 when cold): the sea's glitter under the mark takes this tint */
  heat: Vec3;
  /** 0..1: how much of the mark glows (for bloom strength) */
  heatAmount: number;
  /** > 0 on the frame the weld flashes: the world sends one ring across the sea under the core */
  ring: number;
};

const CORE_R = 4.8; // mark units (lib/splitRing.ts: RING.core 3.6 on the 48 grid, ×4/3)
const CORE_L: Vec3 = [9.0, 4.6, 1.9];

export function markFrame(i: MarkInput): MarkFrame {
  const b = i.beat < 0 ? 0 : i.beat > 1 ? 1 : i.beat;
  const { centre, scale, right, up, out } = i.place;
  const vis = i.place.visible ?? 1;
  const flare = coreFlare(b);
  const q = i.quality ?? 1;
  const k = (1 + flare) * 1;
  return {
    uniforms: {
      uMarkC: [centre[0], centre[1], centre[2], scale],
      uMarkB: [...right, ...up, ...out],
      uMarkBeat: [b, weldFlash(b), flare, i.t],
      uMarkLook: [vis, 1, q >= 0.5 ? 1 : q > 0.2 ? 0.6 : 0, 0],
      uMarkSky: i.skyFill ?? [0.2, 0.22, 0.27],
      uMarkSea: i.seaFill ?? [0.95, 0.66, 0.44],
    },
    core: { pos: centre, radius: CORE_R * scale, radiance: [CORE_L[0] * k, CORE_L[1] * k, CORE_L[2] * k] },
    heat: heatColor(b),
    heatAmount: heatAmount(b),
    ring: seaRing(b),
  };
}

/** A mark place facing a camera: the mark's plane square to the line of sight, upright (its up is the world's up made
 *  square to the line of sight), and reading left-to-right on screen whatever the world's handedness: `screenRight` is
 *  the camera's right vector. */
export function facing(centre: Vec3, scale: number, camera: Vec3, screenRight: Vec3, worldUp: Vec3 = [0, 1, 0]): MarkPlace {
  const o = norm(sub(camera, centre));
  const u0 = sub(worldUp, mul(o, dot(worldUp, o)));
  const u = len(u0) < 1e-6 ? norm(sub(screenRight, mul(o, dot(screenRight, o)))) : norm(u0);
  let r = sub(screenRight, add(mul(o, dot(screenRight, o)), mul(u, dot(screenRight, u))));
  if (len(r) < 1e-6) r = cross(u, o);
  return { centre, scale, right: norm(r), up: u, out: o };
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
