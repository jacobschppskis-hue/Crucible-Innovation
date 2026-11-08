// node lab/story/glide.mjs <outdir> p1,p2,...: phone frames at journey progress values (from out/)
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const srv = http.createServer((q, r) => { let f = path.join('out', decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) return r.writeHead(404).end(); r.end(fs.readFileSync(f)); }).listen(8134);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const c = await b.newContext({ ...devices['iPhone 15'], deviceScaleFactor: 1 }); const p = await c.newPage();
await p.goto('http://localhost:8134/' + (process.env.QS ?? '?t=6&q=4')); await p.mouse.move(5, 5).catch(() => {});
await p.waitForFunction(() => window.__world, null, { timeout: 30000 });
const [out, list] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
for (const v of list.split(',')) {
  await p.evaluate((v) => window.__world.go(+v), v); await p.waitForTimeout(300);
  const st = await p.evaluate(() => window.__world.state());
  console.log(v, st.place.name, st.cam.h.toFixed(1), Math.round(st.y));
  await p.screenshot({ path: path.join(out, `g-${v}.png`) });
}
await b.close(); srv.close();
