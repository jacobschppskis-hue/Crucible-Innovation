// Lava frames in the real engine (the built site in out/): a place, then optionally a cursor stroke or a finger drag
// with the clock held and stepped at 60 Hz, so every frame is deterministic.
// node lab/lava/shoot.mjs --out dir [--only phone|desk] [--places hero:0.5,ventures:0.5] [--stroke 400] [--drag]
//   [--touch] [--tap] [--flick] [--after 30] [--q 4] [--crop x,y,w,h]
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? '1' : all[i + 1]]] : a), []),
);
const OUT = args.out || 'lab/lava/shots';
fs.mkdirSync(OUT, { recursive: true });
function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain' };
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
const s = await serve('out');
const q = new URLSearchParams({ q: args.q || '4', world: args.full ? 'full' : '' });
const places = (args.places || 'hero:0.5').split(',').map((x) => x.split(':'));
const profiles = { phone: { ...devices['iPhone 15'], deviceScaleFactor: 1 }, desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const step = (page, n = 1) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__world.step(1000 / 60); }, n);
for (const [name, prof] of Object.entries(profiles)) {
  if (args.only && args.only !== name) continue;
  const ctx = await browser.newContext(prof);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
  await page.goto(s.url + '?' + q.toString(), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__world || document.documentElement.dataset.worldFail, null, { timeout: 30000 });
  const vp = page.viewportSize();
  const cdp = await ctx.newCDPSession(page);
  for (const [pl, f] of places) {
    await page.evaluate(([pl, f]) => (pl === 'go' ? window.__world.go(+f) : window.__world.goPlace(pl, +f)), [pl, f]);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__world.hold());
    await step(page, 2);
    let tag = '';
    if (args.stroke) {
      // a straight (or --curve) cursor stroke across the lower middle at <stroke> px/s
      const v = +args.stroke, y = vp.height * (+args.y || 0.75), x0 = vp.width * 0.12, x1 = vp.width * 0.88;
      const n = Math.max(2, Math.round(((x1 - x0) / v) * 60));
      if (args.drag) await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y, button: 'left', clickCount: 1 });
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, yy = y - (args.curve ? Math.sin((i / n) * Math.PI) * vp.height * 0.15 : 0);
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: yy, button: args.drag ? 'left' : 'none', buttons: args.drag ? 1 : 0 });
        await step(page);
      }
      if (args.drag) await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y, button: 'left', clickCount: 1 });
      tag = `-stroke${args.stroke}${args.drag ? 'drag' : ''}${args.curve ? 'curve' : ''}`;
    }
    if (args.touch) {
      // a finger drag (an arc) on the glass
      const y = vp.height * 0.72, x0 = vp.width * 0.18, x1 = vp.width * 0.82, n = 40;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, yy = y - Math.sin((i / n) * Math.PI) * vp.height * 0.12;
        await cdp.send('Input.dispatchTouchEvent', { type: i ? 'touchMove' : 'touchStart', touchPoints: [{ x, y: yy, id: 1 }] });
        await step(page);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      tag = '-touch';
    }
    if (args.tap) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width * 0.5, y: vp.height * 0.75, id: 2 }] });
      await step(page, 4);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      tag = '-tap';
    }
    await step(page, +(args.after || (tag ? 30 : 1)));
    const st = await page.evaluate(() => ({ w: window.__world.state(), lava: window.__lava ? { n: window.__lava.wake.U.n, live: window.__lava.live } : null }));
    const file = path.join(OUT, `${name}-${pl}-${String(f).replace('.', '')}${tag}.png`);
    const clip = args.crop ? (([x, y, w, h]) => ({ x, y, width: w, height: h }))(args.crop.split(',').map(Number)) : undefined;
    await page.screenshot({ path: file, clip, timeout: 180000 });
    console.log(file, JSON.stringify({ h: st.w.cam.h.toFixed(1), lava: st.lava }));
    await page.evaluate(() => window.__world.resume());
  }
  await ctx.close();
}
await browser.close();
s.srv.close();
