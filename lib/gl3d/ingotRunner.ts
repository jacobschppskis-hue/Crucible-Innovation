// A venture's live bar, DOM-free: it draws inside the ingot worker (ingotWorker.ts) or, where OffscreenCanvas WebGL2 is
// missing, on the main thread (ingotScene.ts). It keeps no clock and makes no motion of its own: the main frame of the
// one clock computes the pose (ingotPose.ts, on the liquid's grid) and the owner calls `frame(t, pose)`, which draws
// exactly that. The relief map (the stamp's lettering and mark) is drawn here too, so in the worker it never costs a
// main-thread task.
//
// Quality: render scale and an fps cap step down on slow frames and back up after a long calm run, but each level is
// retried at most once (a level that was slow twice is never used again), so it can't oscillate; a step scales the
// stage's offscreen target, never the canvas itself (ingotStage.ts `fixed`), so no step ever shows a blank frame.
// A GPU starts at full quality, software GL (CI, PageSpeed) at a low step; `full` (?liquid=full, screenshots) pins full
// quality; while a harness holds the clock nothing adapts.
import { buildIngot } from './ingotStage';
import { FRAME, type IngotPose } from './ingotPose';
import type { IngotKind } from './ingots';

// [render scale, fps cap (0 = every frame)]
const STEPS: [number, number][] = [[1, 0], [0.8, 0], [0.66, 0], [0.5, 30], [0.4, 24], [0.33, 15]];
const SOFT_START = 4;

export type IngotRunner = {
  /** Draw the frame for time t (s) at `pose`; `held`: a harness holds the clock (don't adapt). False = skipped (fps cap). */
  frame(t: number, pose: IngotPose, held: boolean): boolean;
  /** Long tasks keep landing on the main thread: step down. */
  down(): void;
  /** Call `cb` once the GPU has finished everything drawn so far (a fence, polled; never blocks). The worker acks a
   *  frame only then, so a GPU slower than the clock's ticks paces the ticks instead of queueing frame after frame. */
  afterGPU(cb: () => void): void;
  readonly q: number;
  dispose(): void;
};

/** Build the bar on `canvas` (throws if WebGL2 is missing). `css` is the canvas' CSS size (the owner keeps it current). */
export function createIngotRunner(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  kind: IngotKind,
  css: { w: number; h: number },
  opts: { dpr: number; full: boolean; onDrawn: () => void; onLost: () => void; onStep?: (q: number) => void },
): IngotRunner {
  const { stage, place } = buildIngot(canvas, kind, { quality: 1, dpr: Math.min(opts.dpr || 1, 2), css, fidelity: opts.full });
  const lost = (e: Event) => { e.preventDefault(); opts.onLost(); };
  canvas.addEventListener('webglcontextlost', lost);

  // ---- the governor ----
  const best0 = opts.full ? 0 : stage.soft ? SOFT_START : 0;
  let q = best0, best = best0;
  const retried = new Set<number>(); // levels entered again by a step up
  let slow = 0, calm = 0, cool = 0, last = 0, lastDraw = -1;
  const set = (n: number) => {
    q = n;
    stage.quality = STEPS[q][0];
    slow = 0; calm = 0; cool = 2;
    opts.onStep?.(q);
  };
  set(q);
  const stepDown = () => {
    if (opts.full || q >= STEPS.length - 1) return;
    if (retried.has(q)) best = q + 1; // slow again after a retry: never back to this level
    set(q + 1);
  };
  const adapt = (dt: number) => {
    const cap = STEPS[q][1], budget = cap ? 1 / cap : 1 / 60;
    cool -= dt;
    if (dt > budget * 1.7) { slow += 1; calm = 0; }
    else { slow = Math.max(0, slow - 0.5); calm += dt; }
    if (cool > 0) return;
    if (slow >= 10) stepDown();
    else if (calm > 8 && q > best && !retried.has(q - 1)) { retried.add(q - 1); set(q - 1); }
  };

  let drawn = false;
  const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null; // the stage's own context (same canvas, same type)
  return {
    get q() { return q; },
    frame(t, pose, held) {
      const cap = STEPS[q][1];
      if (cap && lastDraw >= 0 && t - lastDraw < (1 / cap) * 0.85 && t >= lastDraw) return false;
      const dt = last && t > last ? t - last : 0;
      last = t;
      if (!held && !opts.full && dt > 0 && dt < 0.5) adapt(dt);
      lastDraw = t;
      place(pose, FRAME / Math.max(1, css.h), t);
      stage.render();
      if (!drawn) { drawn = true; opts.onDrawn(); }
      return true;
    },
    down() { if (cool <= 0) stepDown(); },
    afterGPU(cb) {
      const sync = gl && !gl.isContextLost() ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!gl || !sync) { setTimeout(cb, 0); return; }
      gl.flush();
      const t0 = performance.now();
      const poll = () => {
        const r = gl.isContextLost() ? gl.WAIT_FAILED : gl.clientWaitSync(sync, 0, 0);
        // a fence that never signals (lost context, driver trouble) must not hold the clock: give up after 2 s
        if (r === gl.TIMEOUT_EXPIRED && performance.now() - t0 < 2000) { setTimeout(poll, 1); return; }
        if (!gl.isContextLost()) gl.deleteSync(sync);
        cb();
      };
      setTimeout(poll, 0);
    },
    dispose() { canvas.removeEventListener('webglcontextlost', lost); stage.dispose(); },
  };
}
