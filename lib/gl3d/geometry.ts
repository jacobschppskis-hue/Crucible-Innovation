// Mesh builders for the 3D logo and ingots: beveled extrusions of 2D outlines, spheres, boxes. Pure JS, no GL.
import { RING, cells } from '../splitRing';

export type Vec3 = [number, number, number];
export type Mesh = { p: Float32Array; n: Float32Array; i: Uint16Array | Uint32Array };
type Pt = [number, number];
/** One smooth run of the outline; chains meet at hard corners. `at(inset)` gives the points pulled in by `inset`. */
type Chains = (inset: number) => Pt[][];

class Builder {
  p: number[] = [];
  n: number[] = [];
  i: number[] = [];
  v(x: number, y: number, z: number, nx: number, ny: number, nz: number) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    return this.p.length / 3 - 1;
  }
  tri(a: number, b: number, c: number) {
    this.i.push(a, b, c);
  }
  quad(a: number, b: number, c: number, d: number) {
    this.i.push(a, b, c, a, c, d);
  }
  done(): Mesh {
    const I = this.p.length / 3 > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i);
    return { p: new Float32Array(this.p), n: new Float32Array(this.n), i: I };
  }
}

/** Ear clipping for a simple CCW polygon; returns triangle index triples into `pts`. */
function earClip(pts: Pt[]): number[] {
  const idx = pts.map((_, k) => k);
  const out: number[] = [];
  const cross = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = idx.length * idx.length;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      if (cross(a, b, c) <= 1e-9) continue;
      let ok = true;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        const q = pts[j];
        if (cross(a, b, q) >= 0 && cross(b, c, q) >= 0 && cross(c, a, q) >= 0) { ok = false; break; }
      }
      if (ok) { out.push(ia, ib, ic); idx.splice(k, 1); cut = true; break; }
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
  return out;
}

/**
 * Extrude a CCW outline (y up) into a slab centred on z = 0, `depth` thick, with a rounded bevel of radius `bev`
 * all round. `front`/`back` = false leaves that cap open (for a caller that closes it differently).
 */
export function extrude(chains: Chains, depth: number, bev: number, seg = 3, caps = { front: true, back: true }): Mesh {
  const b = new Builder();
  const base = chains(0);
  const prof: { inset: number; z: number; c: number; s: number }[] = [];
  const h = depth / 2;
  for (let k = seg; k >= 0; k--) { const t = (k / seg) * Math.PI / 2; prof.push({ inset: k === seg ? bev : bev - bev * Math.cos(t), z: h - bev + bev * Math.sin(t), c: Math.cos(t), s: Math.sin(t) }); }
  for (let k = 0; k <= seg; k++) { const t = (k / seg) * Math.PI / 2; prof.push({ inset: k === seg ? bev : bev - bev * Math.cos(t), z: -(h - bev + bev * Math.sin(t)), c: Math.cos(t), s: -Math.sin(t) }); }
  const insets = [...new Set(prof.map((q) => q.inset))];
  const cache = new Map<number, Pt[][]>(insets.map((v) => [v, chains(v)]));
  base.forEach((chain, ci) => {
    const m = chain.length;
    // outward 2D normal per vertex from the base outline (average of neighbouring edges)
    const en: Pt[] = [];
    for (let j = 0; j < m - 1; j++) {
      const dx = chain[j + 1][0] - chain[j][0], dy = chain[j + 1][1] - chain[j][1], l = Math.hypot(dx, dy) || 1;
      en.push([dy / l, -dx / l]);
    }
    const vn: Pt[] = chain.map((_, j) => {
      const a = en[Math.max(0, j - 1)], c = en[Math.min(en.length - 1, j)];
      const x = a[0] + c[0], y = a[1] + c[1], l = Math.hypot(x, y) || 1;
      return [x / l, y / l];
    });
    const rows: number[][] = prof.map((q) => {
      const pts = cache.get(q.inset)![ci];
      return pts.map((pt, j) => b.v(pt[0], pt[1], q.z, vn[j][0] * q.c, vn[j][1] * q.c, q.s));
    });
    for (let r = 0; r < rows.length - 1; r++) for (let j = 0; j < m - 1; j++) b.quad(rows[r][j], rows[r][j + 1], rows[r + 1][j + 1], rows[r + 1][j]);
  });
  const flat = (): Pt[] => {
    const pts: Pt[] = [];
    for (const c of cache.get(bev)!) for (const q of c.slice(0, -1)) pts.push(q);
    return pts;
  };
  if (caps.front || caps.back) {
    const pts = flat(), tris = earClip(pts);
    for (const [on, z, nz, flip] of [[caps.front, h, 1, false], [caps.back, -h, -1, true]] as const) {
      if (!on) continue;
      const vi = pts.map((q) => b.v(q[0], q[1], z, 0, 0, nz));
      for (let t = 0; t < tris.length; t += 3) flip ? b.tri(vi[tris[t]], vi[tris[t + 2]], vi[tris[t + 1]]) : b.tri(vi[tris[t]], vi[tris[t + 1]], vi[tris[t + 2]]);
    }
  }
  return b.done();
}

