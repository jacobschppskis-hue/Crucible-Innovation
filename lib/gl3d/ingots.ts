// The ventures' ingots, freestanding, facing +z, no floor. Units ≈ 100 across. `ingot(kind)` returns a mesh-less root plus parts;
// `addIngot` (index.ts) adds them to a stage with the parts parented to the root: move/rotate/scale the root to float and turn it.
import { logoPieces, mouldBrick, slab, type Vec3 } from './geometry';
import { reliefCanvas } from './materials';
import type { ObjectInit } from './core';

export type IngotKind = 'sites' | 'verge' | 'trellis';
export const INGOT = { w: 100, h: 56, d: 11, brickD: 24 } as const;
/** The family the site ships: next/font names it `__Archivo_xxxx` and exposes it as --font-archivo; the stills page defines `Archivo`. */
const family = () => {
  if (typeof document === 'undefined') return 'Archivo';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-archivo').trim();
  return v ? `${v}, Archivo` : 'Archivo';
};
const FONT = () => `800 {s}px ${family()}, sans-serif`;
/** Load the face before `ingot()` draws the lettering (the relief map is drawn once; a fallback face would stay in it). */
export async function loadIngotFont() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try { await Promise.all([document.fonts.load(FONT().replace('{s}', '64'), 'CrucibleSitesVergeTrellis'), document.fonts.ready]); } catch { /* falls back to the stack */ }
}

/** The root object is `parts[0]` (no mesh); others carry `parent` set later by `addIngot`. */
export type IngotSpec = { root: ObjectInit; parts: ObjectInit[] };

export function ingot(kind: IngotKind): IngotSpec {
  const { w, h, d, brickD } = INGOT;
  const root: ObjectInit = {};
  const parts: ObjectInit[] = [];
  const text = (c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number) => {
    c.font = FONT().replace('{s}', String(size)); c.textBaseline = 'alphabetic'; c.fillText(s, x, y);
  };
  if (kind === 'sites') {
    const cw = 2048, ch = Math.round((cw * h) / w); // the map has the plate's own aspect, or the letters come out squeezed
    const cv = reliefCanvas(cw, ch, (c) => { text(c, 'Crucible', cw * 0.43, ch * 0.47, ch * 0.19); text(c, 'Sites', cw * 0.43, ch * 0.73, ch * 0.19); });
    parts.push({ mesh: slab(w / 2, h / 2, d, 1.4), material: 'cast', grain: 0.5, relief: { canvas: cv, x: 0, y: 0, w, h, strength: 2 }, tone: 1, temper: [30, 0.55] });
    const s = 0.5, front = d / 2;
    for (const p of logoPieces()) {
      const core = p.kind === 'core';
      parts.push({ mesh: p.mesh, material: 'cast', tone: 0.9, grain: 1.1, seed: core ? 4 : 1, scale: core ? [s, s, s * 0.5] : [s, s, s * 3.2], position: [-24 + p.center[0] * s, p.center[1] * s, front + (core ? 0 : 1.2 * s * 3.2 - 0.25)] });
    }
  } else {
    const hw = w / 2, hh = h / 2, cw = 42, chh = 22, depth = 10, front = brickD / 2;
    parts.push({ mesh: mouldBrick(hw, hh, brickD, cw, chh, depth), material: 'sand', grain: 0.6, cavity: [cw, chh, 0.55, front] });
    const mw = 2048, mh = Math.round((mw * (chh * 2 - 2)) / (cw * 2 - 2));
    const cv = reliefCanvas(mw, mh, (c) => {
      // The ventures' drawn marks (public/ventures/*.svg): a raised rounded tile with the glyph cut into it, then the word, clear of it.
      const u = mh * 0.42, x0 = mw * 0.055, y0 = (mh - u) / 2, k = u / 512, r = u * 0.19;
      c.beginPath(); c.roundRect(x0, y0, u, u, r); c.fill();
      c.fillStyle = '#000';
      if (kind === 'verge') { // TODO(jakob): Verge's real mark. Placeholder: an Archivo V (the display face, 800) cut into the tile, not the serif of public/ventures/verge.svg.
        c.font = FONT().replace('{s}', String(Math.round(u * 0.72))); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillText('V', x0 + u / 2, y0 + u * 0.5 + u * 0.72 * 0.36); c.textAlign = 'left';
      } else {
        // lattice from the SVG (1024 box, 640 square, 64 strokes), scaled to 80% of the tile
        const sq = u * 0.62, o = (u - sq) / 2, t = sq * 0.1, g = (v: number) => o + (v - 192) / 640 * sq;
        c.fillRect(x0 + o, y0 + g(296), sq, t); c.fillRect(x0 + o, y0 + g(480), sq, t); c.fillRect(x0 + o, y0 + g(664), sq, t);
        c.fillRect(x0 + g(336), y0 + o, t, sq); c.fillRect(x0 + g(624), y0 + o, t, sq);
      }
      c.fillStyle = '#fff';
      text(c, kind === 'verge' ? 'Verge' : 'Trellis', mw * 0.32, mh * 0.5 + mh * 0.4 * 0.36, mh * 0.4);
    });
    parts.push({ mesh: slab(cw - 1, chh - 1, 7, 1.6), material: 'ingot', temp: 0.3, grain: 0.5, seed: kind === 'verge' ? 3 : 9, position: [0, 0, front - depth + 4], relief: { canvas: cv, x: 0, y: 0, w: (cw - 1) * 2, h: (chh - 1) * 2, strength: 5 } });
  }
  return { root, parts };
}
