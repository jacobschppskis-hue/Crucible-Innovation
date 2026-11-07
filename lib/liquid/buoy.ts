// Buoys for things drawn elsewhere (the 3D logo pieces, the ingots). DOM-free: runs on the main thread or in a worker.
// Feed it the surface under the object (a `Footprint`: field.ts `footprint()` on the main thread, or `footprintPatch()`
// on a posted height patch in a worker) every frame of the one clock; it returns a pose that follows the surface through
// a second-order spring per axis (no dead band, no hard clamps: a soft tanh limit on large waves only).

import type { Footprint } from './field';

/** px and radians. bob > 0: the surface under it is higher (a crest), so it rises. roll > 0: the surface rises towards
 *  +x (right). pitch > 0: it rises towards +y (down the page). dx, dy: drift down the slope (page px). */
export type Pose = { bob: number; roll: number; pitch: number; dx: number; dy: number };

export type BuoyOpts = {
  /** soft maxima: bob (px), tilt (rad), drift (px) */
  bob: number;
  tilt: number;
  drift: number;
  /** spring frequency (Hz) and damping ratio */
  f?: number;
  zeta?: number;
  /** input scales: a wave this high (px) / this steep (slope) gives ~76% of the maximum */
  h0?: number;
  s0?: number;
};

/** The strong level (logo pieces, ingots): the biggest motion on the page. */
export const STRONG: BuoyOpts = { bob: 9, tilt: 0.06, drift: 4.5, f: 0.8, zeta: 0.7, h0: 7, s0: 0.05 };

export function buoy3(o: BuoyOpts = STRONG) {
  const w = 2 * Math.PI * (o.f ?? 0.8);
  const z = o.zeta ?? 0.7;
  const h0 = o.h0 ?? 7;
  const s0 = o.s0 ?? 0.05;
  const x = new Float64Array(5); // bob, roll, pitch, dx, dy
  const v = new Float64Array(5);
  const tg = new Float64Array(5);
  const pose: Pose = { bob: 0, roll: 0, pitch: 0, dx: 0, dy: 0 };
  return {
    pose,
    /** Advance by dt seconds toward the surface `fp`; `calm` (0..1) scales the targets (e.g. 0 while someone types). */
    step(fp: Footprint, dt: number, calm = 1): Pose {
      tg[0] = o.bob * Math.tanh(fp.h / h0) * calm;
      tg[1] = o.tilt * Math.tanh(fp.roll / s0) * calm;
      tg[2] = o.tilt * Math.tanh(fp.pitch / s0) * calm;
      tg[3] = -o.drift * Math.tanh(fp.gx / s0) * calm;
      tg[4] = -o.drift * Math.tanh(fp.gy / s0) * calm;
      const n = Math.max(1, Math.ceil(Math.min(dt, 0.1) / 0.008));
      const h = Math.min(dt, 0.1) / n;
      for (let s = 0; s < n; s++) {
        for (let i = 0; i < 5; i++) {
          v[i] += (w * w * (tg[i] - x[i]) - 2 * z * w * v[i]) * h;
          x[i] += v[i] * h;
        }
      }
      pose.bob = x[0];
      pose.roll = x[1];
      pose.pitch = x[2];
      pose.dx = x[3];
      pose.dy = x[4];
      return pose;
    },
    reset() {
      x.fill(0);
      v.fill(0);
      pose.bob = pose.roll = pose.pitch = pose.dx = pose.dy = 0;
    },
  };
}
