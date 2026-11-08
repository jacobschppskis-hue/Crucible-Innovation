// A venture's bar as it is drawn: one stage, the liquid's tilted frame, the bar's root (its float pose) and the bar.
// Shared by the live runner (ingotRunner.ts) and scripts/ingot-stills.mjs, which captures the fallback stills at REST.
import { createStage, addIngot, ingot, type IngotKind, type Obj, type Stage, type StageOptions } from './index';
import { FOV, FRAME, LIFT, REST, TILT, type IngotPose } from './ingotPose';

export type BuiltIngot = { stage: Stage; root: Obj; bar: Obj; place(p: IngotPose, unitsPerPx: number, t: number): void };

export function buildIngot(canvas: HTMLCanvasElement | OffscreenCanvas, kind: IngotKind, opts: StageOptions = {}): BuiltIngot {
  // `fixed`: quality steps scale an offscreen target, never the canvas (WebKit blanks a resized WebGL canvas for a frame or more).
  const stage = createStage(canvas, { frame: FRAME, fov: FOV, fixed: true, ...opts });
  // The liquid's frame: z = its normal, +y = away from the viewer; tilted toward the camera.
  const liquid = stage.add({ rotation: [TILT, 0, 0], position: [0, LIFT, 0] });
  const spec = ingot(kind);
  spec.root.parent = liquid;
  const { root, parts } = addIngot(stage, spec);
  const bar = parts[parts.length - 1];
  const pool = parts.find((o) => o.material === 'pool');
  const place = (p: IngotPose, k: number, t: number) => {
    // Pitch about the bar's length, roll about its width (lifting its +x end), then the turn about the liquid's normal.
    root.rotation = [p.pitch, -p.roll, p.yaw];
    // Drift in the liquid's plane (page y down = toward the viewer), bob along its normal.
    root.position = [p.dx * k, (-p.dy * k) / Math.cos(TILT), p.bob * k];
    for (const o of parts) o.time = t;
    if (pool) pool.poke = [p.px, p.py, p.pa, p.ps];
  };
  place(REST, 0, 0);
  return { stage, root, bar, place };
}
