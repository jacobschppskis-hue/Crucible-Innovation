// The home logo, live: 2 arcs, 18 upright squares and the core, each its own object on a transparent canvas.
// The scroll story (squares scatter, arcs leave, everything fuses) comes from the Ignition's progress values; every
// piece also floats on the page liquid on its own (buoy springs fed by `sample`) and the cursor can push it.
// This file is DOM-free: it runs inside the scene worker (sceneWorker.ts) or, where OffscreenCanvas WebGL2 is missing,
// on the main thread (logoScene.ts). Everything it needs from the page arrives in `LogoEnv`.
import { createStage } from './core';
import type { Obj, Stage } from './core';
import { logoPieces } from './geometry';
import type { Piece } from './geometry';
import { sample } from '../liquid/field';
import { createPour } from './pour';
import type { Pour } from './pour';
import { createAdapt } from './adapt';

export type LogoStory = { sm: number; sh: number; core: number; flare: number; out: number };

/** The canvas is this many ring boxes wide and tall, so scattered pieces have room. */
export const LOGO_SPAN = 2.4;
const MARK = 64;

const scatter = (i: number) => {
  const r = (n: number) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { dx: 16 + r(1) * 44, dy: (r(2) - 0.5) * 64, dr: (r(3) - 0.5) * 220 };
};
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const hash = (i: number) => ((Math.sin(i * 91.7 + 3.1) * 43758.5453) % 1 + 1) % 1;

type Body = {
  piece: Piece;
  obj: Obj;
  k: number; // square index 0..1 (story stagger)
  sc: { dx: number; dy: number; dr: number };
  phase: number;
  // spring state: x, y (push), z (buoy), rx, ry (tilt), each with a velocity
  s: Float32Array;
  v: Float32Array;
};

/** What the page tells the logo each frame (client px unless noted). */
export type LogoEnv = {
  /** The canvas' CSS layout size (it has no layout of its own in a worker). */
  css: { w: number; h: number };
  /** Its on-screen box now (includes the ring's CSS transform). */
  rect: { left: number; top: number; width: number; height: number };
  scrollY: number;
  ptr: { x: number; y: number };
  story: LogoStory;
  /** Contact sheets (?pourdebug): the pour clock, in place of the real one. */
  pourT?: number;
};

export type LogoRunner = { frame(t: number): void; down(): void; dispose(): void };

