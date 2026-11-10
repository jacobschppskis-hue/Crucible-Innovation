// Geometry for the Split Ring mark, shared by the React component, the OG images, the favicon and the 3D logo
// (lib/gl3d/geometry.ts). Jacob's logo family ("Crucible Logo Family", Nov 2026), drawn on a 48-unit grid and carried
// here into the 64-unit box (U = 4/3), so the mark's overall size is unchanged:
// - Two concentric rings around an Ember core: outer radius 20, inner 12, ring stroke 2.6, squares 3.2, core radius 3.6.
// - Human half: each ring's left side is an exact half circle, top to bottom, ending on the vertical line through the
//   core's centre (it never runs past the centre).
// - Machine half: each ring breaks for one step, then the squares start: 7 on the outer ring (22.5° apart), 4 on the
//   inner (36° apart). Every square sits upright, square to the page, with its centre exactly on the circle where it
//   would fall if the ring continued.
// Everything is upright and mirror-symmetric about the horizontal axis, and the mark's box (3.2 to 60.8) is centred on
// the core. Units: the 64-unit SVG box, y down.
const U = 4 / 3;
export const RING = { c: 32, px: 3.2 * U, stroke: 2.6 * U, core: 3.6 * U, rings: [{ r: 20 * U, n: 7 }, { r: 12 * U, n: 4 }] } as const;

/** One upright square of the machine half: centre in SVG units, ring (0 outer, 1 inner), index k from the top (1..n),
 *  and its angle on the circle (radians, from the +x axis, y down: -π/2 is the top, 0 the right). */
export type Cell = { x: number; y: number; ring: 0 | 1; k: number; a: number };

/** The angular step between squares on a ring of `n` squares (the band's end counts as square 0 and n + 1). */
export const step = (n: number) => Math.PI / (n + 1);

/** The machine half: ring 0 (outer) then 1, each top → bottom, every square centred on its circle. */
export function cells(c: number = RING.c): Cell[] {
  return RING.rings.flatMap(({ r, n }, ring) =>
    Array.from({ length: n }, (_, i) => {
      const k = i + 1;
      const a = -Math.PI / 2 + k * step(n);
      return { x: c + r * Math.cos(a), y: c + r * Math.sin(a), ring: ring as 0 | 1, k, a };
    }),
  );
}

const f3 = (n: number) => +n.toFixed(3);
const f6 = (n: number) => +n.toFixed(6);

/**
 * Human half of the ring of radius `r` as one filled contour: the outer edge from the top end round the left to the
 * bottom end, the bottom end's flat face (on x = c), the inner edge back, the top end's face.
 */
export function arcOutline(r: number, c: number = RING.c) {
  const h = RING.stroke / 2;
  // round the radii first and place the ends from them, so each end is exactly one radius from the centre (an end
  // off by a rounding error would move a half circle's centre sideways)
  const ro = f3(r + h), ri = f3(r - h);
  return `M${c} ${f3(c - ro)}A${ro} ${ro} 0 0 0 ${c} ${f3(c + ro)}V${f3(c + ri)}A${ri} ${ri} 0 0 1 ${c} ${f3(c - ri)}Z`;
}

/**
 * Every piece's outline as one path, for the pour's ghost drawing (components/Ignition.tsx): the two bands and the
 * squares, each pulled in by `inset` units, so a hairline stroked on it lies wholly inside its piece and the solid mark
 * (the 3D metal over it) covers it exactly. The core's outline is the circle of radius RING.core − inset.
 */
