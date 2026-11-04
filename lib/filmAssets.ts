import fs from 'node:fs';
import path from 'node:path';

// Build-time check (server components only) for a rendered frame sequence in public/film/<name>/<width>/.
// Returns what the client needs to scrub it, or null if it hasn't been rendered yet, so pages fall back gracefully.
export type FilmInfo = { base: string; count: number; widths: number[]; poster?: string; posterSmall?: string };

export function filmInfo(name: string): FilmInfo | null {
  const dir = path.join(process.cwd(), 'public/film', name);
  if (!fs.existsSync(dir)) return null;
  const widths = fs
    .readdirSync(dir)
    .filter((d) => /^\d+$/.test(d) && fs.statSync(path.join(dir, d)).isDirectory())
    .map(Number)
    .sort((a, b) => a - b);
  if (!widths.length) return null;
  const count = fs.readdirSync(path.join(dir, String(widths[0]))).filter((f) => /^\d{3}\.webp$/.test(f)).length;
  if (!count) return null;
  const poster = (f: string) => (fs.existsSync(path.join(dir, f)) ? `/film/${name}/${f}` : undefined);
  return { base: `/film/${name}`, count, widths, poster: poster('poster-1600.webp'), posterSmall: poster('poster-800.webp') };
}
