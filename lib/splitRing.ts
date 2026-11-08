// Geometry for the Split Ring mark, shared by the React component, the OG images, the favicon and the 3D logo
// (lib/gl3d/geometry.ts). Two concentric rings around an orange core:
// - Human half: each ring's left half as a filled band (radius r, `stroke` wide) that ends exactly on the vertical line
//   through the core's centre (x = c): it never runs past the centre.
// - Machine half: the right half of the same circle drawn as `n` upright squares (as big as the band is wide), centred
//   exactly ON the circle and evenly spaced in angle. The band's end stands where square 0 would be, so between the end
//   and the first square there is one step of empty circle: a visible break, the same rhythm as the squares.
// Everything is upright and mirror-symmetric about the horizontal axis, and the mark's box (3.2 to 60.8) is centred on
// the core. Units: the 64-unit SVG box, y down.
export const RING = { c: 32, px: 3.6, stroke: 3.6, core: 4.5, rings: [{ r: 27, n: 9 }, { r: 15, n: 5 }] } as const;

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

/**
 * Human half of the ring of radius `r` as one filled contour: the outer edge from the top end round the left to the
 * bottom end, the bottom end's flat face (on x = c), the inner edge back, the top end's face.
 */
export function arcOutline(r: number, c: number = RING.c) {
  const h = RING.stroke / 2;
  const ro = r + h, ri = r - h;
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
    const ro = r + h - inset, ri = r - h + inset;
    const yo = f3(Math.sqrt(ro * ro - inset * inset)), yi = f3(Math.sqrt(ri * ri - inset * inset));
    return `M${x0} ${f3(c - yo)}A${f3(ro)} ${f3(ro)} 0 1 0 ${x0} ${f3(c + yo)}V${f3(c + yi)}A${f3(ri)} ${f3(ri)} 0 1 1 ${x0} ${f3(c - yi)}Z`;
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
