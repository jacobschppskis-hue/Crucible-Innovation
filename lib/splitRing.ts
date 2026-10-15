// Geometry for the Split Ring mark, shared by the React component, the OG images and the favicon.
// Placeholder geometry: tweak freely.
export const RING = { c: 32, px: 3.2, stroke: 3, core: 4.5, rings: [{ r: 26, n: 11 }, { r: 15, n: 7 }] } as const;

export type Pixel = { x: number; y: number; deg: number };

/** Human half: smooth arc, top → left → bottom. */
export const arcPath = (r: number, c = RING.c) => `M${c} ${c - r} A${r} ${r} 0 0 0 ${c} ${c + r}`;

/** Machine half: n pixels along the right arc, top → bottom. */
export function pixels(r: number, n: number, c = RING.c): Pixel[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / (n - 1);
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
