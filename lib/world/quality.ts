// Quality steps: the scene's render scale (render px per CSS px) and a 0..1 knob modules scale their own work with.
// Slow frames step down after ~0.8 s; fast frames climb back at most twice per visit (so it never oscillates). Software
// GL starts low and never gives up. `?q=<step>` pins a step, `?world=full` pins the top step at full fidelity.
// The canvas never resizes for a step: the scene renders into an offscreen target and the post pass scales it up.

import { clockHeld } from '@/lib/liquid/loop';
import type { Quality } from './frame';

/** Render px per CSS px, best first (capped by the device pixel ratio and MAX_SCALE). */
export const SCALES = [2, 1.6, 1.33, 1.1, 0.9, 0.75, 0.62, 0.5, 0.4];
/** 0..1 knob per step (modules: octaves, march steps, taps). */
const KNOB = [1, 1, 0.92, 0.82, 0.7, 0.58, 0.46, 0.34, 0.25];
export const MAX_SCALE = 2;

export type QualityCtl = Quality & {
  /** Feed a frame interval (s). Returns true when the step changed. */
  feed(dt: number): boolean;
  /** Scene target size for a viewport. */
  size(w: number, h: number): [number, number];
};

export function createQuality(opts: { dpr: number; software: boolean; pinned?: number | null; full?: boolean }): QualityCtl {
  const cap = Math.min(opts.dpr, MAX_SCALE);
  // the best step this device can use (nothing above its own pixel ratio)
  const top = Math.max(0, SCALES.findIndex((s) => s <= cap + 1e-3));
  const start = opts.full ? top : opts.pinned != null ? Math.min(SCALES.length - 1, Math.max(top, opts.pinned)) : opts.software ? SCALES.length - 2 : Math.min(SCALES.length - 1, top + 1);
  let slow = 0,
    fast = 0,
    climbs = 0,
    ema = 1 / 60;
  const fixed = opts.full || opts.pinned != null;
  const q: QualityCtl = {
    step: start,
    scale: SCALES[start],
    q: opts.full ? 1 : KNOB[start],
    software: opts.software,
    full: !!opts.full,
    feed(dt) {
      if (fixed || clockHeld() || dt <= 0 || dt > 0.25) return false;
      ema += (dt - ema) * 0.1;
      if (ema > 1 / 45) {
        slow += dt;
        fast = 0;
      } else if (ema < 1 / 57) {
        fast += dt;
        slow = 0;
      } else {
        slow = Math.max(0, slow - dt);
        fast = Math.max(0, fast - dt * 0.5);
      }
      if (slow > 0.8 && q.step < SCALES.length - 1) {
        set(q.step + 1);
        slow = 0;
        return true;
      }
      if (fast > 4 && climbs < 2 && q.step > top && !opts.software) {
        climbs++;
        set(q.step - 1);
        fast = 0;
        return true;
      }
      return false;
    },
    size(w, h) {
      return [Math.max(2, Math.round(w * q.scale)), Math.max(2, Math.round(h * q.scale))];
    },
  };
  function set(i: number) {
    q.step = i;
    q.scale = SCALES[i];
    q.q = KNOB[i];
    ema = 1 / 60;
  }
  return q;
}

/** Software GL (SwiftShader, llvmpipe, a CI runner, PageSpeed). */
export function isSoftware(gl: WebGL2RenderingContext) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}
