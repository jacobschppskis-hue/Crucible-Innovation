// node lab/paypal/shoot.mjs [phone|desk] p1,p2,...  -> lab/paypal/shots/<dev>-p<p>.png (scratch) + webp
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = pw;
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(new URL('../..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((ok) => srv.listen(0, ok)); const port = srv.address().port;
const dev = process.argv[2] || 'phone'; const ps = (process.argv[3] || '0.1').split(',');
const out = process.argv[4] || path.join(root, 'lab/paypal/shots');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(dev === 'phone' ? { ...devices['iPhone 15'], deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
for (const p of ps) {
  const page = await ctx.newPage(); page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 2000)); });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto(`http://localhost:${port}/lab/paypal/${process.env.PAGE || "index"}.html?p=${p}&t=3`);
  await page.waitForFunction(() => window.__drawn, null, { timeout: 60000 });
  await page.screenshot({ path: path.join(out, `${dev}-p${p}.png`) });
  await page.close();
}
await browser.close(); srv.close();
