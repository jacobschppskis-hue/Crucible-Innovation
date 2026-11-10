// node lab/story/chan.mjs y0 y1 step: camera channels along the scroll (iPhone 15, from out/)
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const srv = http.createServer((q, r) => { let f = path.join('out', decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) return r.writeHead(404).end(); r.end(fs.readFileSync(f)); }).listen(8137);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const c = await b.newContext({ ...devices['iPhone 15'], deviceScaleFactor: 1 }); const p = await c.newPage();
await p.goto('http://localhost:8137/?t=6&q=8'); await p.mouse.move(5, 5).catch(() => {});
await p.waitForFunction(() => window.__world, null, { timeout: 30000 });
const [y0, y1, st] = process.argv.slice(2).map(Number);
const pl = await p.evaluate(() => Object.fromEntries(Object.entries(window.__world.state().places || {}).map(([k, v]) => [k, [Math.round(v.top), Math.round(v.h)]])));
console.log(JSON.stringify(pl));
for (let y = y0; y <= y1; y += st) {
  const L = await p.evaluate(() => window.__world.state().loopLen);
  await p.evaluate((g) => window.__world.go(g), y / L); await p.waitForTimeout(60);
  const s = await p.evaluate(() => { const st = window.__world.state(); const ch = st.ch; return `${Math.round(st.y)} ${st.place.name} ${st.place.f.toFixed(2)} s=${(ch.s / 6000 * 180 / Math.PI).toFixed(1)} h=${ch.h.toFixed(0)} yaw=${ch.yaw.toFixed(0)} pitch=${ch.pitch.toFixed(0)}`; });
  console.log(s);
}
await b.close(); srv.close();
