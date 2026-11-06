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
    parts.push({ mesh: slab(w / 2, h / 2, d, 1.4), material: 'cast', grain: 0.5, relief: { canvas: cv, x: 0, y: 0, w, h, strength: 1.6 }, tone: 1, temper: [30, 0.55] });
    const s = 0.5, front = d / 2;
    for (const p of logoPieces()) {
      const core = p.kind === 'core';
      parts.push({ mesh: p.mesh, material: 'cast', tone: 0.45, grain: 1.1, seed: core ? 4 : 1, scale: core ? [s, s, s * 0.5] : [s, s, s * 3.2], position: [-24 + p.center[0] * s, p.center[1] * s, front + (core ? 0 : 1.2 * s * 3.2 - 0.25)] });
    }
  } else {
    const hw = w / 2, hh = h / 2, cw = 42, chh = 22, depth = 10, front = brickD / 2;
    parts.push({ mesh: mouldBrick(hw, hh, brickD, cw, chh, depth), material: 'sand', grain: 0.6, cavity: [cw, chh, 0.55, front] });
    const mw = 2048, mh = Math.round((mw * (chh * 2 - 2)) / (cw * 2 - 2));
    const cv = reliefCanvas(mw, mh, (c) => {
      if (kind === 'verge') {
        const u = mh * 0.28, x0 = mw * 0.07, y0 = mh * 0.36, t = u * 0.17; // a plain chevron V, square-cut
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + t * 1.25, y0); c.lineTo(x0 + u / 2, y0 + u - t * 1.6); c.lineTo(x0 + u - t * 1.25, y0); c.lineTo(x0 + u, y0); c.lineTo(x0 + u / 2 + t * 0.7, y0 + u); c.lineTo(x0 + u / 2 - t * 0.7, y0 + u); c.closePath(); c.fill();
        text(c, 'Verge', mw * 0.26, mh * 0.64, mh * 0.4);
      } else {
        const u = mh * 0.28, x0 = mw * 0.07, y0 = mh * 0.36, t = u / 8;
        c.fillRect(x0, y0 + u * 0.28, u, t); c.fillRect(x0, y0 + u * 0.62, u, t); c.fillRect(x0 + u * 0.3, y0, t, u); c.fillRect(x0 + u * 0.64, y0, t, u);
        text(c, 'Trellis', mw * 0.26, mh * 0.64, mh * 0.4);
      }
    });
    parts.push({ mesh: slab(cw - 1, chh - 1, 7, 1.6), material: 'ingot', temp: 0.3, grain: 0.5, seed: kind === 'verge' ? 3 : 9, position: [0, 0, front - depth + 4], relief: { canvas: cv, x: 0, y: 0, w: (cw - 1) * 2, h: (chh - 1) * 2, strength: 5 } });
  }
  return { root, parts };
}
