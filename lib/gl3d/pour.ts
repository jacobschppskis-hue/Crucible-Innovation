// The home opening's pour, in 3D, inside the logo's own transparent canvas. There is no mould: the metal is poured into
// the mark's own shape. Under this canvas a hairline drawing of the mark (the ghost, SVG in components/Ignition.tsx)
// scans in; a crucible drops in, three cold cells melt in it and it tips; a thin stream (white at its heart, orange at
// its edges) falls into the core, which fills white-hot; hot trickles run down each arc's centre line; then the metal
// rises through the pieces themselves, each in its own shape, covering the ghost's outlines as it goes (they are drawn
// just inside each piece's edge, so the opaque metal hides them exactly where it is). It cools from white-hot through
// orange to bone, the core stays orange, and the logo is released onto the liquid. Nothing breaks away.
// Pure function of the pour clock `tau` (seconds at full tempo; the caller scales a quick repeat intro). Beats follow
// the CSS timings in app/globals.css (ghost scan 0-0.9 s and ghost fade 2.7-3.05 s, both scrubbed from this clock by
// Ignition.tsx; headline lift from 1.8 s).
import type { Obj, Stage } from './core';
import type { Piece, Vec3 } from './geometry';
import { RING } from '../splitRing';
import { arcTube, crucibleMesh, cube, poolMesh, smallSphere, streamMesh } from './pourGeo';

export type PourPiece = { piece: Piece; obj: Obj };
export type Ripple = { x: number; y: number; amp: number; size: number }; // mark units from the ring centre, y up
export type PourTick = { float: number; release: boolean; ripples: Ripple[]; done: boolean };
export type Pour = { update(tau: number): PourTick; finish(): void; dispose(): void };

/** Time (s at full tempo) at which the pour is over and the logo is released. */
export const POUR_END = 4.25;

const LIPX = 0; // the crucible's pouring lip: straight above the core, so the stream lands on the drawing's centre line
const K = 0.92; // crucible scale
const CRU_Z = 5.5; // the crucible and the stream stand in front of the mark's plane, so they never intersect it
const STREAM_Z = 4.2;
const D = 130; // heat falls from white at the metal's surface to bone this many units below it
const CORE_R = RING.core;
const TUBE = 0.42; // trickle radius (the band is RING.stroke = 3.6 wide)

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
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

const TILT: [number, number][] = [[0, 0], [1.25, 0], [1.5, 24], [3.0, 58], [3.32, 5]];
const RIM = 13.7 * K; // the cup's far rim from its lip: tipping by theta lifts it RIM sin(theta)
const POOL: [number, number][] = [[0.7, -12], [1.35, -4.4], [1.52, -1.0], [2.98, -1.0], [3.3, -10.6]];
const CRU_X = LIPX - 6.6; // the cup's axis, upright
const INGOTS: Vec3[] = [[CRU_X - 1.45, 0, 0], [CRU_X + 1.45, 0, 0], [CRU_X, 2.9, 0]];
const STREAM_T0 = 1.5; // the stream leaves the lip
const STREAM_T1 = 1.82; // and lands in the core
const Y_END = 3.1; // where it lands (inside the core's top)

