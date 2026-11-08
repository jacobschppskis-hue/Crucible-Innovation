// Frames of the home page world at each place, on iPhone 15 and 1440x900, from the built site (out/) or the preview.
// node lab/world/shoot.mjs [--url http://...] [--only phone|desk] [--places hero,paypal] [--out dir] [--q 3] [--t 6]
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? '1' : all[i + 1]]] : a), []),
);
const OUT = args.out || 'lab/world/shots';
fs.mkdirSync(OUT, { recursive: true });

function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(dir, p);
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!fs.existsSync(f)) return res.writeHead(404).end('404');
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, () => r({ srv, url: `http://localhost:${srv.address().port}/` })));
}

const exe = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const s = args.url ? null : await serve('out');
const base = args.url || s.url;
const q = new URLSearchParams({ t: args.t || '6', q: args.q || '4' });
const places = (args.places || 'hero,together,story,paypal,jacob,charlie,ventures,thesis,foot,loop').split(',');
const fr = (args.f || '0.5').split(',').map(Number);
const profiles = { phone: devices['iPhone 15'], desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
for (const [name, prof] of Object.entries(profiles)) {
  if (args.only && args.only !== name) continue;
  const ctx = await browser.newContext({ ...prof, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(base + (base.includes('?') ? '&' : '?') + q.toString(), { waitUntil: 'load' });
  await page.mouse.move(10, 10).catch(() => {});
  await page.waitForFunction(() => window.__world || document.documentElement.dataset.worldFail, null, { timeout: 30000 }).catch(() => {});
  const fail = await page.evaluate(() => document.documentElement.dataset.worldFail);
  if (fail) console.log(name, 'FAIL', fail);
  for (const pl of places) {
    for (const f of fr) {
      await page.evaluate(async ([pl, f]) => window.__world && window.__world.goPlace(pl, f).catch((e) => console.log(String(e))), [pl, f]);
      await page.waitForTimeout(200);
      const file = path.join(OUT, `${name}-${pl}-${String(f).replace('.', '')}.png`);
      await page.screenshot({ path: file });
      const st = await page.evaluate(() => window.__world && window.__world.state());
      console.log(name, pl, f, st ? JSON.stringify({ y: Math.round(st.y), p: st.progress.toFixed(3), place: st.place.name, h: st.cam.h.toFixed(1), q: st.quality.step }) : 'no world');
    }
  }
  if (logs.length) console.log(logs.slice(0, 20).join('\n'));
  await ctx.close();
}
await browser.close();
s?.srv.close();
