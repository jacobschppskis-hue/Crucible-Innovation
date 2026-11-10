// A fast flick through the together beat on iPhone 15: samples the shown beat and the weld flash every frame.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = pw;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  let f = path.join('out', decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 15'] });
const page = await ctx.newPage();
await page.goto(`http://localhost:${srv.address().port}/?q=8`, { waitUntil: 'load' });
await page.mouse.move(5, 5).catch(() => {});
await page.waitForFunction(() => window.__world && window.__mark, null, { timeout: 60000 });
await page.evaluate(() => window.__world.goPlace('together', 0));
await page.waitForTimeout(800);
// hold the clock, jump the scroll past the beat (a flick), then step 16 ms frames
const log = await page.evaluate(async () => {
  window.__world.hold();
  const st = window.__world.state();
  const t = st.places.together;
  void t; window.__world.goPlace('story', 0); // far past the pin's end, at once
  const out = [];
  for (let i = 0; i < 160; i++) { await window.__world.step(16); out.push([+(window.__mark.beat).toFixed(3)]); }
  return out.map((x) => x[0]);
});
const weld = log.filter((b) => b > 0.595 && b < 0.67).length;
console.log('frames', log.length, 'first', log.slice(0, 5).join(','), 'last', log.slice(-3).join(','), 'frames in the weld window', weld, `(~${(weld * 16)} ms)`);
await browser.close(); srv.close();
