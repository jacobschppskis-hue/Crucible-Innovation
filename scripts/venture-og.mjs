// Share images for the venture pages: each rendered casting (public/film/ingots/<slug>-2400.webp, film/ingots.py)
// cropped to 1200 × 630 as public/og/<slug>.jpg. app/ventures/[slug] picks them up when they exist.
// Usage: node scripts/venture-og.mjs  (needs `sharp`, which Next installs)
import sharp from 'sharp';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public/film/ingots');
for (const f of readdirSync(src).filter((n) => n.endsWith('-2400.webp'))) {
  const slug = f.replace('-2400.webp', '');
  if (slug === 'sites') continue; // Crucible Sites has its own page and share image (app/sites).
  const out = join(root, 'public/og', `${slug}.jpg`);
  await sharp(join(src, f)).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
  console.log(`wrote ${out.slice(root.length + 1)}${existsSync(out) ? '' : ' (failed)'}`);
}
