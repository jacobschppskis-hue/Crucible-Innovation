// Frames of the real world engine (dev server or built site) at places along the journey.
// node lab/look/world-shoot.mjs --url http://localhost:3000/ --dev phone|desk --at hero:0,paypal:0.5 --out dir [--q 2] [--t 6] [--notext]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';

const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? '1' : all[i + 1]]] : a), []));
const OUT = A.out || 'lab/look/shots/world';
fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const prof = A.dev === 'desk' ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { ...devices['iPhone 15'], deviceScaleFactor: +(A.dpr || 1) };
const ctx = await b.newContext(prof);
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
const qs = new URLSearchParams({ t: A.t || '6', ...(A.lookfar ? { lookfar: '1' } : {}), ...(A.q ? { q: A.q } : {}), ...(A.full ? { world: 'full' } : {}) });
await page.goto((A.url || 'http://localhost:3000/') + '?' + qs + (A.extra ? '&' + A.extra : ''), { waitUntil: 'load', timeout: 120000 });
await page.mouse.move(5, 5).catch(() => {});
await page.waitForFunction(() => window.__world || document.documentElement.dataset.worldFail, null, { timeout: 120000 }).catch(() => {});
const fail = await page.evaluate(() => document.documentElement.dataset.worldFail);
if (fail) console.error('WORLD FAIL:', fail.slice(0, 4000));
if (A.notext) await page.addStyleTag({ content: 'main, nav, header, footer, [data-place] > * { visibility: hidden !important }' });
for (const spec of (A.at || 'hero:0').split(',')) {
  const [name, f] = spec.split(':');
  if (name.startsWith('p')) {
    const p = +name.slice(1);
    if (!isNaN(p)) await page.evaluate((p) => window.__world.go(p), p);
    else await page.evaluate(([n, f]) => window.__world.goPlace(n, f), [name, +(f || 0)]);
  } else await page.evaluate(([n, f]) => window.__world.goPlace(n, f), [name, +(f || 0)]);
  await page.evaluate(() => window.__world.hold());
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__world.step(16));
  const st = await page.evaluate(() => { const s = window.__world.state(); return { place: s.place, h: s.cam.h, q: s.quality }; });
  const file = `${OUT}/${A.dev || 'phone'}-${name}-${f || 0}.png`;
  const t0 = Date.now(); await page.screenshot({ path: file, timeout: 300000 }); console.log('shot ms', Date.now() - t0);
  console.log(file, JSON.stringify(st));
  await page.evaluate(() => window.__world.resume());
}
if (errs.length) console.error([...new Set(errs)].slice(0, 12).join('\n').slice(0, 5000));
await b.close();
