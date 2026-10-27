// Geometry for the Split Ring mark, shared by the React component, the OG images and the favicon.
// Placeholder geometry: tweak freely.
// Pixels are exactly as thick as the line (px = stroke), so the two halves read as one band.
export const RING = { c: 32, px: 3, stroke: 3, core: 4.5, rings: [{ r: 26, n: 11 }, { r: 15, n: 7 }] } as const;

export type Pixel = { x: number; y: number; deg: number };

/**
 * Human half: smooth arc, top → left → bottom. By default it runs on under the end pixels (to their centres), so
 * there's never a sliver of gap where the line meets them; `under = false` gives the exact half circle.
 */
export const arcPath = (r: number, c: number = RING.c, under = true) => {
  const e = under ? RING.px / 2 / r : 0;
  const f = (n: number) => +n.toFixed(3);
  const x = f(c + r * Math.sin(e));
  return `M${x} ${f(c - r * Math.cos(e))} A${r} ${r} 0 1 0 ${x} ${f(c + r * Math.cos(e))}`;
};

/**
 * Machine half: n pixels along the right arc, top → bottom. The end pixels start exactly where the arc's square
 * ends stop (inset by half a pixel), so line and pixels meet edge to edge with nothing sticking out.
 */
export function pixels(r: number, n: number, c: number = RING.c): Pixel[] {
  const inset = RING.px / 2 / r;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + inset + ((Math.PI - 2 * inset) * i) / (n - 1);
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a), deg: (a * 180) / Math.PI };
  });
}

/** Standalone SVG markup, for places that can't use CSS variables (favicon, OG images). */
export function splitRingSvg({ fg = '#E8E4D8', core = '#FF5B1F', bg }: { fg?: string; core?: string; bg?: string } = {}) {
  const { c, px, stroke, rings } = RING;
  const f = (n: number) => +n.toFixed(2);
  const body = rings
    .map(({ r, n }) =>
      `<path d="${arcPath(r)}" fill="none" stroke="${fg}" stroke-width="${stroke}"/>` +
      pixels(r, n)
        .map(({ x, y, deg }) => `<rect x="${f(x - px / 2)}" y="${f(y - px / 2)}" width="${px}" height="${px}" fill="${fg}" transform="rotate(${f(deg)} ${f(x)} ${f(y)})"/>`)
        .join(''),
    )
    .join('');
  const ground = bg ? `<rect width="64" height="64" rx="14" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${ground}${body}<circle cx="${c}" cy="${c}" r="${RING.core}" fill="${core}"/></svg>`;
}

/**
 * The mark while it's molten: a matrix of dots one unit apart. Each arc is three rows (on r − 1, r, r + 1) with the
 * same number of dots, so they line up radially; each pixel is a 3 × 3 grid on the same rows, so the matrix runs
 * straight on from the line into the pixels.
 */
export function dotRows(r: number) {
  const n = Math.round(Math.PI * r);
  return [-1, 0, 1].map((k) => ({ R: r + k, n, step: (Math.PI * (r + k)) / n }));
}

/** The dot matrix as standalone SVG (white dots of diameter `d`), for use as a CSS mask. */
export function dotsSvg(d = 0.82) {
  const { c, rings } = RING;
  const f = (n: number) => +n.toFixed(3);
  const arcs = rings
    .flatMap(({ r }) =>
      dotRows(r).map(({ R, step }) => `<path d="M${c} ${c - R}A${R} ${R} 0 0 0 ${c} ${c + R}" stroke-dasharray="0 ${f(step)}" stroke-dashoffset="${f(-step / 2)}"/>`),
    )
    .join('');
  const grids = rings
    .flatMap(({ r, n }) => pixels(r, n).map(({ x, y, deg }) => `<path transform="rotate(${f(deg)} ${f(x)} ${f(y)})" d="M${f(x - 1.5)} ${f(y - 1)}h3m-3 1h3m-3 1h3"/>`))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-width="${d}">${arcs}<g stroke-dasharray="0 1" stroke-dashoffset="-0.5">${grids}</g></g></svg>`;
}