const rectChains = (hw: number, hh: number): Chains => (k) => {
  const w = hw - k, y = hh - k;
  const c: Pt[] = [[-w, -y], [w, -y], [w, y], [-w, y]];
  return [0, 1, 2, 3].map((j) => [c[j], c[(j + 1) % 4]]);
};

/** A slab (square when hw = hh). */
export const slab = (hw: number, hh: number, depth: number, bev: number, seg = 3, caps?: { front: boolean; back: boolean }) =>
  extrude(rectChains(hw, hh), depth, bev, seg, caps);

/**
 * The human half of the ring of radius `r` as one outline (y up, ring centre at the origin; lib/splitRing.ts
 * `arcOutline` is the same contour in SVG): the half circles round the left, cut flat on x = 0 (the core's centre line).
 * Chains break at the four corners of the flat ends; insets are miter offsets of the whole outline.
 */
function arcChains(r: number, w: number): Chains {
  const h = w / 2, ro = r + h, ri = r - h;
  const arc = (R: number, a: number, b: number): Pt[] => {
    const n = 2 * Math.max(6, Math.round((Math.abs(b - a) * R) / 2.4)); // even: a vertex at 9 o'clock, so the box is exact
    return Array.from({ length: n + 1 }, (_, j) => {
      const t = a + ((b - a) * j) / n;
      return [R * Math.cos(t), R * Math.sin(t)] as Pt;
    });
  };
  const H = Math.PI / 2;
  const base: Pt[][] = [
    [[0, ri], [0, ro]],
    arc(ro, H, 3 * H).map(([x, y], j, a) => (j === 0 || j === a.length - 1 ? [0, y] : [x, y]) as Pt),
    [[0, -ro], [0, -ri]],
    arc(ri, 3 * H, H).map(([x, y], j, a) => (j === 0 || j === a.length - 1 ? [0, y] : [x, y]) as Pt),
  ];
  // The closed outline (CCW), each chain's last point being the next chain's first.
  const loop: Pt[] = base.flatMap((ch) => ch.slice(0, -1));
  const m = loop.length;
  const miter: Pt[] = loop.map((p, k) => {
    const a = loop[(k + m - 1) % m], b = loop[(k + 1) % m];
    const n1 = norm([-(p[1] - a[1]), p[0] - a[0]]), n2 = norm([-(b[1] - p[1]), b[0] - p[0]]); // inward (left) normals
    const d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return [(n1[0] + n2[0]) / d, (n1[1] + n2[1]) / d];
  });
  const idx: number[][] = [];
  let o = 0;
  for (const ch of base) {
    idx.push(ch.map((_, j) => (o + j) % m));
    o += ch.length - 1;
  }
  return (k) => idx.map((ch) => ch.map((g) => [loop[g][0] + k * miter[g][0], loop[g][1] + k * miter[g][1]] as Pt));
}
/** One ring's arc outline as the 3D logo extrudes it (closed, CCW, y up, ring centre at the origin): for checks against the SVG. */
export const arcOutline3d = (r: number): Pt[] => arcChains(r, RING.stroke)(0).flatMap((ch) => ch.slice(0, -1));
const norm = (v: Pt): Pt => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};

