// Geometry for the Split Ring mark, shared by the React component, the OG images, the favicon and the 3D logo
// (lib/gl3d/geometry.ts). The lattice ring:
// - One lattice: cells are 3 units (= the band's width), centred at (c + 3i, c + 3j), so one cell sits on the core.
// - Human half: two filled bands on the circles of R = 9 and 5 cells (r 27 and 15), 3 wide, ending on the vertical grid
//   line x = c + 1.5 (not radially).
// - Machine half: the same circles rasterised (midpoint, 8-connected) into upright cells, every other cell kept, from the
//   one touching the band's end. That first cell is welded into the band: one outline, no seam, nothing overlapping.
//   Where a vertical cut meets a square cell the circle has already dropped 0.04-0.08 units below the cell's edge (a
//   notch of up to 1 px at hero size), so the weld runs the cell's edges straight on to x = c, where they are tangent to
//   the circles: the outline is the exact half ring plus a straight run to the welded cell's far edge (x = c + 4.5).
// Everything is upright and mirror-symmetric about the horizontal axis, and the mark's box (3.5 to 60.5) is centred on
// the core. Units: the 64-unit SVG box, y down.
export const RING = { c: 32, px: 3, stroke: 3, core: 4.5, rings: [{ R: 9, r: 27 }, { R: 5, r: 15 }] } as const;

/** One upright cell of the machine half: lattice index (i right, j down), centre in SVG units, ring, welded or free. */
export type Cell = { i: number; j: number; x: number; y: number; ring: 0 | 1; weld: boolean };

/** The circle of `R` cells rasterised (midpoint, 8-connected): the right half (i ≥ 1), top → bottom, as [i, j]. */
export function raster(R: number): [number, number][] {
  const q: [number, number][] = []; // upper-right quadrant, i ≥ 1 and j ≤ -1
  for (let x = 0; x <= R; x++) {
    const y = Math.round(Math.sqrt(R * R - x * x));
    if (x > y) continue;
    for (const [i, j] of [[x, y], [y, x]]) if (i >= 1 && j >= 1 && !q.some((p) => p[0] === i && p[1] === -j)) q.push([i, -j]);
  }
  q.sort((a, b) => Math.atan2(a[0], -a[1]) - Math.atan2(b[0], -b[1]));
  return [...q, [R, 0], ...q.map(([i, j]) => [i, -j] as [number, number]).reverse()];
}

/** The machine half: every other raster cell of each ring from the band's end, ring 0 (outer) then 1, each top → bottom. */
export function cells(c: number = RING.c): Cell[] {
  const { px, rings } = RING;
  return rings.flatMap(({ R }, ring) =>
    raster(R)
      .filter((_, k) => k % 2 === 0)
      .map(([i, j]) => ({ i, j, x: c + px * i, y: c + px * j, ring: ring as 0 | 1, weld: i === 1 && Math.abs(j) === R })),
  );
}

const f3 = (n: number) => +n.toFixed(3);

/**
 * Human half of the ring of radius `r`, with its two welded cells, as one filled contour (no seam): the cell's top edge
 * from x = c + 4.5 straight to x = c (tangent to the outer circle there), the half circle round the left, the bottom
 * cell, then the inner edge back the same way. Equals the band cut at x = c + 1.5 plus the cell (1, ±R), without the
 * notch at the cut.
 */
export function arcOutline(r: number, c: number = RING.c) {
  const h = RING.px / 2;
  const ro = r + h, ri = r - h, x2 = c + 3 * h;
  return (
    `M${x2} ${c - ri}V${c - ro}H${c}A${ro} ${ro} 0 0 0 ${c} ${c + ro}H${x2}V${c + ri}H${c}A${ri} ${ri} 0 0 1 ${c} ${c - ri}Z`
  );
}

/** Standalone SVG markup, for places that can't use CSS variables (favicon, apple icon, OG images, the card). */
export function splitRingSvg({ fg = '#E8E4D8', core = '#FF5B1F', bg, square = false, viewBox = '0 0 64 64' }: { fg?: string; core?: string; bg?: string; square?: boolean; viewBox?: string } = {}) {
  const { c, px, rings } = RING;
  const arcs = rings.map(({ r }) => `<path d="${arcOutline(r)}" fill="${fg}"/>`).join('');
  const free = cells()
    .filter((q) => !q.weld)
    .map(({ x, y }) => `<rect x="${f3(x - px / 2)}" y="${f3(y - px / 2)}" width="${px}" height="${px}" fill="${fg}"/>`)
    .join('');
  const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
  const ground = bg ? `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}"${square ? '' : ` rx="${f3((14 * vw) / 64)}"`} fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${ground}${arcs}${free}<circle cx="${c}" cy="${c}" r="${RING.core}" fill="${core}"/></svg>`;
}

/**
 * The mark while it's molten: a matrix of dots about one unit apart. Each band is three rows (on r − 1, r, r + 1), each
 * row from its straight end round the half circle to the other end; each cell (welded ones too) is a 3 × 3 grid on the
 * lattice, on the same rows as the band, so the matrix runs straight on from the band into the cells.
 */
export function dotRows(r: number) {
  return [-1, 0, 1].map((k) => {
    const R = r + k, len = Math.PI * R + RING.px; // half circle + the two straight runs to the cut line (c + 1.5)
    const n = Math.round(len);
    return { R, n, step: len / n };
  });
}

/** The dot matrix as standalone SVG (white dots of diameter `d`), for use as a CSS mask. */
export function dotsSvg(d = 0.82) {
  const { c, px, rings } = RING;
  const arcs = rings
    .flatMap(({ r }) =>
      dotRows(r).map(
        ({ R, step }) =>
          `<path d="M${c + px / 2} ${c - R}H${c}A${R} ${R} 0 0 0 ${c} ${c + R}H${c + px / 2}" stroke-dasharray="0 ${f3(step)}" stroke-dashoffset="${f3(-step / 2)}"/>`,
      ),
    )
    .join('');
  const grids = cells()
    .map(({ x, y }) => `<path d="M${f3(x - 1.5)} ${f3(y - 1)}h3m-3 1h3m-3 1h3"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-width="${d}">${arcs}<g stroke-dasharray="0 1" stroke-dashoffset="-0.5">${grids}</g></g></svg>`;
}
