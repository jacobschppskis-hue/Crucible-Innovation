// The liquid's public face for everything that floats on it.
//
// v2: the surface is the wave grid in sim.ts (main thread) plus the analytic idle swell in swell.ts. DOM floaters and the
// harness read it in CSS px through `samplePx` / `sampleGrid` / `footprint` (see float.ts and .board/v2/a/API.md).
//
// The 3D workers (logo, ingots) have no grid yet. Until they move onto it (main-thread poses from `footprint`), they
// keep the v1 API below, `sample(x, docY)` -> {h, gx, gy} in v1 units, computed from the swell plus a light model of the
// sources the page posts them (taps and a coarse trace of the pointer, as expanding rings). Ripples that floating things
// shed (`kind: 'float'`) are drawn in the liquid but never read back by this model, so nothing is rocked by its own
// ripples. The same model runs on the main thread, so a 3D runner on the main-thread fallback moves exactly as in its worker.

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

/** Glints are capped behind these (page px rects [x, y, w, h, level 0..255]): text and portraits. float.ts keeps it
 *  current, render.ts rasterises it into the grid's mask. */
export const textMask: { rects: number[]; version: number } = { rects: [], version: 0 };

/** Clock time of the last wave the visitor made (move, tap, finger, scroll; not ripples of floating things). */
export const activity = { last: -9 };

const tmp: HG = { h: 0, gx: 0, gy: 0 };
const sw: HG = { h: 0, gx: 0, gy: 0 };

/** Interaction waves only (the grid), px. Zero where nothing has touched the liquid lately. */
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

// ---- v1 API (3D runners, interim) --------------------------------------------------------------------------------

/** v1 units = px * K_LEGACY for the swell: gentle enough that the 3D runners' slope gains (e.g. the ingots' 300 rad per unit
 *  slope, clamped at 0.05) never saturate on the swell alone (v1's bang-bang tilt). A posted tap ring is ~1, as in v1. */
export const K_LEGACY = 0.0015;
export const LIFE = 4; // s a posted source lives
export const SPEED = 420; // px/s, same as the grid's waves
const DISP = 0.8;
const DECAY = 0.45;
const SPREAD = 80;

export type Source = { x: number; y: number; t0: number; amp: number; size: number; f?: boolean };
export type Sample = { h: number; gx: number; gy: number };

/** Every new source is passed on (the 3D scenes forward them to their workers). */
export const hooks: { onAdd: ((s: Source, kind: 'ring' | 'float') => void) | null; also: Set<(s: Source, kind: 'ring' | 'float') => void> } = { onAdd: null, also: new Set() };

const RING_SLOTS = 64;
const rings: (Source | null)[] = new Array(RING_SLOTS).fill(null);
let ri = 0;
let liveFloats: number[] = [];

let floatSink: ((x: number, y: number, amp: number, size: number, t: number) => void) | null = null;
/** render.ts: where ripples of floating things go (the grid). */
export function setFloatSink(f: typeof floatSink) {
  floatSink = f;
}

const nowT = () => (typeof performance === 'undefined' ? clock.t : Math.max(clock.t, performance.now() / 1000));

/**
 * A wave source at page px (x, docY): `kind: 'ring'` (taps and the pointer's coarse trace, posted by input.ts) feeds the
 * interim model; `kind: 'float'` (a floating thing's own ripple: the logo, an ingot, the pour) is drawn in the liquid
 * and never read back by the model.
 */
export function addSource(x: number, docY: number, amp = 0.6, size = 24, opts: { kind?: 'ring' | 'float'; t?: number } = {}) {
  const s: Source = { x, y: docY, t0: opts.t ?? nowT(), amp, size, f: opts.kind === 'float' };
  if (s.f) {
    floatSink?.(x, docY, amp, size, s.t0);
    liveFloats.push(s.t0);
  } else rings[ri++ % RING_SLOTS] = s;
  const kind = s.f ? 'float' : 'ring';
  hooks.onAdd?.(s, kind);
  for (const f of hooks.also) f(s, kind);
}

const out: Sample = { h: 0, gx: 0, gy: 0 };

/** v1-compatible: surface height and slope (v1 units) at page px, from the swell and the posted rings. */
export function sample(x: number, docY: number, t = clock.t): Sample {
  swellAt(x, docY, t, sw);
  let h = sw.h * K_LEGACY;
  let gx = sw.gx * K_LEGACY;
  let gy = sw.gy * K_LEGACY;
  for (const s of rings) {
    if (!s) continue;
    const age = t - s.t0;
    if (age < 0 || age >= LIFE) continue;
    const dx = x - s.x;
    const dy = docY - s.y;
    const r = Math.hypot(dx, dy);
    const sig = s.size * (1 + DISP * age);
    const R = SPEED * age;
    const d = r - R;
    if (Math.abs(d) > 3 * sig) continue;
    // a ring hump that fades in over its first 80 ms (no step when it is born) and out over its life
    const born = Math.min(1, age / 0.08);
    const A = (s.amp * born * Math.exp(-DECAY * age) * (1 - (age / LIFE) ** 4)) / Math.sqrt((1 + R / SPREAD) * (1 + DISP * age));
    const e = Math.exp(-0.5 * (d / sig) * (d / sig));
    h += A * e;
    const dh = (A * e * -(d / (sig * sig))) / Math.max(r, 0.001);
    gx += dh * dx;
    gy += dh * dy;
  }
  out.h = h;
  out.gx = gx;
  out.gy = gy;
  return out;
}

/** Posted sources alive now (rings + floats), for v1 callers. */
export function liveCount(t = clock.t) {
  let n = 0;
  for (const s of rings) if (s && t - s.t0 < LIFE && t >= s.t0) n++;
  if (liveFloats.length && liveFloats[0] < t - LIFE) liveFloats = liveFloats.filter((v) => v >= t - LIFE);
  return n + liveFloats.length;
}
