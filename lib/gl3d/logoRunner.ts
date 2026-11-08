// The home logo, live: 2 arcs, 14 upright squares and the core, each its own object on a transparent canvas, all on the
// mark's circles (lib/splitRing.ts).
// Every piece's pose comes from the main thread with each tick of the one clock (logoScene.ts: the scroll story's
// offsets plus its floating on the page's wave grid, the cursor's push included); this file applies exactly that pose,
// plays the pour (the floating fades in as the logo is released) and draws. It keeps no springs and no time of its own.
// It is DOM-free: it runs inside the scene worker (sceneWorker.ts) or, where OffscreenCanvas WebGL2 is missing, on the
// main thread (logoScene.ts). Everything else it needs from the page arrives in `LogoEnv`.
import { createStage } from './core';
import type { Obj, Stage } from './core';
import { logoPieces } from './geometry';
import type { Piece } from './geometry';
import { createPour } from './pour';
import type { Pour } from './pour';
import { createAdapt } from './adapt';

export type LogoStory = { sm: number; sh: number; core: number; flare: number; out: number };

/** The canvas is this many ring boxes wide and tall, so scattered pieces have room. */
export const LOGO_SPAN = 2.4;
const MARK = 64;

/**
 * Per piece (logoPieces() order: arc 0, arc 1, the 14 squares, the core), POSE_STRIDE numbers in mark units (y up)
 * and radians: the story's offset [x, y, z, rx, ry, rz, scale], then the floating [x, y, z, rx, ry, rz]. The floating
 * is scaled by how much of it shows (0 while the metal is poured, 1 once released).
 */
export const POSE_STRIDE = 13;

type Body = { piece: Piece; obj: Obj };

/** What the page tells the logo (client px unless noted). */
export type LogoEnv = {
  /** The canvas' CSS layout size (it has no layout of its own in a worker). */
  css: { w: number; h: number };
  /** Its on-screen box now (includes the ring's CSS transform). */
  rect: { left: number; top: number; width: number; height: number };
  scrollY: number;
  /** Client y below which the page is free of the nav (the crucible stays under it). */
  top?: number;
  story: LogoStory;
  /** Contact sheets (?pourdebug): the pour clock, in place of the real one. */
  pourT?: number;
};

export type LogoRunner = {
  /** Draw time `t` with these poses (POSE_STRIDE per piece; missing = at rest). */
  frame(t: number, poses?: Float32Array): void;
  /** How much of the floating shows now (0 during the pour, 1 once the logo is released). */
  fl(): number;
  down(): void;
  dispose(): void;
};

/**
 * Build the logo on `canvas` (throws if WebGL2 is missing). The owner calls `frame(t, poses)` from the one clock.
 * `emit` adds a small ripple to the page liquid (page px: the pour's own splashes). `onRelease`: the pour has just let
 * the logo go onto the liquid. `onFirst` is called after the first frame is drawn.
 */
export function createLogoRunner(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  env: LogoEnv,
  opts: {
    dpr: number;
    full: boolean;
    /** Play the pour (first visit). */
    pour?: { tempo: number };
    emit: (x: number, docY: number, amp: number, size: number, t: number) => void;
    onRelease?: () => void;
    onFirst?: () => void;
    /** The logo is finished and floating (pour over, skipped or cut short by scrolling); called once. */
    onSettled?: () => void;
  },
): LogoRunner {
  const stage: Stage = createStage(canvas, { fov: 28, frame: MARK * LOGO_SPAN, quality: 1, dpr: Math.min(opts.dpr || 1, 1.5), exposure: 1, css: env.css, fidelity: opts.full });
  const adapt = createAdapt(stage, opts.full);
  const bodies: Body[] = logoPieces().map((piece, i) => {
    const isCore = piece.kind === 'core';
    const obj = stage.add({
      mesh: piece.mesh,
      material: isCore ? 'core' : 'cast',
      grain: 0.4,
      seed: isCore ? 3 : 1 + (i % 5),
      position: [...piece.center],
    });
    return { piece, obj };
  });

  // The pour (opening): the metal fills the pieces' own shapes, then the logo is released onto the liquid.
  const headroom = () => {
    const px = env.rect.height / (MARK * LOGO_SPAN);
    return px > 0 ? (env.rect.top + env.rect.height / 2 - (env.top ?? 64) - 12) / px : 40;
  };
  let pour: Pour | undefined = opts.pour ? createPour(stage, bodies, headroom()) : undefined;
  let fl = pour ? 0 : 1; // how much of the floating shows (0 while the metal is still being poured)
  // The pour runs on the one clock from its first drawn frame (a slow software-GL frame rate drops frames, it never
  // stretches the pour). The first frame's own cost (shader compile) is not counted.
  let pourStart = -1;
  const pourTau = (t: number) => (env.pourT !== undefined ? env.pourT : (t - pourStart) / opts.pour!.tempo);
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    opts.onSettled?.();
  };
  pour?.update(0);

  let shown = false;

  const frame = (t: number, poses?: Float32Array) => {
    if (!adapt.allow(t)) return;
    const story = env.story;
    const rect = env.rect;
    const px = rect.height / (MARK * LOGO_SPAN); // client px per mark unit
    if (px <= 0) return;
    let tick: ReturnType<Pour['update']> | undefined;
    if (pour && shown) {
      if (story.out > 0.02 || story.sm > 0.01) {
        pour.finish();
        pour.dispose();
        pour = undefined;
        fl = 1;
        settle();
      } else {
        if (pourStart < 0) pourStart = t;
        tick = pour.update(pourTau(t));
        fl = tick.float;
        if (tick.release) opts.onRelease?.();
        if (tick.done) {
          pour.dispose();
          pour = undefined;
          fl = 1;
          settle();
        }
      }
    }

    const P = poses && poses.length >= bodies.length * POSE_STRIDE ? poses : null;
    for (let i = 0; i < bodies.length; i++) {
      const { obj, piece } = bodies[i];
      const [bx, by] = piece.center; // in the mark's plane (z 0), as each mesh is centred on its own box
      if (!P) {
        obj.position = [bx, by, 0];
        obj.rotation = [0, 0, 0];
        obj.scale = 1;
        continue;
      }
      const o = i * POSE_STRIDE;
      obj.position = [bx + P[o] + P[o + 7] * fl, by + P[o + 1] + P[o + 8] * fl, P[o + 2] + P[o + 9] * fl];
      obj.rotation = [P[o + 3] + P[o + 10] * fl, P[o + 4] + P[o + 11] * fl, P[o + 5] + P[o + 12] * fl];
      obj.scale = P[o + 6];
    }
    if (tick) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      for (const r of tick.ripples) opts.emit(cx + r.x * px, cy - r.y * px + env.scrollY, r.amp, r.size, t);
    }
    // The core lights the bone metal around it (wherever the story or the floating has taken it); its skin drifts slowly.
    const core = bodies[bodies.length - 1].obj;
    const cs = typeof core.scale === 'number' ? core.scale : core.scale[0];
    stage.light = [core.position[0], core.position[1], core.position[2], core.visible ? cs : 0];
    for (const b of bodies) b.obj.time = t;
    stage.render();
    if (!shown) {
      shown = true;
      opts.onFirst?.();
      if (!pour) settle();
    }
  };

  return { frame, fl: () => fl, down: adapt.down, dispose: () => stage.dispose() };
}
