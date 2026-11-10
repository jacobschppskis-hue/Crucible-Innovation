// The liquid's public face for everything that floats on it.
//
// v2: the surface is the wave grid in sim.ts (main thread) plus the analytic idle swell in swell.ts. Everything that
// floats reads it in CSS px through `samplePx` / `sampleGrid` / `footprint` (see .board/v2/a/API.md): the DOM floaters
// (float.ts), and the 3D logo pieces and ingots, whose poses are computed on the main thread and posted to their
// renderers with the clock's tick (lib/gl3d/ingotPose.ts). There is no second, interim wave model.

import { clock } from './loop';
import { swellAt, type HG } from './swell';
import type { Sim } from './sim';

export type { HG } from './swell';

// ---- v2: the grid (main thread) ----------------------------------------------------------------------------------

let sim: Sim | null = null;
/** render.ts attaches the running simulation (null when it stops). */
export function attachSim(s: Sim | null) {
  sim = s;
}
export const simRunning = () => !!sim;

/** Clock time of the last wave the visitor made (move, tap, finger, scroll; not ripples of floating things). */
export const activity = { last: -9 };

const tmp: HG = { h: 0, gx: 0, gy: 0 };
const sw: HG = { h: 0, gx: 0, gy: 0 };

/** Interaction waves only (the grid: drops and the wake), px. Zero where nothing has touched the liquid lately. */
export function sampleGrid(x: number, docY: number, out: HG = { h: 0, gx: 0, gy: 0 }): HG {
  if (!sim) {
    out.h = out.gx = out.gy = 0;
    return out;
  }
  return sim.sample(x, docY, out);
}

/** The whole surface in px: grid + idle swell (what text, headings and blocks ride). */
export function samplePx(x: number, docY: number, t = clock.t, out: HG = { h: 0, gx: 0, gy: 0 }): HG {
  sampleGrid(x, docY, tmp);
  swellAt(x, docY, t, sw);
  out.h = tmp.h + sw.h;
  out.gx = tmp.gx + sw.gx;
  out.gy = tmp.gy + sw.gy;
  return out;
}

export type Footprint = { h: number; gx: number; gy: number; roll: number; pitch: number };

/**
 * The surface under a floating box (page px rect), averaged the way a raft feels it: mean height and slope over a few
 * points across it, and the tilt of the best plane through them (roll: along x, pitch: along y, as slopes). Short
 * ripples average out under a long box; long waves tilt it. `swell: false` = interaction waves only (controls).
 */
export function footprint(x: number, y: number, w: number, h: number, o: { swell: boolean; t?: number }, out: Footprint): Footprint {
  const t = o.t ?? clock.t;
  const nx = w > 240 ? 5 : w > 60 ? 3 : 1;
  const ny = h > 160 ? 3 : h > 70 ? 2 : 1;
  let sh = 0, sgx = 0, sgy = 0, sxh = 0, sxx = 0, syh = 0, syy = 0, n = 0;
  const cx = x + w / 2;
  const cy = y + h / 2;
  for (let b = 0; b < ny; b++) {
    const py = ny === 1 ? cy : y + h * (0.15 + (0.7 * b) / (ny - 1));
    for (let a = 0; a < nx; a++) {
      const px = nx === 1 ? cx : x + w * (0.08 + (0.84 * a) / (nx - 1));
      if (o.swell) samplePx(px, py, t, tmp);
      else sampleGrid(px, py, tmp);
      sh += tmp.h;
      sgx += tmp.gx;
      sgy += tmp.gy;
      const dx = px - cx;
      const dy = py - cy;
      sxh += dx * tmp.h;
      sxx += dx * dx;
      syh += dy * tmp.h;
      syy += dy * dy;
      n++;
    }
  }
  out.h = sh / n;
  out.gx = sgx / n;
  out.gy = sgy / n;
  // plane fit (independent axes: the points are a grid); a single point falls back to its own slope
  out.roll = sxx > 0 ? sxh / sxx : out.gx;
  out.pitch = syy > 0 ? syh / syy : out.gy;
  return out;
}

/**
 * The surface over a rectangle (page px) as an nx x ny lattice of heights (px), for a worker that floats several things
 * over one area (lib/liquid/patch.ts samples it there exactly like `footprint` here). Main thread only.
 */
export function heightPatch(x: number, y: number, w: number, h: number, nx: number, ny: number, o: { swell: boolean; t?: number }, out?: Float32Array) {
  const t = o.t ?? clock.t;
  const data = out && out.length === nx * ny ? out : new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const py = y + (h * j) / Math.max(1, ny - 1);
    for (let i = 0; i < nx; i++) {
      const px = x + (w * i) / Math.max(1, nx - 1);
      data[j * nx + i] = o.swell ? samplePx(px, py, t, tmp).h : sampleGrid(px, py, tmp).h;
    }
  }
  return { x, y, w, h, nx, ny, data };
}

// ---- wave sources posted from outside the grid -------------------------------------------------------------------

/** How long (s) a posted source counts as live (`liveCount`, the liquid canvas' data-live). */
export const LIFE = 4;

const SLOTS = 64;
const posted = new Float64Array(SLOTS).fill(-1e9); // birth times of the coarse pointer trace input.ts posts
let pi = 0;
let liveFloats: number[] = [];

let floatSink: ((x: number, y: number, amp: number, size: number, t: number) => void) | null = null;
/** render.ts: where ripples of floating things go (the grid). */
export function setFloatSink(f: typeof floatSink) {
  floatSink = f;
}

const nowT = () => (typeof performance === 'undefined' ? clock.t : Math.max(clock.t, performance.now() / 1000));

/**
 * A wave source at page px (x, docY). `kind: 'float'`: a floating thing's own ripple (a logo piece, an ingot, a DOM
 * floater, the pour's splashes) becomes a small ringing drop in the grid. `kind: 'ring'` (the coarse pointer trace
 * input.ts still posts) is only counted: the grid already has those waves from input.ts itself.
 */
export function addSource(x: number, docY: number, amp = 0.6, size = 24, opts: { kind?: 'ring' | 'float'; t?: number } = {}) {
  const t0 = opts.t ?? nowT();
  if (opts.kind === 'float') {
    floatSink?.(x, docY, amp, size, t0);
    liveFloats.push(t0);
  } else posted[pi++ % SLOTS] = t0;
}

/** Posted sources alive now (the pointer trace + ripples of floating things). */
export function liveCount(t = clock.t) {
  let n = 0;
  for (let i = 0; i < SLOTS; i++) if (t - posted[i] < LIFE && t >= posted[i]) n++;
  if (liveFloats.length && liveFloats[0] < t - LIFE) liveFloats = liveFloats.filter((v) => v >= t - LIFE);
  return n + liveFloats.length;
}
