// Screenshots a live client site for /work and /sites: public/work/<slug>.webp (desktop, 1440 × 900) and
// public/work/<slug>-phone.webp (390 × 844), as rendered in a real browser.
// Usage: node scripts/shoot-client.mjs <slug> <url>   e.g. node scripts/shoot-client.mjs halcyon https://halcyon.coffee
// Needs Playwright's Chromium (npx playwright install chromium) or CHROMIUM_PATH, and sharp (Next installs it).
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [slug, url] = process.argv.slice(2);
if (!slug || !/^https?:\/\//.test(url ?? '')) {
  console.error('Usage: node scripts/shoot-client.mjs <slug> <url>');
  process.exit(1);
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public/work');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [suffix, viewport, scale] of [
  ['', { width: 1440, height: 900 }, 1],
  ['-phone', { width: 390, height: 844 }, 2],
]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).webp({ quality: 82 }).toFile(join(out, `${slug}${suffix}.webp`));
  console.log(`wrote public/work/${slug}${suffix}.webp`);
  await page.close();
}
await browser.close();
