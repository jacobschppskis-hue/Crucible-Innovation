// node lab/ventures/shoot.mjs <outdir> "<query>|<name>|<w>x<h>" ...   (serves the repo root on :8765 itself)
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('../..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.glsl': 'text/plain', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ts': 'text/javascript' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(8765);
const [out, ...jobs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const j of jobs) {
  const [query, name, size = '1440x900', dpr = '1'] = j.split('|');
  const [w, h] = size.split('x').map(Number);
  const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +dpr });
  pg.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 2000)); });
  pg.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 2000)));
  await pg.goto(`http://localhost:8765/lab/ventures/index.html?t=3&${query}`);
  await pg.waitForFunction(() => window.__ready || window.__err, null, { timeout: 120000 }).catch(() => {});
  const err = await pg.evaluate(() => window.__err);
  if (err) { console.log(name, 'ERR', err); await pg.close(); continue; }
  await pg.screenshot({ path: path.join(out, name + '.png') });
  console.log('ok', name);
  await pg.close();
}
await b.close(); srv.close();
