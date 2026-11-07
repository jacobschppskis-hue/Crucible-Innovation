// Quality steps for a 3D scene: render scale and an fps cap. A GPU starts at full quality; software GL (SwiftShader,
// llvmpipe: CI, PageSpeed, VMs) starts at a low step. Slow frames, or the main-thread long-task watchdog, step down
// further; a long calm run steps back up (never above the start step). It never gives up. `full` (?liquid=full, for
// our own screenshot checks) pins quality 1 with no cap and no adaptation. DOM-free: runs in the worker too.
import type { Stage } from './core';

// [render scale, fps cap (0 = every frame)]
const STEPS: [number, number][] = [[1, 0], [0.8, 0], [0.6, 0], [0.5, 0], [0.4, 24], [0.3, 15], [0.25, 10]];
const SOFT_START = 5;

export type Adapt = {
  /** Call once per rAF with the frame time (s): returns false when this frame is skipped (fps cap). Adapts on the way. */
  allow(t: number): boolean;
  /** Long tasks keep landing on the main thread: step down now. */
  down(): void;
};

export function createAdapt(stage: Stage, full: boolean): Adapt {
  if (full) {
    stage.quality = 1;
    return { allow: () => true, down() {} };
  }
  const qMin = stage.soft ? SOFT_START : 0;
  let q = qMin;
  stage.quality = STEPS[q][0];
  let last = 0;
  let slow = 0;
  let fast = 0;
  let cool = 0;
  const set = (n: number) => {
    q = n;
    stage.quality = STEPS[q][0];
    slow = fast = 0;
    cool = 1.5;
  };
  return {
    allow(t) {
      const tgt = STEPS[q][1] ? 1 / STEPS[q][1] : 0;
      if (last && t - last < tgt * 0.85) return false;
      const dt = last && t - last < 0.5 ? t - last : 1 / 60;
      last = t;
      cool -= dt;
      if (dt > (tgt ? tgt * 1.6 : 0.03)) {
        slow++;
        fast = 0;
      } else {
        slow = Math.max(0, slow - 1);
        fast = dt < (tgt ? tgt * 1.15 : 0.02) ? fast + 1 : 0;
      }
      if (slow > 12 && q < STEPS.length - 1 && cool <= 0) set(q + 1);
      else if (fast > 240 && q > qMin && cool <= 0) set(q - 1);
      return true;
    },
    down() {
      if (q < STEPS.length - 1) set(q + 1);
    },
  };
}
