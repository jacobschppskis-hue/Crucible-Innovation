// Renders the concept sites to public/showcase/*.webp.
// Usage: node showcase-src/render.mjs  (needs `playwright` and `sharp` available to Node)
import { chromium } from 'playwright';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../public/showcase');
const pages = ['cafe', 'barber', 'landscaper', 'before'];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
for (const name of pages) {
  await page.goto(`file://${join(here, `${name}.html`)}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).webp({ quality: 82 }).toFile(join(out, `${name}.webp`));
  // Smaller copies for phones (GitHub Pages can't resize on the fly; see lib/imageLoader.ts).
  for (const w of [640, 960]) await sharp(png).resize(w).webp({ quality: 80 }).toFile(join(out, `${name}-${w}.webp`));
  console.log('rendered', name);
}
await browser.close();
