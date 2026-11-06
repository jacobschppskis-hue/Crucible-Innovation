export { createStage } from './core';
export type { Stage, StageOptions, Obj, ObjectInit } from './core';
export { logoPieces, slab, sphere, extrude, mouldBrick, recentre } from './geometry';
export type { Mesh, Piece, Vec3 } from './geometry';
export { MATERIALS, reliefCanvas } from './materials';
export type { MaterialName } from './materials';
export { ingot, INGOT } from './ingots';
export type { IngotKind, IngotSpec } from './ingots';
import type { Obj, Stage } from './core';
import type { IngotSpec } from './ingots';

/** Add an ingot to a stage: returns the root (mesh-less) object; the parts are parented to it. */
export function addIngot(stage: Stage, spec: IngotSpec): { root: Obj; parts: Obj[] } {
  const root = stage.add(spec.root);
  return { root, parts: spec.parts.map((p) => stage.add({ ...p, parent: root })) };
}
