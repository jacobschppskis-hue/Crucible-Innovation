import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RING, arcOutline, cells, dotsSvg, raster, splitRingSvg } from '../lib/splitRing';
import { arcOutline3d, logoPieces } from '../lib/gl3d/geometry';

// The Split Ring is the lattice ring (lib/splitRing.ts): one 3-unit lattice centred on the core, two filled bands that
// end on the vertical grid line x = c + 1.5, and the machine half drawn as the same circles rasterised into upright
// cells, every other one, the first welded into the band (one contour, tangent to the circle, no notch). It is upright, mirror-symmetric and centred on the core, and no cell
// overlaps an arc anywhere. The SVG, the favicon, the brand pages and the 3D logo are all this one geometry.

const { c, px } = RING;
const free = cells().filter((q) => !q.weld);

test('cells are as big as the band is wide and sit on one lattice centred on the core', () => {
  expect(RING.px).toBe(RING.stroke);
  for (const { R, r } of RING.rings) expect(r).toBe(R * px); // each ring is a lattice circle
  for (const q of cells()) {
    expect(Number.isInteger(q.i) && Number.isInteger(q.j)).toBe(true);
    expect(q.x).toBe(c + px * q.i);
    expect(q.y).toBe(c + px * q.j);
  }
});

test('the machine half is each circle rasterised, every other cell from the band, 20 cells', () => {
  expect(cells()).toHaveLength(20);
  RING.rings.forEach(({ R }, ring) => {
    const half = raster(R);
    // Gap-free and 8-connected from the top tip to the bottom tip, never more than half a cell off the true circle.
    expect(half[0]).toEqual([1, -R]);
    expect(half[half.length - 1]).toEqual([1, R]);
    expect(half).toContainEqual([R, 0]);
    for (let k = 1; k < half.length; k++) {
      expect(Math.max(Math.abs(half[k][0] - half[k - 1][0]), Math.abs(half[k][1] - half[k - 1][1]))).toBe(1);
    }
    for (const [i, j] of half) {
      expect(i).toBeGreaterThanOrEqual(1);
      expect(Math.abs(Math.hypot(i, j) - R)).toBeLessThanOrEqual(0.5);
    }
    const mine = cells()
      .filter((q) => q.ring === ring)
      .map((q) => [q.i, q.j]);
    expect(mine).toEqual(half.filter((_, k) => k % 2 === 0));
  });
});

test('only the first cell of each ring is welded, flush on the band’s end, in the arc’s own contour', () => {
  const welded = cells().filter((q) => q.weld);
  expect(welded.map((q) => [q.i, q.j])).toEqual([[1, -9], [1, 9], [1, -5], [1, 5]]);
  for (const q of welded) {
    const { r } = RING.rings[q.ring];
    expect(q.x - px / 2).toBe(c + px / 2); // its left edge is the band's cut line
    expect(Math.abs(q.y - c)).toBe(r); // and it spans the band's width exactly
  }
  for (const { r } of RING.rings) {
    // One closed contour per arc (so no anti-aliasing seam), ending on the welded cells' far edge.
    const d = arcOutline(r);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.match(/Z/g)).toHaveLength(1);
    expect(d.startsWith(`M${c + (3 * px) / 2} `)).toBe(true);
  }
});