export function outlinePath(inset = 0, c: number = RING.c): string {
  const h = RING.stroke / 2;
  const x0 = f3(c + inset);
  const arcs = RING.rings.map(({ r }) => {
    const ro = f3(r + h - inset), ri = f3(r - h + inset);
    // ends exactly on their circles (6 decimals): a rounded end shifts an arc's centre sideways
    const yo = f6(Math.sqrt(ro * ro - inset * inset)), yi = f6(Math.sqrt(ri * ri - inset * inset));
    return `M${x0} ${f6(c - yo)}A${ro} ${ro} 0 1 0 ${x0} ${f6(c + yo)}V${f6(c + yi)}A${ri} ${ri} 0 1 1 ${x0} ${f6(c - yi)}Z`;
  });
  const a = RING.px / 2 - inset, s = f3(2 * a);
  const sq = cells(c).map(({ x, y }) => `M${f3(x - a)} ${f3(y - a)}h${s}v${s}h${-s}Z`);
  return [...arcs, ...sq].join('');
}

/** Standalone SVG markup, for places that can't use CSS variables (favicon, apple icon, OG images, the card). */
export function splitRingSvg({ fg = '#E8E4D8', core = '#FF5B1F', bg, square = false, viewBox = '0 0 64 64' }: { fg?: string; core?: string; bg?: string; square?: boolean; viewBox?: string } = {}) {
  const { c, px, rings } = RING;
  const arcs = rings.map(({ r }) => `<path d="${arcOutline(r)}" fill="${fg}"/>`).join('');
  const free = cells()
    .map(({ x, y }) => `<rect x="${f3(x - px / 2)}" y="${f3(y - px / 2)}" width="${px}" height="${px}" fill="${fg}"/>`)
    .join('');
  const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
  const ground = bg ? `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}"${square ? '' : ` rx="${f3((14 * vw) / 64)}"`} fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${ground}${arcs}${free}<circle cx="${c}" cy="${c}" r="${RING.core}" fill="${core}"/></svg>`;
}

/**
 * The brand mark (Jacob's logo family, "03 · Brand mark"): the Split Ring with the outer ring removed and the strokes
 * thickened so it survives small sizes. One ring (radius 15, stroke 5) on a 48-unit box, four upright squares (5.6) at
 * 36° steps after a one-step break, the core (4.8). For icons, avatars and the app icon. `ink` is the ring and squares.
 */
export function brandMarkSvg({ ink = '#E8E4D8', core = '#FF5B1F', bg, square = false, size, pad = 0 }: { ink?: string; core?: string; bg?: string; square?: boolean; size?: number; pad?: number } = {}) {
  const c = 24, r = 15, s = 5.6, n = 4, st = Math.PI / (n + 1);
  const sq = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i + 1) * st;
    return `<rect x="${f3(c + r * Math.cos(a) - s / 2)}" y="${f3(c + r * Math.sin(a) - s / 2)}" width="${s}" height="${s}"/>`;
  }).join('');
  const w = 48 + 2 * pad;
  const ground = bg ? `<rect x="${-pad}" y="${-pad}" width="${w}" height="${w}"${square ? '' : ` rx="${f3(w * 0.22)}"`} fill="${bg}"/>` : '';
  const wh = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${w} ${w}"${wh}>${ground}<path d="M24 9A15 15 0 0 0 24 39" fill="none" stroke="${ink}" stroke-width="5"/><g fill="${ink}">${sq}</g><circle cx="${c}" cy="${c}" r="4.8" fill="${core}"/></svg>`;
}

/**
 * The brand mark's 16 px master (logo family, "use the 16 px master from 16 to 24 px"): the same four squares locked to
 * whole pixels. As the favicon it follows the browser's theme: ink on light tab bars, bone on dark ones.
 */
export function faviconSvg() {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
    '<style>.i{fill:none;stroke:#0D0D0B}.q{fill:#0D0D0B}@media (prefers-color-scheme:dark){.i{stroke:#E8E4D8}.q{fill:#E8E4D8}}</style>' +
    '<path class="i" d="M8 2A6 6 0 0 0 8 14" stroke-width="2"/>' +
    '<g class="q" shape-rendering="crispEdges"><rect x="11" y="2" width="2" height="2"/><rect x="13" y="5" width="2" height="2"/><rect x="13" y="9" width="2" height="2"/><rect x="11" y="12" width="2" height="2"/></g>' +
    '<circle cx="8" cy="8" r="2" fill="#FF5B1F"/></svg>'
  );
}
