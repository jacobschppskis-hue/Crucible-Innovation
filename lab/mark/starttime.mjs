// Time from load + first use to window.__world on iPhone 15 (built out/): node lab/mark/starttime.mjs
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
const ctx = await browser.newContext({ ...devices['iPhone 15'], deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`http://localhost:${srv.address().port}/`, { waitUntil: 'load' });
const t0 = Date.now();
await page.mouse.move(5, 5).catch(() => {});
await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
await page.waitForFunction(() => window.__world || document.documentElement.dataset.worldFail, null, { timeout: 90000, polling: 100 });
console.log('world start after first use', Date.now() - t0, 'ms', await page.evaluate(() => document.documentElement.dataset.worldCrispFail || 'crisp ok'));
await browser.close(); srv.close();
