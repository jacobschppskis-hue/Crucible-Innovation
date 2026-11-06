// The home opening's pour, in 3D, inside the logo's own transparent canvas: a crucible drops in and tips, a white-hot
// stream fills the core, metal rises through a freestanding sand mould of the logo, cools from white-hot through yellow
// and orange to bone while the mould cracks open and falls away, and the logo is released onto the liquid.
// Pure function of the pour clock `tau` (seconds at full tempo; the caller scales a quick repeat intro). Beats follow
// the headline's CSS timings in components/Ignition.tsx (rise 0.3 s, pour 1.5 s, metal 2.0 s, mould out 3.45 s, set ~4.2 s).
import type { Obj, Stage } from './core';
import type { Piece, Vec3 } from './geometry';
import { RING } from '../splitRing';
import { arcTray, coreTray, crucibleMesh, cube, poolMesh, smallSphere, squareTray, streamMesh } from './pourGeo';

export type PourPiece = { piece: Piece; obj: Obj };
export type Ripple = { x: number; y: number; amp: number; size: number }; // mark units from the ring centre, y up
export type PourTick = { float: number; release: boolean; ripples: Ripple[]; done: boolean };
export type Pour = { update(tau: number): PourTick; finish(): void; dispose(): void };

/** Time (s at full tempo) at which the pour is over and the logo is released. */
export const POUR_END = 4.25;

const LIPX = 0.55;
const LIPY = 36.5;
const K = 0.92; // crucible scale
const CRU_Z = 5.5; // the crucible stands in front of the mould, so they never intersect // the crucible's pouring lip
const STREAM_Z = 4.2;
const D = 130; // heat falls from white at the metal's surface to bone this many units below it
const CORE_R = RING.core;
const HI = 1e4;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sm = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));
const io = (x: number) => x * x * (3 - 2 * x);
const eo = (x: number) => 1 - (1 - x) ** 3;
const ei = (x: number) => x * x;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (i: number) => ((Math.sin(i * 91.7 + 3.1) * 43758.5453) % 1 + 1) % 1;
/** Piecewise smooth path through [time, value] keys. */
const path = (keys: [number, number][], x: number) => {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], io(sm(keys[i - 1][0], keys[i][0], x)));
  return keys[keys.length - 1][1];
};

const TILT: [number, number][] = [[0, 0], [1.25, 0], [1.5, 24], [3.0, 66], [3.32, 5]];
const POOL: [number, number][] = [[0.7, -12], [1.35, -4.4], [1.52, -1.0], [2.98, -1.0], [3.3, -10.6]];
const CRU_X = LIPX - 6.6; // the cup's axis, upright
const INGOTS: Vec3[] = [[CRU_X - 1.45, 0, 0], [CRU_X + 1.45, 0, 0], [CRU_X, 2.9, 0]];

type Tray = {
  obj: Obj;
  c: Vec3;
  kind: 'arc' | 'square' | 'core';
  start: number;
  v: [number, number, number]; // outward velocity, hop, push back
  spin: [number, number];
  hot: (tau: number, L: number, c: number) => number; // glow 0..1
};

