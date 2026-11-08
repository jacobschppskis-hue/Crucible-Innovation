// node lab/paypal/shoot-stage.mjs phone|desk f1,f2,... outDir [query]  (the real engine, lab/paypal/stage.html)
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(new URL('../..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise((ok) => srv.listen(0, ok));
const [dev = 'phone', fs_ = '0.5', out = 'lab/paypal/shots', query = 't=3&loop=0&world=full'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(dev === 'phone' ? { ...devices['iPhone 15'], deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 3000)); });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(`http://localhost:${srv.address().port}/lab/paypal/stage.html?${query}`);
await page.waitForFunction(() => window.__world || document.documentElement.dataset.worldFail !== undefined, null, { timeout: 90000 });
const fail = await page.evaluate(() => document.documentElement.dataset.worldFail);
if (fail) console.log('WORLD FAIL', fail);
for (const f of fs_.split(',')) {
  await page.evaluate(async (f) => { await window.__world.goPlace('paypal', +f); await window.__world.step(16); await window.__world.step(16); }, f);
  await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ at: window.__world.engine.frame.at('paypal'), q: window.__world.state().quality, pp: window.__pp(), ch: (({s,h,pitch,fov})=>({s,h,pitch,fov}))(window.__world.state().ch), exp: window.__ppExpect(window.__world.engine.frame.at('paypal'), window.__world.state().narrow) }));
  console.log(f, JSON.stringify({ at: st.at.toFixed(3), scale: st.q.scale, rows: st.pp.rows, ch: st.ch, exp: st.exp }));
  await page.screenshot({ path: path.join(out, `${dev}-f${f}.png`) });
}
await browser.close(); srv.close();
