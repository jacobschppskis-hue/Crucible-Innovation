// Close frames of the mark in the real engine (built out/): node lab/mark/zoom.mjs <out-prefix> <place> <f,f,...> [phone|desk] [query]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = pw;
const [,, out, place = 'together', fs_ = '0.5', dev = 'desk', query = 'q=0&world=full&t=6'] = process.argv;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  let f = path.join('out', decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, r));
const exe = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const prof = dev === 'phone' ? { ...devices['iPhone 15'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const ctx = await browser.newContext(prof);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto(`http://localhost:${srv.address().port}/?${query}`, { waitUntil: 'load' });
await page.mouse.move(5, 5).catch(() => {});
await page.waitForFunction(() => window.__world || document.documentElement.dataset.worldFail, null, { timeout: 60000 });
for (const f of fs_.split(',')) {
  await page.evaluate(([pl, f]) => window.__world.goPlace(pl, +f), [place, f]);
  await page.waitForTimeout(300);
  await page.evaluate(async () => { window.__world.hold(); await window.__world.step(16); await window.__world.step(16); });
  const file = `${out}-${place}-${f}.png`;
  await page.screenshot({ path: file, timeout: 180000 });
  await page.evaluate(() => window.__world.resume());
  console.log(file);
}
await browser.close();
srv.close();
