// Renders brand/og.html to the OpenGraph images (app/opengraph-image.png, app/sites/opengraph-image.png).
// Usage: node brand/render-og.mjs   (set CHROMIUM_PATH to use an already-installed Chromium)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${join(here, 'og.html')}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await (await page.$('#home')).screenshot({ path: join(here, '../app/opengraph-image.png') });
await (await page.$('#sites')).screenshot({ path: join(here, '../app/sites/opengraph-image.png') });
await browser.close();
console.log('wrote app/opengraph-image.png and app/sites/opengraph-image.png');
