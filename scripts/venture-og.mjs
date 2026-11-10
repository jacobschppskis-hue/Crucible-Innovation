// Share images for the venture pages: each monolith still (public/film/monoliths/<name>-2400.webp, a transparent capture
// from the home page's world, scripts/monolith-stills.mjs) standing on the site's dark ground, 1200 x 630, as
// public/og/<slug>.jpg. app/ventures/[slug] picks them up when they exist.
// Usage: node scripts/venture-og.mjs  (needs `sharp`, which Next installs)
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public/film/monoliths');
// slug (the page) -> monolith still; Crucible Sites has its own page and share image (app/sites).
const pages = { verge: 'verge', trellis: 'trellis' };
for (const [slug, name] of Object.entries(pages)) {
  const file = join(src, `${name}-2400.webp`);
  if (!existsSync(file)) continue;
  const out = join(root, 'public/og', `${slug}.jpg`);
  // The 2:3 still, trimmed to the monolith, scaled to stand 560 px tall in the middle of the card.
  const mono = await sharp(await sharp(file).trim().toBuffer()).resize({ height: 560 }).toBuffer();
  const { width = 0 } = await sharp(mono).metadata();
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#0d0d0b' } })
    .composite([{ input: mono, left: Math.round((1200 - width) / 2), top: 35 }])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }) // 4:4:4: the dark red faces band under subsampled chroma
    .toFile(out);
  console.log(`wrote ${out.slice(root.length + 1)}`);
}