/**
 * Build the logo on `canvas` (throws if WebGL2 is missing). `frame(t, dt)` draws one frame; the owner calls it from its
 * own loop. `emit` adds a small ripple to the page liquid (page px). `onFirst` is called after the first frame is drawn.
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
    onFirst?: () => void;
  },
): LogoRunner {
  const stage: Stage = createStage(canvas, { fov: 28, frame: MARK * LOGO_SPAN, quality: 1, dpr: Math.min(opts.dpr || 1, 1.5), exposure: 1, css: env.css });
  const adapt = createAdapt(stage, opts.full);
  const bodies: Body[] = [];
  let sq = 0;
  const pieces = logoPieces();
  const nSq = pieces.filter((p) => p.kind === 'square').length;
  pieces.forEach((piece, i) => {
    const isCore = piece.kind === 'core';
    const obj = stage.add({
      mesh: piece.mesh,
      material: isCore ? 'core' : 'cast',
      grain: 0.4,
      seed: isCore ? 3 : 1 + (i % 5),
      position: [...piece.center],
    });
    bodies.push({
      piece,
      obj,
      k: piece.kind === 'square' ? sq++ / (nSq - 1) : 0,
      sc: scatter(piece.kind === 'square' ? sq - 1 : 0),
      phase: hash(i) * 6.28,
      s: new Float32Array(5),
      v: new Float32Array(5),
    });
  });

  // The pour (opening): the pieces are cast in a sand mould, then released onto the liquid.
  let pour: Pour | undefined = opts.pour ? createPour(stage, bodies) : undefined;
  let pourStart = -1;
  let fl = pour ? 0 : 1; // how much of the floating shows (0 while the logo is still in the mould)
  const pourTau = (t: number) => {
    return env.pourT !== undefined ? env.pourT : (t - pourStart) / opts.pour!.tempo;
  };
  pour?.update(0);

  const ptr = env.ptr;
  let lastRipple = 0;
  let shown = false;
  let lastT = 0;

  const frame = (t: number) => {
    if (!adapt.allow(t)) return;
    const dt = lastT ? Math.min(0.1, t - lastT) : 1 / 60;
    lastT = t;
    const story = env.story;
    const rect = env.rect;
    const px = rect.height / (MARK * LOGO_SPAN); // client px per mark unit
    if (px <= 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const sy = env.scrollY;
    const step = Math.min(dt, 1 / 30);
    const R = Math.max(70, px * 14); // cursor reach, px
    const sx0 = cx, sy0 = cy;
    let tick: ReturnType<Pour['update']> | undefined;
    if (pour && shown) {
      if (pourStart < 0) pourStart = t;
      if (story.out > 0.02 || story.sm > 0.01) {
        pour.finish();
        pour.dispose();
        pour = undefined;
        fl = 1;
      } else {
        tick = pour.update(pourTau(t));
        fl = tick.float;
        if (tick.done) {
          pour.dispose();
          pour = undefined;
          fl = 1;
        }
      }
    }

    for (const b of bodies) {
      const { obj, piece, s, v } = b;
      const [bx, by] = piece.center;
      // Story offsets (mark units, y up).
      let ox = 0, oy = 0, oz = 0, rx = 0, ry = 0, rz = 0, sc = 1;
      if (piece.kind === 'square') {
        const q = clamp(story.sm * 1.6 - b.k * 0.6, 0, 1);
        ox = b.sc.dx * q;
        oy = -b.sc.dy * q;
        oz = -22 * q;
        rz = (-b.sc.dr * q * Math.PI) / 180;
        rx = (b.sc.dr / 220) * q * 1.4;
        ry = (b.sc.dy / 64) * q * 1.2;
        sc = 1 - q * 0.45;
      } else if (piece.kind === 'arc') {
        const h = story.sh;
        ox = -34 * h;
        oz = -34 * h;
        ry = (piece.ring === 0 ? 1 : -1) * 0.9 * h;
        sc = 1 - h * 0.78;
      } else {
        sc = 0.8 + 0.2 * Math.min(1, story.core) + story.flare * 0.3;
      }

      // Where the piece is on the page now, then the liquid under it.
      const gx = cx + (bx + ox + s[0]) * px;
      const gy = cy - (by + oy + s[1]) * px;
      const w = sample(gx, gy + sy, t);
      // Cursor push: away from the pointer, springing back.
      let ax = 0, ay = 0;
      const dx = gx - ptr.x, dy = gy - ptr.y;
      const d = Math.hypot(dx, dy);
      let pushed = 0;
      if (d < R && d > 0.5 && fl > 0.05) {
        const f = (1 - d / R) * 5200;
        ax = (dx / d) * f;
        ay = -(dy / d) * f; // mark y is up
        pushed = f;
      }
      const idle = t * 1.1 + b.phase;
      const tz = w.h * 7 + Math.sin(idle) * 0.7;
      const trx = clamp(-w.gy * 4, -0.5, 0.5) + Math.sin(idle * 0.8 + 1) * 0.04;
      const try_ = clamp(w.gx * 4, -0.5, 0.5) + Math.cos(idle * 0.9) * 0.04;
      // Springs (units, 1/s²): x,y return to rest and drift gently downhill; z, rx, ry follow the surface.
      const targets = [-w.gx * 30, w.gy * 30, tz, trx, try_];
      for (let j = 0; j < 5; j++) {
        const kk = j < 2 ? 22 : 55;
        const cc = j < 2 ? 5 : 6.5;
        let acc = kk * (targets[j] - s[j]) - cc * v[j];
        if (j === 0) acc += ax / px;
        if (j === 1) acc += ay / px;
        v[j] += acc * step;
        s[j] += v[j] * step;
      }
      s[0] = clamp(s[0], -22, 22);
      s[1] = clamp(s[1], -22, 22);
      // A hard shove sheds a tiny ripple (rate-limited).
      if (pushed > 1800 && t - lastRipple > 0.28) {
        lastRipple = t;
        opts.emit(gx, gy + sy, 0.22, 7, t);
      }

      obj.position = [bx + ox + s[0] * fl, by + oy + s[1] * fl, oz + s[2] * fl];
      obj.rotation = [rx + s[3] * fl, ry + s[4] * fl, rz];
      if (tick?.release) v[2] -= 9 + hash(b.phase * 7) * 4; // landing in the liquid
      obj.scale = sc;
    }
    if (tick) {
      for (const r of tick.ripples) opts.emit(sx0 + r.x * px, sy0 - r.y * px + sy, r.amp, r.size, t);
    }
    stage.render();
    if (!shown) {
      shown = true;
      opts.onFirst?.();
    }
  };

  return { frame, down: adapt.down, dispose: () => stage.dispose() };
}
