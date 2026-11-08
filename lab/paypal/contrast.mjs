// node lab/paypal/contrast.mjs [phone|desk]: per caption, the contrast of bone text against the 90th-percentile
// background luminance under it (text hidden), on the built site (out/), at the middle of each caption's window.
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir = path.resolve('out');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(dir, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html'; if (!fs.existsSync(f)) { r.writeHead(404).end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((ok) => srv.listen(0, ok));
const dev = process.argv[2] || 'phone';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(dev === 'phone' ? { ...devices['iPhone 15'], deviceScaleFactor: 1 } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage(); page.setDefaultTimeout(180000);
await page.goto(`http://localhost:${srv.address().port}/?t=6&q=4`);
await page.waitForFunction(() => window.__world, null, { timeout: 90000 });
const mids = (process.argv[3] || "0.12,0.35,0.59,0.79,0.93").split(",").map(Number);
for (const [i, f] of mids.entries()) {
  await page.evaluate(async (f) => { await window.__world.goPlace('paypal', f); for (let k = 0; k < 12; k++) await window.__world.step(16); }, f);
  const box = await page.evaluate((i) => { const e = document.querySelectorAll('[data-pp-step]')[Math.min(i, 4)]; const r = e.getBoundingClientRect(); e.dataset.o = e.style.opacity; e.style.color = 'transparent'; return { x: r.x, y: r.y, w: r.width, h: r.height, o: e.style.opacity }; }, i);
  await page.evaluate(async () => { await window.__world.step(16); });
  const buf = await page.screenshot({ clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.max(1, box.w), height: Math.max(1, box.h) } });
  await page.evaluate((i) => { document.querySelectorAll('[data-pp-step]')[Math.min(i, 4)].style.color = ''; }, i);
  fs.writeFileSync(`/tmp/pp-cap-${dev}-${i}.png`, buf); await page.screenshot({ path: `/tmp/pp-full-${dev}-${i}.png` });
  console.log(i, f, (await page.evaluate(() => window.__world.engine.frame.at('paypal'))).toFixed(3));
}
await b.close(); srv.close();