export function sphere(r: number, nu = 28, nv = 18): Mesh {
  const b = new Builder();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const th = (j / nv) * Math.PI, ph = (i / nu) * Math.PI * 2;
    const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
    b.v(x * r, y * r, z * r, x, y, z);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i; b.quad(a, a + 1, a + nu + 2, a + nu + 1); }
  return b.done();
}

/** Shift the mesh so its bounding box is centred on the origin; returns the old centre. */
export function recentre(m: Mesh): Vec3 {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let k = 0; k < m.p.length; k++) { lo[k % 3] = Math.min(lo[k % 3], m.p[k]); hi[k % 3] = Math.max(hi[k % 3], m.p[k]); }
  const c = lo.map((v, k) => (v + hi[k]) / 2) as Vec3;
  for (let k = 0; k < m.p.length; k++) m.p[k] -= c[k % 3];
  return c;
}

export type Piece = { id: string; kind: 'arc' | 'square' | 'core'; mesh: Mesh; center: Vec3; ring?: 0 | 1 };

/**
 * The mark as separate pieces: 2 arcs, 14 upright squares, the core. Units are mark units (64 across), origin at the
 * ring centre, y up, front toward +z. Each mesh is centred on its own bounding box; `center` is that rest position.
 * Squares sit on their circles (lib/splitRing.ts `cells()`), ring 0 then 1, top → bottom.
 */
export function logoPieces(depth = 2.4, bev = 0.4): Piece[] {
  const { c, px, stroke, rings, core } = RING;
  const out: Piece[] = [];
  rings.forEach(({ r }, ri) => {
    const mesh = extrude(arcChains(r, stroke), depth, bev);
    out.push({ id: `arc${ri}`, kind: 'arc', mesh, center: recentre(mesh), ring: ri as 0 | 1 });
  });
  const k = [0, 0];
  for (const q of cells()) {
    const mesh = slab(px / 2, px / 2, depth, bev);
    out.push({ id: `sq${q.ring}-${k[q.ring]++}`, kind: 'square', mesh, center: [q.x - c, c - q.y, 0], ring: q.ring });
  }
  out.push({ id: 'core', kind: 'core', mesh: sphere(core), center: [0, 0, 0] });
  return out;
}

/**
 * The ventures' cast bar (a gold-bar ingot) in object units: length along x, width along y, the stamped top face toward
 * +z, centred on the origin. A frustum lofted from rounded-rect sections, every section an exact inward offset of the
 * base outline, so the plan corners are drafted cones (radius `r` at the top edge, larger at the foot) and all walls lean
 * in by the same draft. Every edge is filleted (`f`), so the whole bar is one smooth surface. The top face is cast:
 * it dips by `dip` toward the middle (shrinkage) and its pitting is the shader's noise. Normals are analytic.
 */
