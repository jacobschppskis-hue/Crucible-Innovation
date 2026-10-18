// Renders brand/business-card.html to a print-ready PDF (and PNG previews) with Playwright.
// Usage: node brand/render-card.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 360, height: 216 }, deviceScaleFactor: 4 });
await page.goto(`file://${join(here, 'business-card.html')}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: join(here, 'business-card.pdf'), width: '3.75in', height: '2.25in', printBackground: true, pageRanges: '1-2' });
const cards = await page.$$('.card');
for (const [i, side] of ['front', 'back'].entries()) await cards[i].screenshot({ path: join(here, `business-card-${side}.png`) });
await browser.close();
console.log('wrote brand/business-card.pdf and PNG previews');
