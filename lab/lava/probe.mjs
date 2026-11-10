// Probes the lava uniforms and the CPU wake after a stroke (debug aid).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const srv = http.createServer((req, res) => { let f = path.join('out', decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) return res.writeHead(404).end(); res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(0, r));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`http://localhost:${srv.address().port}/?q=8`);
await page.waitForFunction(() => window.__world);
await page.evaluate(() => window.__world.goPlace('ventures', 0.5));
await page.waitForTimeout(300);
await page.evaluate(() => window.__world.hold());
const cdp = await ctx.newCDPSession(page);
for (let i = 0; i <= 30; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 200 + i * 35, y: 675 }); await page.evaluate(() => window.__world.step(16.7)); }
await page.evaluate(() => { for (let i = 0; i < 10; i++) window.__world.step(16.7); });
const r = await page.evaluate(() => {
  const u = window.__world.engine.uniforms, L = window.__lava, W = L.wake.U;
  const f = window.__world.engine.frame;
  const hit = f.hitSea(700, 675);
  const s = hit ? L.sample(hit.w[0], hit.w[1]) : null;
  const e = hit ? L.wake.sampleAt(hit.w[0], hit.w[1]) : null;
  return { uA: Array.from(u.get('lava_uA') || []), WN: u.get('lava_uWN'), box: Array.from(W.box), hit: hit && hit.w, e, first: Array.from(W.tex.slice(0, 12)), ch: { heat: f.ch['lava.heat'], int: f.ch['lava.interact'] } };
});
console.log(JSON.stringify(r));
await b.close(); srv.close();