export const BAR = { L: 100, W: 46, H: 24, draft: 0.3, r: 3, f: 1.6, dip: 0.6 } as const;
/** Half extents of the bar's plan outline at height z (object units), for the shaders' temperature and temper fields. */
export const barHalf = (z: number, b = BAR) => {
  const o = -(z + b.H / 2) * Math.tan(b.draft);
  return [b.L / 2 + o, b.W / 2 + o] as const;
};
export function goldBar(b = BAR): Mesh {
  const { L, W, H, draft: th, r: rTop, f, dip } = b;
  const a0 = L / 2, b0 = W / 2, hz = H / 2, s = Math.sin(th), c = Math.cos(th);
  // The section loop: a fixed set of plan points (same count on every ring), each with its plan normal.
  const NC = 7, NL = 18, NW = 8; // segments per corner, long edge, short edge
  type P = { cx: number; cy: number; nx: number; ny: number; ex: number; ey: number }; // corner sign, normal, edge param
  const loop: P[] = [];
  const corner = (sx: number, sy: number, a: number) => {
    for (let k = 0; k < NC; k++) { const t = a + (k / NC) * (Math.PI / 2); loop.push({ cx: sx, cy: sy, nx: Math.cos(t), ny: Math.sin(t), ex: 0, ey: 0 }); }
  };
  const edge = (n: number, nx: number, ny: number, from: [number, number], to: [number, number]) => {
    for (let k = 0; k < n; k++) { const t = k / n; loop.push({ cx: 0, cy: 0, nx, ny, ex: from[0] + (to[0] - from[0]) * t, ey: from[1] + (to[1] - from[1]) * t }); }
  };
  // CCW from the right end: corner (+,+), top long edge, corner (-,+), left end, corner (-,-), bottom long edge, corner (+,-), right end.
  corner(1, 1, 0); edge(NL, 0, 1, [1, 1], [-1, 1]);
  corner(-1, 1, Math.PI / 2); edge(NW, -1, 0, [-1, 1], [-1, -1]);
  corner(-1, -1, Math.PI); edge(NL, 0, -1, [-1, -1], [1, -1]);
  corner(1, -1, 1.5 * Math.PI); edge(NW, 1, 0, [1, -1], [1, 1]);
  const N = loop.length;
  // A section offset outward by o (negative = inward) from the base outline: half extents a0 + o, b0 + o; the corner
  // radius follows the offset (exact), never below 0.4.
  const at = (q: P, o: number, k = 1): [number, number] => {
    const ha = a0 + o, hb = b0 + o, rr = Math.max(0.4, r0 + o);
    if (q.ex || q.ey) {
      // straight edge: run between the corner arcs
      const x = q.ny ? q.ex * (ha - rr) : q.nx * ha, y = q.nx ? q.ey * (hb - rr) : q.ny * hb;
      return [x * k, y * k];
    }
    return [(q.cx * (ha - rr) + rr * q.nx) * k, (q.cy * (hb - rr) + rr * q.ny) * k];
  };
  const bld = new Builder();
  const rows: number[][] = [];
  // profile rows, bottom centre to top centre: [offset, z, normal angle (in the outward/z plane), scale for the faces]
  const prof: { o: number; z: number; al: number; k: number; dz?: number }[] = [];
  const cb = -f * (1 + s) / c; // bottom fillet centre offset (z = -hz + f)
  const ct = -f / c - s * (H - f) / c; // top fillet centre offset (z = hz - f) = where the top face starts
  const r0 = rTop - ct; // the foot's corner radius that gives rTop at the top edge
  const FS = 7, FACE = 9;
  for (let i = 0; i <= 2; i++) prof.push({ o: cb, z: -hz, al: -Math.PI / 2, k: Math.max(0.0001, i / 2) });
  for (let i = 1; i <= FS; i++) { const al = -Math.PI / 2 + (i / FS) * (Math.PI / 2 + th); prof.push({ o: cb + f * Math.cos(al), z: -hz + f + f * Math.sin(al), al, k: 1 }); }
  for (let i = 0; i <= FS; i++) { const al = th + (i / FS) * (Math.PI / 2 - th); prof.push({ o: ct + f * Math.cos(al), z: hz - f + f * Math.sin(al), al, k: 1 }); }
  for (let i = FACE - 1; i >= 0; i--) {
    const k = Math.max(0.0001, i / FACE), w = 1 - k * k; // shrinkage dip: smooth at the rim (zero slope), deepest in the middle
    prof.push({ o: ct, z: hz - dip * w * w, al: Math.PI / 2, k, dz: dip * 4 * k * (1 - k * k) });
  }
  for (const q of prof) {
    const row: number[] = [];
    for (let j = 0; j < N; j++) {
      const P = loop[j];
      const [x, y] = at(P, q.o, q.k);
      let nx = P.nx * Math.cos(q.al), ny = P.ny * Math.cos(q.al), nz = Math.sin(q.al);
      if (q.dz !== undefined) {
        // the dip's slope, radial from the middle: dz/dk spread over this point's distance from the centre at k = 1
        const [X, Y] = at(P, q.o, 1), R = Math.hypot(X, Y) || 1, g = q.dz / R;
        nx = (-X / R) * g; ny = (-Y / R) * g; nz = 1; // rises outward, so it faces a little inward
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      }
      row.push(bld.v(x, y, q.z, nx, ny, nz));
    }
    rows.push(row);
  }
  for (let r = 0; r < rows.length - 1; r++) for (let j = 0; j < N; j++) {
    const j1 = (j + 1) % N;
    bld.quad(rows[r][j], rows[r][j1], rows[r + 1][j1], rows[r + 1][j]);
  }
  return bld.done();
}
