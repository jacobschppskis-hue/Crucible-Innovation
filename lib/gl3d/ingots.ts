// The ventures' ingots: cast bars (lib/gl3d/geometry.ts `goldBar`), freestanding, no casing, no floor. Object units:
// length along x (100 at the foot), width along y, the stamped top face toward +z. The stamp is cut into the top face as
// a relief map drawn here (white = cut in): Crucible Sites carries the Split Ring and its name, the bars still forging
// carry their names alone. `ingot(kind)` returns a mesh-less root plus
// the bar; `addIngot` (index.ts) parents the bar to the root: move/rotate the root to float and turn it.
import { BAR, goldBar, type Mesh } from './geometry';
import { reliefCanvas } from './materials';
import { RING, arcOutline, cells } from '../splitRing';
import type { ObjectInit } from './core';

export type IngotKind = 'sites' | 'verge' | 'trellis';
/** The bar's dimensions (object units), see geometry.ts `BAR`. */
export const INGOT = BAR;
/** The family the site ships: next/font names it `__Archivo_xxxx` and exposes it as --font-archivo; the stills page and the worker define `Archivo`. */
const family = () => {
  if (typeof document === 'undefined') return 'Archivo';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-archivo').trim();
  return v ? `${v}, Archivo` : 'Archivo';
};
const FONT = (s: number) => `800 ${s}px ${family()}, sans-serif`;
/** Load the face before `ingot()` draws the lettering (the relief map is drawn once; a fallback face would stay in it). */
export async function loadIngotFont() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try { await Promise.all([document.fonts.load(FONT(64), 'CrucibleSitesVergeTrellis'), document.fonts.ready]); } catch { /* falls back to the stack */ }
}

/** The root object is `root` (no mesh); `parts[0]` is the bar, parented to it by `addIngot`. */
export type IngotSpec = { root: ObjectInit; parts: ObjectInit[] };

/** The liquid's surface under the bar: a quad in the plane of its foot, `m` units past it all round (the light it casts). */
function pool(m = 34): Mesh {
  const a = BAR.L / 2 + m, b = BAR.W / 2 + m, z = -BAR.H / 2;
  return {
    p: new Float32Array([-a, -b, z, a, -b, z, a, b, z, -a, b, z]),
    n: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    i: new Uint16Array([0, 1, 2, 0, 2, 3]),
  };
}

// The stamp covers the flat of the top face (84.8 x 30.8 at BAR's size); 2048 px across.
const SW = 82, SH = 29, MW = 2048, MH = Math.round((MW * SH) / SW);
const PX = MW / SW; // canvas px per object unit

/** The Crucible Split Ring (lib/splitRing.ts), `size` units tall, centred at (x, y) units from the stamp's centre (y up). */
function ring(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const k = (size * PX) / 57.6; // the mark's box is 3.2..60.8 of its 64 units
  c.save();
  c.translate(MW / 2 + x * PX, MH / 2 - y * PX);
  c.scale(k, k);
  c.translate(-RING.c, -RING.c);
  for (const { r } of RING.rings) c.fill(new Path2D(arcOutline(r)));
  for (const q of cells()) c.fillRect(q.x - RING.px / 2, q.y - RING.px / 2, RING.px, RING.px);
  c.beginPath(); c.arc(RING.c, RING.c, RING.core, 0, Math.PI * 2); c.fill();
  c.restore();
}

/** Words set left-aligned from x (units), each line's cap height `cap` units, centred as a block on y = 0. */
function words(c: CanvasRenderingContext2D, lines: string[], x: number, cap: number, lead: number) {
  const size = (cap / 0.72) * PX; // Archivo's cap height is about 0.72 em
  c.font = FONT(Math.round(size)); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const block = cap * lines.length + (lead - cap) * (lines.length - 1);
  lines.forEach((s, i) => c.fillText(s, MW / 2 + x * PX, MH / 2 + (-block / 2 + cap + i * lead) * PX));
}

/** One word centred on the stamp, cap height `cap` units. */
function name(c: CanvasRenderingContext2D, s: string, cap: number) {
  c.font = FONT(Math.round((cap / 0.72) * PX)); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillText(s, MW / 2, MH / 2 + (cap / 2) * PX);
}

export function ingot(kind: IngotKind): IngotSpec {
  const root: ObjectInit = {};
  const stamp = reliefCanvas(MW, MH, (c) => {
    if (kind === 'sites') {
      ring(c, -28, 0, 19);
      words(c, ['Crucible', 'Sites'], -14.5, 8, 11.5);
    } else {
      // Still forging: the name alone, centred on the face (TODO(jakob): Verge's and Trellis' own marks, once they exist).
      name(c, kind === 'verge' ? 'Verge' : 'Trellis', 12.5);
    }
  });
  const relief = { canvas: stamp, x: 0, y: 0, w: SW, h: SH };
  const hot = kind !== 'sites';
  const mesh = goldBar();
  const bar: ObjectInit = hot
    ? // Still molten all over: one seamless glow, the name cut in a little cooler.
      { mesh, material: 'ingot', grain: 0.45, seed: kind === 'verge' ? 3 : 9, relief: { ...relief, strength: -2.6 } }
    : // Set and cooled: bone metal with a faint warm temper along the top edges and the last of its heat in the stamp.
      { mesh, material: 'bar', tone: 0.2, temp: 1, temper: [0, 0.45], grain: 0.5, seed: 2, relief: { ...relief, strength: -2.4 } };
  // Its reflection in the liquid (the same bar mirrored through the surface at its foot) and the light it casts there.
  const mirror: ObjectInit = { ...bar, relief: { ...relief, strength: 0 }, scale: [1, 1, -1], position: [0, 0, -BAR.H], reflect: hot ? 0.55 : 0.22 };
  const glow: ObjectInit = { mesh: pool(), material: 'pool', temp: hot ? 1 : 0.06, seed: bar.seed };
  return { root, parts: [mirror, glow, bar] };
}
