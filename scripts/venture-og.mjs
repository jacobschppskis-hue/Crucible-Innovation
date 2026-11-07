// Share images for the venture pages: each ingot still (public/film/ingots/<slug>-2400.webp, a transparent capture of the
// 3D ingot, scripts/ingot-stills.mjs) set on the site's dark ground, 1200 x 630, as public/og/<slug>.jpg.
// app/ventures/[slug] picks them up when they exist. Usage: node scripts/venture-og.mjs  (needs `sharp`, which Next installs)
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
  // The still is 5:4 (the bar with room to float above and below it); its middle 1000 x 630 holds the bar.
  const ingot = await sharp(await sharp(join(src, f)).resize(1000, 800).toBuffer()).extract({ left: 0, top: 85, width: 1000, height: 630 }).toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#0d0d0b" } })
    .composite([{ input: ingot, left: 100, top: 0 }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(out);
  console.log(`wrote ${out.slice(root.length + 1)}${existsSync(out) ? '' : ' (failed)'}`);
}
