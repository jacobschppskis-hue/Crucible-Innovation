// A height patch: the liquid's surface over one rectangle, as a small lattice of heights (px), made on the main thread
// (field.ts `heightPatch`) and posted to a worker with the frame. DOM-free, so workers import it to sample the patch
// exactly like the main thread samples the grid (bilinear heights, slope by central differences, same footprint).

import type { Footprint, HG } from './field';

/** Heights (px) at x + w * i / (nx - 1), y + h * j / (ny - 1) (page px), row-major (j * nx + i). */
export type Patch = { x: number; y: number; w: number; h: number; nx: number; ny: number; data: Float32Array };

const at = (p: Patch, i: number, j: number) => p.data[Math.min(p.ny - 1, Math.max(0, j)) * p.nx + Math.min(p.nx - 1, Math.max(0, i))];

/** Height (px) and slope at page px (x, y), clamped to the patch. */
export function samplePatch(p: Patch, x: number, y: number, out: HG = { h: 0, gx: 0, gy: 0 }): HG {
  const sx = p.w / Math.max(1, p.nx - 1);
  const sy = p.h / Math.max(1, p.ny - 1);
  const gx = Math.min(p.nx - 1, Math.max(0, (x - p.x) / sx));
  const gy = Math.min(p.ny - 1, Math.max(0, (y - p.y) / sy));
  const i = Math.min(p.nx - 2, Math.floor(gx));
  const j = Math.min(p.ny - 2, Math.floor(gy));
  const fx = gx - i;
  const fy = gy - j;
  const h = (a: number, b: number) => at(p, a, b);
  const lerp2 = (a: number, b: number) => {
    const top = h(a, b) + (h(a + 1, b) - h(a, b)) * fx;
    const bot = h(a, b + 1) + (h(a + 1, b + 1) - h(a, b + 1)) * fx;
    return top + (bot - top) * fy;
  };
  out.h = lerp2(i, j);
  // slope: central differences of the bilinear surface one lattice step apart (smooth across lattice lines)
  const d = (u: number, v: number) => {
    const ui = Math.min(p.nx - 2, Math.max(0, Math.floor(u)));
    const vj = Math.min(p.ny - 2, Math.max(0, Math.floor(v)));
    const ax = Math.min(1, Math.max(0, u - ui));
    const ay = Math.min(1, Math.max(0, v - vj));
    const top = h(ui, vj) + (h(ui + 1, vj) - h(ui, vj)) * ax;
    const bot = h(ui, vj + 1) + (h(ui + 1, vj + 1) - h(ui, vj + 1)) * ax;
    return top + (bot - top) * ay;
  };
  out.gx = (d(gx + 0.5, gy) - d(gx - 0.5, gy)) / sx;
  out.gy = (d(gx, gy + 0.5) - d(gx, gy - 0.5)) / sy;
  return out;
}

const tmp: HG = { h: 0, gx: 0, gy: 0 };

/** The surface under a box (page px), averaged like field.ts `footprint()`, from a patch that covers it. */
export function footprintPatch(p: Patch, x: number, y: number, w: number, h: number, out: Footprint): Footprint {
  const nx = w > 240 ? 5 : w > 60 ? 3 : 1;
  const ny = h > 160 ? 3 : h > 70 ? 2 : 1;
  let sh = 0, sgx = 0, sgy = 0, sxh = 0, sxx = 0, syh = 0, syy = 0, n = 0;
  const cx = x + w / 2;
  const cy = y + h / 2;
  for (let b = 0; b < ny; b++) {
    const py = ny === 1 ? cy : y + h * (0.15 + (0.7 * b) / (ny - 1));
    for (let a = 0; a < nx; a++) {
      const px = nx === 1 ? cx : x + w * (0.08 + (0.84 * a) / (nx - 1));
      samplePatch(p, px, py, tmp);
      sh += tmp.h;
      sgx += tmp.gx;
      sgy += tmp.gy;
      sxh += (px - cx) * tmp.h;
      sxx += (px - cx) ** 2;
      syh += (py - cy) * tmp.h;
      syy += (py - cy) ** 2;
      n++;
    }
  }
  out.h = sh / n;
  out.gx = sgx / n;
  out.gy = sgy / n;
  out.roll = sxx > 0 ? sxh / sxx : out.gx;
  out.pitch = syy > 0 ? syh / syy : out.gy;
  return out;
}
