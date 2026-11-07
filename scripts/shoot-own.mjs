// Screenshots Crucible's own home page for /work, from the built site (out/), so /work shows the page as it is now:
// public/work/crucible-site-{960,1440}.webp (desktop, 1440 × 900) and public/work/crucible-site-phone-{390,780}.webp
// (390 × 844 at 2x). Shot at full quality (?liquid=full) once the logo's pour has settled (section.ig[data-settled])
// and the 3D canvas has drawn, so there are no black frames or loading states.
// Usage: npm run build && node scripts/shoot-own.mjs [built site dir, default out/]
// Needs Playwright's Chromium (or CHROMIUM_PATH) and sharp (Next installs it). Software GL is fine (it's slow, not wrong).
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import http from 'node:http';
import fs from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(process.argv[2] ?? join(repo, 'out'));
const dest = join(repo, 'public/work');
if (!fs.existsSync(join(root, 'index.html'))) {
  console.error('No build in out/: run npm run build first.');
  process.exit(1);
}

// out/ as GitHub Pages serves it (`/work` → work.html).
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const p = join(root, decodeURIComponent(req.url.split('?')[0]));
  const hit = [p, p + '.html', join(p, 'index.html')].find((f) => f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile());
  if (!hit) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[extname(hit)] ?? 'application/octet-stream' });
  fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const shots = [
  { name: 'crucible-site', viewport: { width: 1440, height: 900 }, scale: 1, widths: [960, 1440] },
  { name: 'crucible-site-phone', viewport: { width: 390, height: 844 }, scale: 2, widths: [390, 780], mobile: true },
];
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: s.scale, isMobile: !!s.mobile, hasTouch: !!s.mobile });
  const page = await ctx.newPage();
  await page.goto(`${base}/?liquid=full`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // The pour runs on wall-clock time; software GL takes a while. Then let the 3D canvas and the liquid draw a few
  // more frames (the canvases ack each drawn frame) so the shot is the settled page, not a frame in flight.
  await page.waitForSelector('section.ig[data-settled]', { timeout: 120_000 });
  await page.mouse.move(-10, -10);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const w = /** @type {any} */ (window);
    if (typeof w.__liquidFreeze === 'function') w.__liquidFreeze(12);
  });
  await page.waitForTimeout(1500);
  const png = await page.screenshot({ type: 'png' });
  for (const w of s.widths) {
    const file = join(dest, `${s.name}-${w}.webp`);
    await sharp(png).resize({ width: w }).webp({ quality: 82 }).toFile(file);
    console.log(`wrote public/work/${s.name}-${w}.webp`);
  }
  await ctx.close();
}
await browser.close();
server.close();