export function createPour(stage: Stage, pieces: PourPiece[], headroom = 40): Pour {
  // The crucible stands fully below the nav: its lip is at most `headroom` mark units above the ring's centre, and
  // as it tips it is lowered (as a pourer follows the stream) so its rising back rim stays below the nav too.
  const LIPY = clamp(headroom - 1.5, 21, 36.5);
  const lipAt = (tau: number) => clamp(headroom - 0.5 - RIM * Math.sin((path(TILT, tau) * Math.PI) / 180), 20, LIPY);
  const DROP = 4; // it settles in from just above
  const owned: Obj[] = [];
  const add = (init: Parameters<Stage['add']>[0]) => {
    const o = stage.add(init);
    owned.push(o);
    return o;
  };

  // ---- Crucible: a pivot on the lip, the cup (front cut away) and the molten pool in it. ----
  const pivot = add({});
  const cup = add({ mesh: crucibleMesh(), material: 'cast', tone: 0.92, grain: 0.8, seed: 4, parent: pivot, position: [-6.6, -0.55, 0] });
  const pool = add({ mesh: poolMesh(), material: 'hot', temp: 1, edge: 0.35, grain: 0.5, seed: 2, parent: cup });

  const ingots = INGOTS.map((p, i) => add({ mesh: cube(1.45), material: 'hot', temp: 0, grain: 0.7, seed: 6 + i, visible: false, position: [...p] as Vec3 }));
  // A thin stream: white at its heart, orange where you see its edges.
  const stream = add({ mesh: streamMesh(), material: 'hot', temp: 0.92, edge: 0.85, grain: 0.5, seed: 9, visible: false });
  const blob = add({ mesh: smallSphere(1.7), material: 'hot', temp: 1, edge: 0.2, grain: 0.5, seed: 1, visible: false });
  const sparkMesh = smallSphere(0.6);
  const sparks = Array.from({ length: 18 }, (_, k) => ({ o: add({ mesh: sparkMesh, material: 'hot', temp: 1, grain: 0.5, seed: k, visible: false }), te: 1.86 + k * 0.07, vx: (hash(k + 1) - 0.5) * 30, vy: 20 + hash(k + 40) * 24, vz: (hash(k + 80) - 0.3) * 10, x0: LIPX + (hash(k + 120) - 0.5) * 1.6 }));

  // ---- Trickles: hot metal running down each arc's centre line ahead of the fill (inside the band, so the rising
  // metal swallows them). Each is revealed from the top by a clip plane turning about the ring centre. ----
  const { rings } = RING;
  // The stream passes each arc's top on its way down; the trickle starts there.
  const lip0 = lipAt(1.65);
  const passes = (y: number) => STREAM_T0 + (STREAM_T1 - STREAM_T0) * Math.sqrt(clamp01((lip0 - y) / (lip0 - Y_END)));
  const trickles = rings.map(({ r }, ri) => {
    const t0 = passes(r) + 0.02;
    return {
      r,
      t0,
      t1: 2.12 - ri * 0.02,
      tube: add({ mesh: arcTube(r, TUBE), material: 'hot', temp: 0.93, edge: 0.7, grain: 0.5, seed: 20 + ri, visible: false }),
      head: add({ mesh: smallSphere(TUBE * 1.5), material: 'hot', temp: 1, edge: 0.5, grain: 0.5, seed: 24 + ri, visible: false }),
    };
  });

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
      obj.edge = 0;
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

    // Heat: the metal's surface L rises through the pieces; white-hot at the surface, cooler below; then everything cools.
    const rise = io(sm(2.0, 3.05, tau));
    const L = lerp(-31, 31, rise);
    const c = io(sm(2.9, 4.15, tau));

    // The mark's own pieces become metal: clipped by the rising level, on one shared heat field. The bevels catch a
    // little orange at their edges, so the white-hot shapes keep their form.
    for (const { obj } of hotPieces) {
      obj.material = 'hot';
      obj.clip = [0, 1, 0, L];
      obj.temp = 1 - L / D - c;
      obj.tgrad = 1 / D;
      obj.grain = 0.4;
      obj.edge = 0.5;
    }
    {
      const o = corePiece.obj;
      o.material = 'core'; // the core's own smooth sphere, heated by temp (white-hot at 1, its own orange from .5)
      o.clip = [0, 1, 0, lerp(-CORE_R - 0.4, CORE_R + 0.4, eo(sm(1.82, 2.5, tau)))];
      // It cools only to the glowing orange of the core material it becomes at the release, its rim no cooler than its heart.
      o.temp = 1 - 0.5 * c;
      o.tgrad = 0;
      o.edge = 0.35 * (1 - c);
    }

    // Crucible: drops in with a little weight, tips about its lip, is righted and lifted away.
    const k = sm(0.15, 0.72, tau) - 1;
    const back = 1 + 2.2 * k * k * k + 1.2 * k * k; // ease out with a small overshoot
    const dy = DROP * (1 - back);
    const lift = 30 * ei(sm(3.3, 3.95, tau));
    const theta = path(TILT, tau);
    const lip = lipAt(tau);
    pivot.position = [LIPX, lip + dy + lift, CRU_Z];
    pivot.rotation = [0, 0, (-theta * Math.PI) / 180];
    pivot.scale = K * (1 - sm(3.8, 3.97, tau) * 0.999);
    const cupOn = tau >= 0.15 && tau < 3.97;
    cup.visible = pool.visible = cupOn;
    pool.clip = [0, 1, 0, lip + dy + lift + path(POOL, tau)];
    pool.temp = 1 - 0.18 * sm(1.5, 3.2, tau);
    cup.temp = 0;

    // Three cold cells drop in, glow and slump into the pool.
    INGOTS.forEach((p, i) => {
      const o = ingots[i];
      const t0 = 0.3 + i * 0.09;
      const slump = io(sm(0.95 + i * 0.07, 1.32 + i * 0.07, tau));
      o.visible = tau >= t0 && slump < 1;
      const fall = ei(sm(t0, t0 + 0.4, tau));
      const rest = lip + dy + (-11.15 + 1.5 + p[1]) * K;
      o.position = [LIPX + (p[0] - LIPX) * K, rest + DROP * 1.2 * (1 - fall) + 0.7 * Math.sin(Math.PI * sm(t0 + 0.4, t0 + 0.62, tau)), CRU_Z];
      o.scale = [K * (1 + 0.4 * slump), K * (1 - 0.85 * slump), K];
      o.temp = io(sm(0.62, 1.18, tau)) * 0.95;
    });

    // The stream: falls from the lip to the core, pours, thins as the cup empties, then lets go.
    const head = lerp(lip, Y_END, ei(sm(STREAM_T0, STREAM_T1, tau)));
    const tail = lerp(lip, Y_END, ei(sm(3.0, 3.28, tau)));
    const on = tau >= STREAM_T0 && tau < 3.28;
    stream.visible = on;
    if (on) {
      const wd = 1.8 * (1 - 0.4 * sm(2.5, 3.05, tau)) * (1 + 0.05 * Math.sin(tau * 38));
      const len = Math.max(0.01, tail - head);
      stream.position = [LIPX + 0.12 * Math.sin(tau * 21), (tail + head) / 2, STREAM_Z];
      stream.scale = [wd, len, wd];
    }
    const blobOn = tau >= STREAM_T1 - 0.02 && tau < 3.3;
    blob.visible = blobOn;
    if (blobOn) {
      const s = (0.5 + 0.12 * Math.sin(tau * 31)) * (1 - 0.6 * sm(2.8, 3.3, tau)) * eo(sm(STREAM_T1 - 0.02, 2.0, tau));
      blob.position = [LIPX, Y_END - 0.2, STREAM_Z];
      blob.scale = [1.3 * s, 0.8 * s, 1.1 * s];
    }
    for (const s of sparks) {
      const t = tau - s.te;
      const u = t / 0.8;
      s.o.visible = u >= 0 && u < 1 && tau < 3.4;
      if (!s.o.visible) continue;
      s.o.position = [s.x0 + s.vx * t, Y_END + s.vy * t - 0.5 * 105 * t * t, STREAM_Z + 0.3 + s.vz * t];
      s.o.scale = 0.2 + 0.8 * (1 - u) ** 0.7;
      s.o.temp = 1 - 0.5 * u;
    }
    if (fired < 1 && tau >= 1.85) {
      fired = 1;
      out.ripples.push({ x: LIPX, y: 0, amp: 0.3, size: 12 });
    }

    // Trickles: the visible part runs from the top (angle 90°) round the left to 90° + phi; the clip plane through the
    // ring centre keeps the half-plane facing direction phi.
    for (const tr of trickles) {
      const phi = Math.PI * io(sm(tr.t0, tr.t1, tau));
      const show = tau > tr.t0 && L < tr.r + 2;
      tr.tube.visible = show;
      tr.head.visible = show && phi < Math.PI - 0.01;
      if (!show) continue;
      tr.tube.clip = [-Math.cos(phi), -Math.sin(phi), 0, 0];
      tr.head.position = [-tr.r * Math.sin(phi), tr.r * Math.cos(phi), 0];
      tr.head.scale = 0.8 + 0.25 * Math.sin(tau * 40 + tr.r);
      tr.tube.temp = 0.93 - c;
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
