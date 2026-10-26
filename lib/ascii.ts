// Turns ASCII art into an SVG data URI, so the portrait renders as one sharp image (not thousands of
// tiny text characters for search engines and screen readers to wade through).
const CELL_W = 6;
const CELL_H = 10;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function asciiSvg(ascii: string) {
  const lines = ascii.split('\n');
  const cols = Math.max(...lines.map((l) => l.length));
  const w = cols * CELL_W;
  const h = lines.length * CELL_H;
  const rows = lines
    .map((l, i) => {
      // Position each row by its own leading whitespace; keep inner spaces with white-space: pre.
      const body = l.trimStart();
      if (!body) return '';
      const x = (l.length - body.length) * CELL_W;
      return `<text x="${x}" y="${(i + 0.8) * CELL_H}" textLength="${body.length * CELL_W}" lengthAdjust="spacingAndGlyphs" xml:space="preserve" style="white-space:pre">${escape(body)}</text>`;
    })
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="#f6f3ea"/><stop offset="1" stop-color="#e8e4d8" stop-opacity="0.7"/></linearGradient></defs>` +
    `<g fill="url(#g)" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', monospace" font-size="${CELL_H}" font-weight="500" xml:space="preserve">${rows}</g></svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: w, height: h };
}
