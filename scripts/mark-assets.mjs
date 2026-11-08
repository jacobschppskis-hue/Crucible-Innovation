// The mark's static copies, all from lib/splitRing.ts: public/favicon.svg (the brand mark's 16 px master),
// public/apple-icon.png (180 px, the brand mark on Ground) and the inline marks in brand/og.html and brand/business-card.html.
// Usage: node --experimental-strip-types scripts/mark-assets.mjs   then  node brand/render-og.mjs && node brand/render-card.mjs
// (Playwright's Chromium; set CHROMIUM_PATH to use an already-installed one.)
import { chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brandMarkSvg, faviconSvg, splitRingSvg } from '../lib/splitRing.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BG = '#0D0D0B';

// The favicon is the brand mark's 16 px master (Jacob's logo family), ink or bone with the browser's theme.
writeFileSync(join(root, 'public/favicon.svg'), faviconSvg() + '\n');

// Inline marks: every 64-unit SVG in the brand pages is the mark.
const mark = splitRingSvg();
for (const f of ['brand/og.html', 'brand/business-card.html']) {
  const p = join(root, f);
  const html = readFileSync(p, 'utf8');
  const next = html.replace(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">[\s\S]*?<\/svg>/g, mark);
  writeFileSync(p, next);
}

const exe =
  process.env.CHROMIUM_PATH ||
  process.env.PW_CHROMIUM_PATH ||
  (existsSync('/opt/pw-browsers')
    ? readdirSync('/opt/pw-browsers')
        .filter((d) => /^chromium-\d/.test(d))
        .map((d) => `/opt/pw-browsers/${d}/chrome-linux64/chrome`)
        .find(existsSync)
    : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
// The app icon is the brand mark (one ring, four squares, the core) on Ground; iOS rounds the corners itself.
const icon = brandMarkSvg({ bg: BG, square: true, size: 180, pad: 7 });
await page.setContent(`<!doctype html><body style="margin:0;background:${BG}">${icon}</body>`);
await page.screenshot({ path: join(root, 'public/apple-icon.png'), clip: { x: 0, y: 0, width: 180, height: 180 } });
await browser.close();
console.log('wrote public/favicon.svg, public/apple-icon.png and the marks in brand/og.html, brand/business-card.html');
