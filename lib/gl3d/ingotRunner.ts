// A venture's live ingot, DOM-free: it runs inside the ingot worker (ingotWorker.ts) or, where OffscreenCanvas WebGL2
// is missing, on the main thread (ingotScene.ts). Everything it needs from the page arrives in `IngotEnv`; the relief
// maps (lettering, lattice) are drawn here too, so in the worker they never cost a main-thread task.
import { clock } from '../liquid/loop';
import { sample } from '../liquid/field';
import { buildIngot, PITCH, ROLL } from './ingotPose';
import type { IngotKind } from './ingots';
import { createAdapt } from './adapt';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const YAW = 1.3; // radians of turn from one edge of the viewport to the other (about 75°)
const SLOPE_GAIN = 300; // wave slope (per px) → tilt (rad), then clamped
const DRIFT = 9000; // wave slope → buoy drift (world units), then clamped
const BOB = 26; // wave height → world units

/** What the page tells the ingot (client px): the host's box now, the viewport, the scroll, and whether it travels sideways. */
export type IngotEnv = {
  /** The canvas' CSS layout size (an OffscreenCanvas has none; the owner updates it in place). */
  css: { w: number; h: number };
  rect: { left: number; top: number; width: number; height: number };
  vw: number;
  vh: number;
  scrollX: number;
  scrollY: number;
  /** The ingot travels sideways (the pinned track) rather than up the page: decides what "scrolling through" means. */
  across: boolean;
};
export type IngotRunner = { frame(t: number): void; down(): void; dispose(): void };

/** Build the ingot on `canvas` (throws if WebGL2 is missing). The owner calls `frame(t)` from its own loop. `emit` adds a small ripple to the page liquid. */
export function createIngotRunner(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  kind: IngotKind,
  env: IngotEnv,
  opts: { dpr: number; full: boolean; emit: (x: number, docY: number, amp: number, size: number, t: number) => void; onDrawn: () => void; onLost: () => void },
): IngotRunner {
  const { stage, root, hot } = buildIngot(canvas, kind, { quality: 1, dpr: Math.min(opts.dpr || 1, 2), css: env.css, fidelity: opts.full });
  // Software GL starts at a low step; slow frames (and the main thread's long-task watchdog) step it down further, never giving up.
  const adapt = createAdapt(stage, opts.full);
  const lost = (e: Event) => { e.preventDefault(); opts.onLost(); };
  canvas.addEventListener('webglcontextlost', lost);
  let yaw = 0, bob = 0, tx = 0, ty = 0, rx = 0, rz = 0;
  let nextRipple = clock.t + 1 + Math.random() * 2;
  let first = true;
  let drawn = false;
  let lastDraw = 0;
  const frame = (t: number) => {
    const r = env.rect;
    const vw = env.vw, vh = env.vh;
    if (r.top + r.height < -vh * 0.2 || r.top > vh * 1.2 || r.left + r.width < -vw * 0.2 || r.left > vw * 1.2) return;
    if (!adapt.allow(t)) return;
    const dt = lastDraw ? Math.min(0.5, t - lastDraw) : 1 / 60; // wall-clock: a slow software-GL frame still lands the turn on time
    lastDraw = t;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const u = env.across ? (cx - vw / 2) / vw : (cy - vh / 2) / vh;
    const px = cx + env.scrollX, py = cy + env.scrollY;
    const s = sample(px, py, t);
    // Spring everything toward its target (critically damped-ish), so a wave's slope rocks it rather than snapping it.
    const k = first ? 1 : 1 - Math.exp(-dt * 7);
    first = false;
    yaw += (clamp(-u * YAW, -0.95, 0.95) - yaw) * (1 - Math.exp(-dt * 10));
    bob += (s.h * BOB - bob) * k;
    rx += (clamp(s.gy * SLOPE_GAIN, -0.05, 0.05) - rx) * k;
    rz += (clamp(-s.gx * SLOPE_GAIN, -0.05, 0.05) - rz) * k;
    tx += (clamp(s.gx * DRIFT, -8, 8) - tx) * (1 - Math.exp(-dt * 2.5));
    ty += (clamp(-s.gy * DRIFT * 0.5, -4, 4) - ty) * (1 - Math.exp(-dt * 2.5));
    root.position = [tx, bob + ty, 0];
    root.rotation = [PITCH + rx, yaw, ROLL + rz];
    if (hot) hot.temp = 0.3 + 0.05 * Math.sin(t * 1.3 + (kind === 'verge' ? 0 : 2));
    // Its own small ripples, a few seconds apart.
    if (t > nextRipple) {
      nextRipple = t + 2.2 + Math.random() * 1.8;
      opts.emit(px + (Math.random() - 0.5) * r.width * 0.5, py + r.height * 0.3, 0.22, 10, t);
    }
    stage.render();
    if (!drawn) { drawn = true; opts.onDrawn(); }
  };
  return { frame, down: adapt.down, dispose: () => { canvas.removeEventListener('webglcontextlost', lost); stage.dispose(); } };
}
