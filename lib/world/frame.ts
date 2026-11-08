// The per-frame state every module gets, and the small vector maths the engine and modules share.
// Framework-free: no React, no DOM writes here.

export type V3 = [number, number, number];

export const V = {
  add: (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: V3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: V3): V3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  /** a + b * s */
  madd: (a: V3, b: V3, s: number): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** 0..1 over [a, b] of x, linear, clamped. */
export const seg = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const TAU = Math.PI * 2;
/** Wrap an angle (radians) to (-PI, PI]. */
export const wrapPi = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

/** Journey channel values at this frame: camera channels plus any module's namespaced extras ('mark.size'). */
export type Channels = Record<string, number>;

export type Camera = {
  /** World position (planet centre is the origin). */
  pos: V3;
  /** Unit basis: right, up, forward (the view direction). */
  r: V3;
  u: V3;
  f: V3;
  /** Vertical field of view (degrees). */
  fov: number;
  /** Focal length in CSS px (so a screen point (x, y) is the ray r*(x-w/2)/focal - u*(y-h/2)/focal + f). */
  focal: number;
  /** Travel along the great circle (world units, unwrapped across laps), lateral offset, altitude above the sea. */
  s: number;
  x: number;
  h: number;
  /** The camera's angle round the planet, s / R, wrapped to [0, 2PI). */
  theta: number;
  /** Local frame at the ground point under the camera: up (planet normal), along (travel direction), across. */
  up: V3;
  along: V3;
  across: V3;
};

export type Quality = {
  /** Current step index (0 = best). */
  step: number;
  /** Render scale: render px per CSS px (DPR folded in). */
  scale: number;
  /** 0..1, 1 = best: modules scale their own work (octaves, march steps, taps) with it. */
  q: number;
  /** Software GL (SwiftShader, llvmpipe): starts low, never gives up. */
  software: boolean;
  /** ?world=full: top step pinned and every module at full fidelity (screenshots). */
  full: boolean;
};

export type SeaHit = {
  /** World point on the sea (radius R). */
  p: V3;
  /** Surface coords (u across, v along), the same as `Sea.w` in GLSL. */
  w: [number, number];
  /** Distance from the camera. */
  t: number;
};

export type PlaceInfo = {
  name: string;
  /** Section top in document px (unwrapped scroll space of lap 0). */
  top: number;
  /** Section height in px. */
  h: number;
  el: HTMLElement;
};

export type Frame = {
  /** Seconds on the one clock (lib/liquid/loop.ts), and this frame's dt (s, clamped to 0.1). */
  t: number;
  dt: number;
  frame: number;
  /** Viewport in CSS px, device pixel ratio, narrow = phone layout (< 761 px wide or portrait < 900). */
  w: number;
  h: number;
  dpr: number;
  narrow: boolean;
  /** Reduced motion / ?still: everything is a still, no idle motion, no input waves. */
  still: boolean;
  /** Smoothed scroll (CSS px, unwrapped: grows past `loopLen` on the next lap), the raw target, and the loop length
   * (the scroll position where the journey arrives back at the hero; 0 when the page does not loop). */
  scroll: number;
  scrollTarget: number;
  loopLen: number;
  /** Laps completed (floor(scroll / loopLen)); `y` is the scroll position within this lap (0..loopLen). */
  laps: number;
  y: number;
  /** Journey progress in this lap, 0..1 (y / loopLen; 0 and 1 are the same frame). */
  progress: number;
  /** The place the viewport is in and how far through it (0..1 of its pin: top at viewport top -> bottom at viewport bottom). */
  place: { name: string; f: number };
  /** Local progress (0..1, clamped) of any place's pin, on the smoothed scroll. */
  at(name: string): number;
  /** Section geometry by place name. */
  places: Record<string, PlaceInfo>;
  /** Journey channel values (camera + module extras). */
  ch: Channels;
  cam: Camera;
  /** Planet radius (world units). */
  R: number;
  /** Unit vector to the sun (world), its angular radius (rad). */
  sun: { dir: V3; rad: number };
  quality: Quality;
  /** Pointer (CSS px, viewport). `active` false when no pointer is over the page; `touch` for a finger. */
  pointer: { x: number; y: number; active: boolean; down: boolean; touch: boolean; lastMove: number };
  /** Ray (world, unit) through a viewport point (CSS px). */
  rayAt(x: number, y: number): V3;
  /** Where the ray through a viewport point meets the sea, or null (sky). */
  hitSea(x: number, y: number): SeaHit | null;
  /** Viewport CSS px [x, y] and view depth of a world point, or null if behind the camera. */
  project(p: V3): [number, number, number] | null;
  /** World point at surface coords (u across, v along) and height y above the sea. */
  surf(u: number, v: number, y?: number): V3;
  /** Surface coords and height of a world point (inverse of `surf`). */
  surfOf(p: V3): [number, number, number];
};
