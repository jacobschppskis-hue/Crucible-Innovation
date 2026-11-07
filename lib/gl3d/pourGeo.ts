// Meshes for the pour (lib/gl3d/pour.ts): a lathed crucible, the stream, the trickles down the arcs. Pure JS, no GL.
// The mark's own pieces (lib/gl3d/geometry.ts logoPieces) are what the metal fills: there is no mould.
import { slab, sphere } from './geometry';
import type { Mesh } from './geometry';

type Pt = [number, number];

/**
 * Surface of revolution about y. `profile` = (radius, y) points; the outward-facing side is on the left of the walk
 * direction (so walk an inner wall bottom → rim, then the outer wall rim → bottom). `a0..a1` = the swept angle.
 */
export function lathe(profile: Pt[], seg: number, a0 = 0, a1 = Math.PI * 2): Mesh {
  const n2: Pt[] = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(profile.length - 1, i + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
    return [-dy / l, dr / l];
  });
  const p: number[] = [], n: number[] = [], idx: number[] = [];
  for (let s = 0; s <= seg; s++) {
    const ph = a0 + ((a1 - a0) * s) / seg, c = Math.cos(ph), sn = Math.sin(ph);
    profile.forEach(([r, y], i) => {
      p.push(r * c, y, r * sn);
      n.push(n2[i][0] * c, n2[i][1], n2[i][0] * sn);
    });
  }
  const m = profile.length;
  for (let s = 0; s < seg; s++) for (let i = 0; i < m - 1; i++) {
    const a = s * m + i, b = (s + 1) * m + i;
    idx.push(a, b, b + 1, a, b + 1, a + 1);
  }
  const I = p.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
  return { p: new Float32Array(p), n: new Float32Array(n), i: I };
}

/** Crucible, axis y, rim at y = 0. The front (toward +z) is cut away, so you look into the metal. */
export const CRU = { rim: 7.1, lip: 6.6, depth: 12.4 };
export function crucibleMesh(): Mesh {
  const prof: Pt[] = [
    [0, -10.6], [2.8, -10.5], [4.0, -9.8], [5.1, -5], [5.8, -0.4],
    [5.9, 0.2], [6.5, 0.55], [7.1, 0.2],
    [7.0, -0.6], [6.0, -5], [5.2, -9.5], [4.2, -11.4], [2.4, -12.2], [0, -12.4],
  ];
  return lathe(prof, 36, Math.PI * 0.8, Math.PI * 2.2);
}
/** The molten metal in it: the cup's inside, a little smaller, closed at the top (a clip plane cuts the surface). */
export function poolMesh(): Mesh {
  const f = 0.93;
  const prof: Pt[] = [[0, -10.3], [2.6, -10.2], [3.7, -9.5], [4.75, -5], [5.4, -0.3], [5.4, 0.2], [0, 0.2]].map(([r, y]) => [r * f, y] as Pt);
  return lathe(prof, 32);
}
/** Unit-height tapered cylinder, centred, radius .5 at the top and .4 at the bottom (a falling stream thins a little). */
export function streamMesh(): Mesh {
  return lathe([[0, 0.5], [0.5, 0.5], [0.4, -0.5], [0, -0.5]], 20);
}

/**
 * A thin tube along the half circle of radius `r` (ring centre at the origin, z = 0) from the top round the left to the
 * bottom: the line a hot trickle runs down, ahead of the fill. Normals point out of the tube.
 */
export function arcTube(r: number, tube: number, seg = 72, ring = 10): Mesh {
  const p: number[] = [], n: number[] = [], idx: number[] = [];
  for (let s = 0; s <= seg; s++) {
    const th = Math.PI / 2 + (Math.PI * s) / seg, c = Math.cos(th), sn = Math.sin(th);
    for (let k = 0; k <= ring; k++) {
      const ps = (2 * Math.PI * k) / ring, a = Math.cos(ps), b = Math.sin(ps);
      n.push(a * c, a * sn, b);
      p.push((r + tube * a) * c, (r + tube * a) * sn, tube * b);
    }
  }
  const m = ring + 1;
  for (let s = 0; s < seg; s++) for (let k = 0; k < ring; k++) {
    const a = s * m + k, b = a + m;
    idx.push(a, b, b + 1, a, b + 1, a + 1);
  }
  return { p: new Float32Array(p), n: new Float32Array(n), i: new Uint16Array(idx) };
}

export const smallSphere = (r: number) => sphere(r, 12, 8);
export const cube = (h: number) => slab(h, h, h * 2, h * 0.28, 2);
