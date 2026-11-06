// Meshes for the pour (lib/gl3d/pour.ts): a lathed crucible, the stream, sand trays for the mould. Pure JS, no GL.
import { extrude, recentre, slab, sphere } from './geometry';
import type { Mesh, Vec3 } from './geometry';

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
/** Unit-height tapered cylinder, centred, radius .5 at the top and .33 at the bottom. */
export function streamMesh(): Mesh {
  return lathe([[0, 0.5], [0.5, 0.5], [0.33, -0.5], [0, -0.5]], 16);
}

export function translate(m: Mesh, d: Vec3): Mesh {
  const p = new Float32Array(m.p);
  for (let k = 0; k < p.length; k++) p[k] += d[k % 3];
  return { ...m, p };
}
export function merge(parts: Mesh[]): Mesh {
  let nv = 0, ni = 0;
  for (const m of parts) { nv += m.p.length; ni += m.i.length; }
  const p = new Float32Array(nv), n = new Float32Array(nv), idx: number[] = [];
  let o = 0;
  for (const m of parts) {
    p.set(m.p, o); n.set(m.n, o);
    const base = o / 3;
    for (let k = 0; k < m.i.length; k++) idx.push(m.i[k] + base);
    o += m.p.length;
  }
  return { p, n, i: nv / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx) };
}

const WALL = 1.5; // sand wall thickness
const ZW = 2.4; // walls stand this far in front of and behind the mark plane
const FLOOR = 1.2;
const BEV = 0.4;

/** A tray for one square: a floor and four walls around a (2·hw)² pocket. Centred on the square. */
export function squareTray(hw: number, openLeft = false): Mesh {
  const o = hw + WALL, mid = hw + WALL / 2;
  const wall = (w: number, h: number, x: number, y: number) => translate(slab(w, h, ZW * 2, BEV, 2), [x, y, 0]);
  return merge([
    translate(slab(o, o, FLOOR, BEV, 2), [0, 0, -ZW + FLOOR / 2]),
    wall(o, WALL / 2, 0, mid), wall(o, WALL / 2, 0, -mid),
    wall(WALL / 2, hw, mid, 0), ...(openLeft ? [] : [wall(WALL / 2, hw, -mid, 0)]),
  ]);
}

const band = (r: number, w: number, a0: number, a1: number) => {
  const n = Math.max(14, Math.round(((a1 - a0) * r) / 1.1));
  return (k: number): Pt[][] => {
    const ro = r + w / 2 - k, ri = r - w / 2 + k, s = k / r, t0 = a0 + s, t1 = a1 - s;
    const at = (R: number, t: number): Pt => [R * Math.cos(t), R * Math.sin(t)];
    const outer = Array.from({ length: n + 1 }, (_, j) => at(ro, t0 + ((t1 - t0) * j) / n));
    const inner = Array.from({ length: n + 1 }, (_, j) => at(ri, t1 - ((t1 - t0) * j) / n));
    return [outer, [outer[n], inner[0]], inner, [inner[n], outer[0]]];
  };
};
const disc = (r: number) => (k: number): Pt[][] => {
  const n = 40, R = r - k;
  return [Array.from({ length: n + 1 }, (_, j) => [R * Math.cos((j / n) * Math.PI * 2), R * Math.sin((j / n) * Math.PI * 2)] as Pt)];
};

/** A tray for a half-ring channel of radius r and width w, from a0 to a1 (radians, ring centre at the origin). Returns the recentred mesh and its centre. */
export function arcTray(r: number, w: number, a0: number, a1: number): { mesh: Mesh; center: Vec3 } {
  const tw = w + WALL * 2;
  const floor = translate(extrude(band(r, tw, a0, a1), FLOOR, BEV, 2), [0, 0, -ZW + FLOOR / 2]);
  const wallOf = (rr: number) => extrude(band(rr, WALL, a0, a1), ZW * 2, BEV, 2);
  const mesh = merge([floor, wallOf(r + w / 2 + WALL / 2), wallOf(r - w / 2 - WALL / 2)]);
  return { mesh, center: recentre(mesh) };
}

/** A tray for the round core: a floor disc and a wall around the sphere. */
export function coreTray(r: number): Mesh {
  const half = (a0: number) => extrude(band(r + WALL / 2 + 0.2, WALL, a0, a0 + Math.PI), ZW * 2, BEV, 2);
  return merge([translate(extrude(disc(r + WALL + 0.2), FLOOR, BEV, 2), [0, 0, -ZW + FLOOR / 2]), half(0), half(Math.PI)]);
}

export const smallSphere = (r: number) => sphere(r, 12, 8);
export const cube = (h: number) => slab(h, h, h * 2, h * 0.28, 2);