test('the squares are never rotated', () => {
  const svg = splitRingSvg();
  expect(svg.match(/<rect/g)).toHaveLength(free.length);
  expect(svg).not.toMatch(/transform=/);
  for (const m of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
    expect(+m[3]).toBe(px);
    expect(+m[4]).toBe(px);
    expect(Number.isInteger((+m[1] + px / 2 - c) / px)).toBe(true);
    expect(Number.isInteger((+m[2] + px / 2 - c) / px)).toBe(true);
  }
  expect(dotsSvg()).not.toMatch(/rotate\(|transform=/);
  expect(dotsSvg().match(/h3m-3 1h3m-3 1h3/g)).toHaveLength(cells().length);
});

test('as drawn: upright, mirror-symmetric, centred on the core, true circles, no cell overlapping an arc', async ({ page }) => {
  await page.setContent(`<!doctype html><body style="margin:0">${splitRingSvg()}</body>`);
  const out = await page.evaluate(
    ({ ring, outlines }) => {
      const { c, px, core, rings } = ring;
      const svg = document.querySelector('svg')!;
      const arcs = [...svg.querySelectorAll('path')];
      const rects = [...svg.querySelectorAll('rect')];
      const pt = (x: number, y: number) => new DOMPoint(x, y);
      const inArc = (x: number, y: number) => arcs.some((a) => a.isPointInFill(pt(x, y)));
      const bad: string[] = [];
      const box = rects.map((r) => ({ x: +r.getAttribute('x')!, y: +r.getAttribute('y')!, w: +r.getAttribute('width')!, h: +r.getAttribute('height')! }));
      // Every free cell keeps at least one whole empty cell between it and the arcs (welded cells included), the core
      // and every other cell: nothing touches, nothing overlaps.
      for (const b of box) {
        const m = px - 0.02;
        for (let x = b.x - m; x <= b.x + b.w + m; x += 0.25) for (let y = b.y - m; y <= b.y + b.h + m; y += 0.25) if (inArc(x, y)) bad.push(`cell ${b.x},${b.y} near an arc at ${x},${y}`);
        const dx = Math.max(0, Math.abs(b.x + b.w / 2 - c) - b.w / 2), dy = Math.max(0, Math.abs(b.y + b.h / 2 - c) - b.h / 2);
        if (Math.hypot(dx, dy) < core + px) bad.push(`cell ${b.x},${b.y} near the core`);
        for (const o of box) if (o !== b && Math.max(Math.abs(o.x - b.x), Math.abs(o.y - b.y)) < 2 * px) bad.push(`cells ${b.x},${b.y} and ${o.x},${o.y} touch`);
      }
      for (const { r } of rings) {
        // Welded: the band runs straight on into its end cells (one fill, no gap) and stops at the cell's far edge.
        for (const s of [-1, 1]) {
          const yc = c + s * r;
          for (let x = c - 0.5; x <= c + 1.5 * px - 0.05; x += 0.05) for (const y of [yc - px / 2 + 0.05, yc, yc + px / 2 - 0.05]) if (!inArc(x, y)) bad.push(`gap or notch in the weld at ${x},${y}`);
          for (let x = c - 0.5; x <= c + 1.5 * px; x += 0.05) for (const y of [yc - px / 2 - 0.05, yc + px / 2 + 0.05]) if (inArc(x, y)) bad.push(`weld bulges past the cell's edge at ${x},${y}`);
          if (inArc(c + 1.5 * px + 0.05, yc)) bad.push(`arc runs past its end cell at y ${yc}`);
        }
        // A true circle, cut straight: the band's edges are on r ± px/2 all round the left half.
        for (let deg = 95; deg <= 265; deg += 1) {
          const a = (deg * Math.PI) / 180, X = (R: number) => c + R * Math.cos(a), Y = (R: number) => c - R * Math.sin(a);
          for (const [R, want] of [[r + px / 2 - 0.05, true], [r + px / 2 + 0.05, false], [r - px / 2 + 0.05, true], [r - px / 2 - 0.05, false]] as const) {
            if (inArc(X(R), Y(R)) !== want) bad.push(`ring ${r} edge off the circle at ${deg} deg`);
          }
        }
      }
      // Beyond the cut line, an arc's fill is only its welded cells.
      for (let x = c + px / 2 + 0.05; x < 64; x += 0.25) for (let y = 0.113; y < 64; y += 0.25) {
        const weld = rings.some(({ r }) => x < c + 1.5 * px && (Math.abs(y - (c - r)) < px / 2 || Math.abs(y - (c + r)) < px / 2));
        if (inArc(x, y) && !weld) bad.push(`arc fill beyond the cut at ${x},${y}`);
      }
      // Mirror-symmetric about the horizontal axis through the core.
      for (let x = 0.113; x < 64; x += 0.25) for (let y = 0.113; y < 32; y += 0.25) if (inArc(x, y) !== inArc(x, 2 * c - y)) bad.push(`asymmetric at ${x},${y}`);
      const key = (b: { x: number; y: number }) => `${b.x},${b.y}`;
      const mirrored = new Set(box.map((b) => key({ x: b.x, y: 2 * c - b.y - px })));
      for (const b of box) if (!mirrored.has(key(b))) bad.push(`cell ${key(b)} has no mirror`);
      // Centred: the mark's box is centred on the core in both axes.
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const e of [...arcs, ...rects]) {
        const b = e.getBBox();
        x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
      }
      const bbox = [x0, y0, x1, y1];
      // The 3D logo extrudes the same outline: inside/outside agree everywhere but within 0.06 of the SVG's edge.
      const inPoly = (poly: number[][], x: number, y: number) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      };
      rings.forEach(({ r }, k) => {
        const path = arcs[k];
        path.setAttribute('stroke', '#000');
        path.setAttribute('stroke-width', '0.12');
        const poly = outlines[k];
        for (let x = c - r - 3; x < c + 6; x += 0.2) for (let y = c - r - 3; y < c + r + 3; y += 0.2) {
          if (path.isPointInStroke(pt(x, y))) continue;
          if (path.isPointInFill(pt(x, y)) !== inPoly(poly, x - c, c - y)) bad.push(`3D outline of ring ${r} differs at ${x},${y}`);
        }
        for (const [x, y] of poly) if (!path.isPointInStroke(pt(c + x, c - y))) bad.push(`3D vertex ${x},${y} off the SVG outline`);
      });
      return { bad: bad.slice(0, 12), n: bad.length, bbox, rects: rects.length, transforms: svg.querySelectorAll('[transform]').length };
    },
    { ring: RING, outlines: RING.rings.map(({ r }) => arcOutline3d(r)) },
  );
  expect(out.bad, `${out.n} problems`).toEqual([]);
  expect(out.rects).toBe(16);
  expect(out.transforms).toBe(0);
  const [x0, y0, x1, y1] = out.bbox;
  expect((x0 + x1) / 2).toBeCloseTo(c, 6);
  expect((y0 + y1) / 2).toBeCloseTo(c, 6);
  for (const [v, want] of [[x0, 3.5], [y0, 3.5], [x1, 60.5], [y1, 60.5]]) expect(v).toBeCloseTo(want, 4);
});