export function createPour(stage: Stage, pieces: PourPiece[]): Pour {
  const owned: Obj[] = [];
  const add = (init: Parameters<Stage['add']>[0]) => {
    const o = stage.add(init);
    owned.push(o);
    return o;
  };

  // ---- Crucible: a pivot on the lip, the cup (front cut away) and the molten pool in it. ----
  const pivot = add({});
  const cup = add({ mesh: crucibleMesh(), material: 'cast', tone: 0.92, grain: 0.8, seed: 4, parent: pivot, position: [-6.6, -0.55, 0] });
  const pool = add({ mesh: poolMesh(), material: 'hot', temp: 1, grain: 0.5, seed: 2, parent: cup });

  const ingots = INGOTS.map((p, i) => add({ mesh: cube(1.45), material: 'hot', temp: 0, grain: 0.7, seed: 6 + i, visible: false, position: [...p] as Vec3 }));
  const stream = add({ mesh: streamMesh(), material: 'hot', temp: 0.9, grain: 0.5, seed: 9, visible: false });
  const blob = add({ mesh: smallSphere(1.7), material: 'hot', temp: 1, grain: 0.5, seed: 1, visible: false });
  const sparkMesh = smallSphere(0.6);
  const sparks = Array.from({ length: 22 }, (_, k) => ({ o: add({ mesh: sparkMesh, material: 'hot', temp: 1, grain: 0.5, seed: k, visible: false }), te: 1.86 + k * 0.062, vx: (hash(k + 1) - 0.5) * 34, vy: 22 + hash(k + 40) * 26, vz: (hash(k + 80) - 0.3) * 10, x0: LIPX + (hash(k + 120) - 0.5) * 2 }));

  // ---- The mould: sand trays around every square, each arc and the core. ----
  const trays: Tray[] = [];
  const { px, rings } = RING;
  const hw = px / 2;
  const sandInit = { material: 'sand' as const, grain: 0.5, tone: 0.3, cavity: [HI, HI, 0, 0] as [number, number, number, number] };
  const byRing: Piece[][] = [[], []];
  for (const { piece } of pieces) if (piece.kind === 'square') byRing[piece.ring!].push(piece);
  const heat = (y: number) => (_: number, L: number, c: number) => clamp01(1 - (L - y) / D - c) * (L > y - 1 ? 1 : 0);
  byRing.forEach((list, ri) => list.forEach((p, k) => {
    const open = k === 0 || k === list.length - 1; // the end squares open onto the arc's channel
    const mesh = squareTray(hw, open);
    const obj = add({ ...sandInit, mesh, seed: 11 + ri * 20 + k, position: [...p.center] as Vec3 });
    const dx = p.center[0], dy = p.center[1], l = Math.hypot(dx, dy) || 1;
    trays.push({ obj, c: [...p.center] as Vec3, kind: 'square', start: 3.38 + 0.2 * (1 - (dy + 28) / 56) + hash(k + ri * 9) * 0.07, v: [(dx / l) * 9 + 3, (dy / l) * 9 + 9, 10 + hash(k) * 8], spin: [(hash(k + 3) - 0.5) * 6, (hash(k + 5) - 0.5) * 3], hot: heat(p.center[1]) });
  }));
  rings.forEach(({ r }, ri) => {
    const e = hw / r;
    const { mesh, center } = arcTray(r, px, Math.PI / 2 - e, (3 * Math.PI) / 2 + e);
    const obj = add({ ...sandInit, mesh, seed: 50 + ri, position: [...center] as Vec3 });
    trays.push({ obj, c: center, kind: 'arc', start: 3.45 + ri * 0.08, v: [-7 - ri * 3, 6, 12], spin: [0, ri ? 1.6 : -1.3], hot: heat(0) });
  });
  const coreObj = add({ ...sandInit, mesh: coreTray(CORE_R), seed: 70, position: [0, 0, 0] });
  trays.push({ obj: coreObj, c: [0, 0, 0], kind: 'core', start: 3.5, v: [0, -4, 14], spin: [0.8, 0], hot: (tau, _L, c) => sm(1.82, 2.4, tau) * clamp01(1 - 0.55 * c * 1.2) });

  const hotPieces = pieces.filter((p) => p.piece.kind !== 'core');
  const corePiece = pieces.find((p) => p.piece.kind === 'core')!;

  let fired = 0;
  let released = false;
  let finished = false;

  const settlePieces = () => {
    for (const { piece, obj } of pieces) {
      obj.material = piece.kind === 'core' ? 'core' : 'cast';
      obj.clip = undefined;
      obj.tgrad = 0;
      obj.temp = 0;
    }
  };
  const hideAll = () => {
    for (const o of owned) o.visible = false;
  };

  const update = (tau: number): PourTick => {
    const out: PourTick = { float: io(sm(4.0, 5.0, tau)), release: false, ripples: [], done: tau >= 5.0 };
    if (tau >= POUR_END) {
      if (!finished) {
        finished = true;
        settlePieces();
        hideAll();
      }
      if (!released) {
        released = true;
        out.release = true;
        out.ripples.push({ x: 0, y: 0, amp: 0.55, size: 24 });
      }
      return out;
    }

    // Heat: the metal's surface L rises through the mould; white-hot at the surface, cooler below; then everything cools.
    const rise = io(sm(2.0, 3.05, tau));
    const L = lerp(-31, 31, rise);
    const c = io(sm(2.9, 4.15, tau));

    // The mark's own pieces become metal: clipped by the rising level, on one shared heat field.
    for (const { obj } of hotPieces) {
      obj.material = 'hot';
      obj.clip = [0, 1, 0, L];
      obj.temp = 1 - L / D - c;
      obj.tgrad = 1 / D;
      obj.grain = 0.4;
    }
    {
      const o = corePiece.obj;
      o.material = 'hot';
      o.clip = [0, 1, 0, lerp(-CORE_R - 0.4, CORE_R + 0.4, eo(sm(1.82, 2.5, tau)))];
      o.temp = 1 - 0.58 * c;
      o.tgrad = 0;
    }

    // Crucible: drops in with a little weight, tips about its lip, is righted and lifted away.
    const k = sm(0.15, 0.72, tau) - 1;
    const back = 1 + 2.2 * k * k * k + 1.2 * k * k; // ease out with a small overshoot
    const dy = 30 * (1 - back);
    const lift = 36 * ei(sm(3.3, 3.95, tau));
    const theta = path(TILT, tau);
    pivot.position = [LIPX, LIPY + dy + lift, CRU_Z];
    pivot.rotation = [0, 0, (-theta * Math.PI) / 180];
    pivot.scale = K * (1 - sm(3.8, 3.97, tau) * 0.999);
    const cupOn = tau >= 0.15 && tau < 3.97;
    cup.visible = pool.visible = cupOn;
    pool.clip = [0, 1, 0, LIPY + dy + lift + path(POOL, tau)];
    pool.temp = 1 - 0.18 * sm(1.5, 3.2, tau);
    cup.temp = 0;

    // Three cold pixels drop in, glow and slump into the pool.
    INGOTS.forEach((p, i) => {
      const o = ingots[i];
      const t0 = 0.3 + i * 0.09;
      const slump = io(sm(0.95 + i * 0.07, 1.32 + i * 0.07, tau));
      o.visible = tau >= t0 && slump < 1;
      const fall = ei(sm(t0, t0 + 0.4, tau));
      const rest = LIPY + dy + (-11.15 + 1.5 + p[1]) * K;
      o.position = [LIPX + (p[0] - LIPX) * K, rest + 36 * (1 - fall) + 0.7 * Math.sin(Math.PI * sm(t0 + 0.4, t0 + 0.62, tau)), CRU_Z];
      o.scale = [K * (1 + 0.4 * slump), K * (1 - 0.85 * slump), K];
      o.temp = io(sm(0.62, 1.18, tau)) * 0.95;
    });

    // The stream: falls from the lip to the core, pours, thins as the cup empties, then lets go.
    const yEnd = 3.1;
    const head = lerp(LIPY, yEnd, ei(sm(1.5, 1.82, tau)));
    const tail = lerp(LIPY, yEnd, ei(sm(3.0, 3.28, tau)));
    const on = tau >= 1.5 && tau < 3.28;
    stream.visible = on;
    if (on) {
      const wd = 3.4 * (1 - 0.5 * sm(2.5, 3.05, tau)) * (1 + 0.05 * Math.sin(tau * 38));
      const len = Math.max(0.01, tail - head);
      stream.position = [LIPX + 0.15 * Math.sin(tau * 21), (tail + head) / 2, STREAM_Z];
      stream.scale = [wd, len, wd];
    }
    const blobOn = tau >= 1.8 && tau < 3.3;
    blob.visible = blobOn;
    if (blobOn) {
      const s = (0.75 + 0.2 * Math.sin(tau * 31)) * (1 - 0.6 * sm(2.8, 3.3, tau)) * eo(sm(1.8, 2.0, tau));
      blob.position = [LIPX, yEnd - 0.2, STREAM_Z];
      blob.scale = [1.3 * s, 0.8 * s, 1.1 * s];
    }
    for (const s of sparks) {
      const t = tau - s.te;
      const u = t / 0.8;
      s.o.visible = u >= 0 && u < 1 && tau < 3.4;
      if (!s.o.visible) continue;
      s.o.position = [s.x0 + s.vx * t, yEnd + s.vy * t - 0.5 * 105 * t * t, STREAM_Z + 0.3 + s.vz * t];
      s.o.scale = 0.2 + 0.9 * (1 - u) ** 0.7;
      s.o.temp = 1 - 0.5 * u;
    }
    if (fired < 1 && tau >= 1.85) {
      fired = 1;
      out.ripples.push({ x: LIPX, y: 0, amp: 0.3, size: 12 });
    }

    // The mould: scanned in from the top, glowing where the metal is, then cracking open and falling away.
    const scan = io(sm(0, 0.95, tau));
    const ys = lerp(40, -36, scan);
    for (const t of trays) {
      const o = t.obj;
      o.clip = scan < 1 ? [0, -1, 0, -ys] : undefined;
      const glow = 0.06 + 1.1 * t.hot(tau, L, c) ** 1.3;
      o.cavity = [HI, HI, glow, 0];
      const a = tau - t.start;
      if (a <= 0) {
        o.position = t.c;
        o.rotation = [0, 0, 0];
        o.scale = 1;
        o.visible = true;
        continue;
      }
      const g = 210;
      const dirx = t.kind === 'square' ? Math.sign(t.c[0] || 1) : 1;
      o.position = [t.c[0] + t.v[0] * a * (t.kind === 'arc' ? 1 : dirx), t.c[1] + t.v[1] * a - 0.5 * g * a * a, t.c[2] - t.v[2] * a];
      o.rotation = [t.spin[1] * a * 0.6, t.kind === 'arc' ? t.spin[1] * a : t.spin[0] * a * 0.4, t.spin[0] * a];
      const s = 1 - io(sm(0.28, 0.62, a));
      o.scale = Math.max(0.001, s);
      o.visible = s > 0.002;
    }
    return out;
  };

  return {
    update,
    finish() {
      if (finished) return;
      finished = true;
      settlePieces();
      hideAll();
    },
    dispose() {
      for (const o of owned) stage.remove(o);
    },
  };
}
