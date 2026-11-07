// A venture's ingot as it is shown: one stage, the ingot's root, and the resting pose (square-on, slight constant tilt).
// Shared by the live scene (ingotScene.ts) and by scripts/ingot-stills.mjs, which captures the fallback stills.
import { createStage, addIngot, ingot, type IngotKind, type Obj, type Stage, type StageOptions } from './index';

/** World units that fill the canvas height (the ingot is 100 wide; the canvas is 8:5, so the width is 1.6 × this). */
export const FRAME = 82;
/** The constant pitch (radians): the top edge leans slightly back, so the face catches the key light from above. */
export const PITCH = -0.1;
export const ROLL = 0.025;

export type BuiltIngot = { stage: Stage; root: Obj; hot: Obj | null };

export function buildIngot(canvas: HTMLCanvasElement | OffscreenCanvas, kind: IngotKind, opts: StageOptions = {}): BuiltIngot {
  const stage = createStage(canvas, { frame: FRAME, ...opts });
  const { root, parts } = addIngot(stage, ingot(kind));
  root.rotation = [PITCH, 0, ROLL];
  return { stage, root, hot: kind === 'sites' ? null : parts[1] ?? null };
}
