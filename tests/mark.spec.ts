import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RING, arcOutline, cells, splitRingSvg, step } from '../lib/splitRing';
import { arcOutline3d, logoPieces } from '../lib/gl3d/geometry';

// The Split Ring (lib/splitRing.ts): two filled half-bands on the circles r 27 and 15 that end exactly on the core's
// centre line (x = c), and the machine half drawn as upright squares centred ON the same circles, evenly spaced in angle,
// with one empty step between each band's end and its first square. It is upright, mirror-symmetric and centred on the
// core, and no square touches an arc, the core or another square. The SVG, the favicon, the brand pages and the 3D logo
// are all this one geometry.

const { c, px } = RING;
const free = cells();

test('squares are as big as the band is wide, centred on their circles, evenly spaced, 14 of them', () => {
  expect(RING.px).toBe(RING.stroke);
  expect(free).toHaveLength(14);
  RING.rings.forEach(({ r, n }, ring) => {
    const mine = free.filter((q) => q.ring === ring);
    expect(mine).toHaveLength(n);
    mine.forEach((q, i) => {
      expect(Math.hypot(q.x - c, q.y - c)).toBeCloseTo(r, 9); // exactly on the circle
      expect(q.x).toBeGreaterThan(c); // the right half only
      expect(q.a).toBeCloseTo(-Math.PI / 2 + (i + 1) * step(n), 9); // evenly spaced, the band's end standing in for k = 0
    });
    // No column of squares: neighbours never share an x (the old lattice stacked three at the far right).
    for (let i = 1; i < mine.length; i++) expect(Math.abs(mine[i].x - mine[i - 1].x)).toBeGreaterThan(0.5);
  });
});

test('each band is one contour that stops on the core\u2019s centre line', () => {
  for (const { r } of RING.rings) {
    const d = arcOutline(r);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.match(/Z/g)).toHaveLength(1);
    expect(d.startsWith(`M${c} `)).toBe(true);
  }
});

test('the squares are never rotated', () => {
  const svg = splitRingSvg();
  expect(svg.match(/<rect/g)).toHaveLength(free.length);
  expect(svg).not.toMatch(/transform=/);
  for (const m of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
    expect(+m[3]).toBe(px);
    expect(+m[4]).toBe(px);
  }
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
      // Every square keeps at least one whole empty square between it and the arcs and the core, and a clear gap to every
      // other square: nothing touches, nothing overlaps.
      for (const b of box) {
        const m = px - 0.02;
        for (let x = b.x - m; x <= b.x + b.w + m; x += 0.25) for (let y = b.y - m; y <= b.y + b.h + m; y += 0.25) if (inArc(x, y)) bad.push(`cell ${b.x},${b.y} near an arc at ${x},${y}`);
        const dx = Math.max(0, Math.abs(b.x + b.w / 2 - c) - b.w / 2), dy = Math.max(0, Math.abs(b.y + b.h / 2 - c) - b.h / 2);
        if (Math.hypot(dx, dy) < core + px) bad.push(`cell ${b.x},${b.y} near the core`);
        // between any two squares, a clear gap of at least 2 units (the inner ring's diagonal neighbours are the closest)
        for (const o of box) if (o !== b && Math.hypot(Math.max(0, Math.abs(o.x - b.x) - px), Math.max(0, Math.abs(o.y - b.y) - px)) < 2) bad.push(`cells ${b.x},${b.y} and ${o.x},${o.y} touch`);
      }
      for (const { r, n } of rings) {
        // The band stops on x = c: nothing of it lies right of the centre line, and it is solid right up to it.
        for (const sgn of [-1, 1]) {
          const yc = c + sgn * r;
          for (const y of [yc - px / 2 + 0.05, yc, yc + px / 2 - 0.05]) {
            if (!inArc(c - 0.05, y)) bad.push(`band ends short of the centre line at y ${y}`);
            if (inArc(c + 0.05, y)) bad.push(`band runs past the centre line at y ${y}`);
          }
          // A visible break: the first square starts well clear of the band's end (at least 1.5 bands).
          const first = box.find((q) => Math.abs(q.y + q.h / 2 - yc) < r * 0.5 && q.x > c);
          if (!first) bad.push(`no first square near ${yc}`);
          else if (first.x - c < 1.5 * px) bad.push(`first square ${first.x},${first.y} too close to the band's end`);
        }
        // A true circle: the band's edges are on r ± px/2 all round the left half.
        for (let deg = 91; deg <= 269; deg += 1) {
          const a = (deg * Math.PI) / 180, X = (R: number) => c + R * Math.cos(a), Y = (R: number) => c - R * Math.sin(a);
          for (const [R, want] of [[r + px / 2 - 0.05, true], [r + px / 2 + 0.05, false], [r - px / 2 + 0.05, true], [r - px / 2 - 0.05, false]] as const) {
            if (inArc(X(R), Y(R)) !== want) bad.push(`ring ${r} edge off the circle at ${deg} deg`);
          }
        }
        void n;
      }
      // Right of the centre line there is no band at all.
      for (let x = c + 0.05; x < 64; x += 0.25) for (let y = 0.113; y < 64; y += 0.25) if (inArc(x, y)) bad.push(`arc fill right of the centre line at ${x},${y}`);
      // Mirror-symmetric about the horizontal axis through the core.
      for (let x = 0.113; x < 64; x += 0.25) for (let y = 0.113; y < 32; y += 0.25) if (inArc(x, y) !== inArc(x, 2 * c - y)) bad.push(`asymmetric at ${x},${y}`);
      const key = (b: { x: number; y: number }) => `${b.x},${b.y}`;
      const key2 = (b: { x: number; y: number }) => `${b.x.toFixed(2)},${b.y.toFixed(2)}`;
      const mirrored = new Set(box.map((b) => key2({ x: b.x, y: 2 * c - b.y - px })));
      for (const b of box) if (!mirrored.has(key2(b))) bad.push(`cell ${key(b)} has no mirror`);
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
        for (let x = c - r - 3; x < c + 3; x += 0.2) for (let y = c - r - 3; y < c + r + 3; y += 0.2) {
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
  expect(out.rects).toBe(14);
  expect(out.transforms).toBe(0);
  const [x0, y0, x1, y1] = out.bbox;
  expect((x0 + x1) / 2).toBeCloseTo(c, 4);
  expect((y0 + y1) / 2).toBeCloseTo(c, 4);
  const ext = RING.rings[0].r + px / 2; // the outer band's edge left, top and bottom; the outer ring's middle square right
  for (const [v, want] of [[x0, c - ext], [y0, c - ext], [x1, c + ext], [y1, c + ext]]) expect(v).toBeCloseTo(want, 3);
});

test('the 3D logo is built from the same mark: 2 arcs, 14 squares on their circles, the core', () => {
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
    // From the band's far left edge to its flat ends on the centre line, top to bottom: the SVG's box exactly.
    for (const [v, want] of [[lo[0], -r - px / 2], [hi[0], 0], [lo[1], -r - px / 2], [hi[1], r + px / 2]]) expect(v).toBeCloseTo(want, 4);
  });
  expect(pieces).toHaveLength(2 + 14 + 1);
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
