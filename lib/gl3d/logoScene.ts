// The home logo, live: 2 arcs, 18 upright squares and the core, each its own object on a transparent canvas.
// The scroll story (squares scatter, arcs leave, everything fuses) comes from the Ignition's progress values; every
// piece also floats on the page liquid on its own (buoy springs fed by `sample`) and the cursor can push it.
import { createStage } from './core';
import type { Obj, Stage } from './core';
import { logoPieces } from './geometry';
import type { Piece } from './geometry';
import { addSource, sample } from '../liquid/field';
import { onFrame } from '../liquid/loop';
import { createPour } from './pour';
import type { Pour } from './pour';

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

/**
 * Mounts a canvas into `host` (which spans the ring's box; the canvas is LOGO_SPAN times larger, centred) and runs the
 * logo on the shared frame loop. Returns the function that removes everything again.
 */
export function mountLogo(opts: {
  host: HTMLElement;
  story: () => LogoStory;
  onReady?: () => void;
  onFail?: () => void;
  /** First visit of the page: play the pour. `skip()` says it is too late for it, `start()` is called once the first frame is up. */
  pour?: { tempo: number; skip: () => boolean; start: () => void };
}): () => void {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'ig-3d';
  let stage: Stage;
  try {
    opts.host.appendChild(canvas);
    stage = createStage(canvas, { fov: 28, frame: MARK * LOGO_SPAN, quality: 1, dpr: Math.min(window.devicePixelRatio || 1, 1.5), exposure: 1 });
  } catch {
    canvas.remove();
    opts.onFail?.();
    return () => {};
  }
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
  let pour: Pour | undefined = opts.pour && !opts.pour.skip() ? createPour(stage, bodies) : undefined;
  let pourStart = -1;
  let fl = pour ? 0 : 1; // how much of the floating shows (0 while the logo is still in the mould)
  const pourTau = (t: number) => {
    const dbg = location.search.includes('pourdebug') ? (window as unknown as { __pourT?: number }).__pourT : undefined; // contact sheets
    return dbg !== undefined ? dbg : (t - pourStart) / opts.pour!.tempo;
  };
  pour?.update(0);

  // Pointer, in client px.
  const ptr = { x: -9999, y: -9999 };
  const onMove = (e: PointerEvent) => {
    ptr.x = e.clientX;
    ptr.y = e.clientY;
  };
  const onLeave = () => {
    ptr.x = ptr.y = -9999;
  };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  let slow = 0;
  let fast = 0;
  let lastRipple = 0;
  let shown = false;

  const off = onFrame((t, dt) => {
    // Adaptive quality: a slow stretch lowers the render scale, a long fast one raises it again.
    if (dt > 0.03) {
      slow++;
      fast = 0;
    } else if (dt < 0.02) {
      fast++;
      slow = Math.max(0, slow - 1);
    }
    if (slow > 20) {
      stage.quality = Math.max(0.4, stage.quality - 0.1);
      slow = 0;
    } else if (fast > 180 && stage.quality < 1) {
      stage.quality = Math.min(1, stage.quality + 0.05);
      fast = 0;
    }

    const story = opts.story();
    const rect = canvas.getBoundingClientRect();
    const px = rect.height / (MARK * LOGO_SPAN); // client px per mark unit
    if (px <= 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const sy = scrollY;
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
        addSource(gx, gy + sy, 0.22, 7, { kind: 'float', t });
      }

      obj.position = [bx + ox + s[0] * fl, by + oy + s[1] * fl, oz + s[2] * fl];
      obj.rotation = [rx + s[3] * fl, ry + s[4] * fl, rz];
      if (tick?.release) v[2] -= 9 + hash(b.phase * 7) * 4; // landing in the liquid
      obj.scale = sc;
    }
    if (tick) {
      for (const r of tick.ripples) addSource(sx0 + r.x * px, sy0 - r.y * px + sy, r.amp, r.size, { kind: 'float', t });
    }
    stage.render();
    if (!shown) {
      shown = true;
      opts.onReady?.();
      opts.pour?.start();
    }
  });

  return () => {
    off();
    removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    stage.dispose();
    canvas.remove();
  };
}