test('the 3D logo is built from the same mark: 2 welded arcs, 16 cells on their lattice places, the core', () => {
  const pieces = logoPieces();
  expect(pieces.filter((p) => p.kind === 'core')).toHaveLength(1);
  const sq = pieces.filter((p) => p.kind === 'square');
  expect(sq.map((p) => [p.center[0] + c, c - p.center[1], p.center[2]])).toEqual(free.map((q) => [q.x, q.y, 0]));
  RING.rings.forEach(({ r }, k) => {
    const arc = pieces.filter((p) => p.kind === 'arc')[k];
    expect(arc.id).toBe(`arc${k}`);
    const lo = [1e9, 1e9], hi = [-1e9, -1e9];
    for (let i = 0; i < arc.mesh.p.length; i += 3) for (const a of [0, 1]) {
      lo[a] = Math.min(lo[a], arc.mesh.p[i + a] + arc.center[a]);
      hi[a] = Math.max(hi[a], arc.mesh.p[i + a] + arc.center[a]);
    }
    // From the band's far left edge to the welded cells' right edge, top cell to bottom cell: the SVG's box exactly.
    for (const [v, want] of [[lo[0], -r - px / 2], [hi[0], (3 * px) / 2], [lo[1], -r - px / 2], [hi[1], r + px / 2]]) expect(v).toBeCloseTo(want, 4);
  });
  expect(pieces).toHaveLength(2 + 16 + 1);
});

test('the favicon and the brand pages carry the current mark', () => {
  const root = join(__dirname, '..');
  expect(readFileSync(join(root, 'public/favicon.svg'), 'utf8').trim()).toBe(splitRingSvg({ bg: '#0D0D0B' }));
  for (const f of ['brand/og.html', 'brand/business-card.html']) {
    const marks = readFileSync(join(root, f), 'utf8').match(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">[\s\S]*?<\/svg>/g) ?? [];
    expect(marks.length, f).toBeGreaterThan(0);
    for (const m of marks) expect(m, f).toBe(splitRingSvg());
  }
});
