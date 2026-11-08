// Transparent stills of the three venture monoliths, from the real shader (lib/world/glsl/monolith.glsl) through
// lab/ventures/still.html: public/film/monoliths/<slug>-{600,1200,2400}.webp (2:3). For the /ventures pages and the
// reduced-motion / no-WebGL home.  node scripts/monolith-stills.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = req('/opt/node22/lib/node_modules/playwright'); }
const sharp = req('sharp');
const root = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(root, 'public/film/monoliths');
fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.glsl': 'text/plain' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
const exe = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const b = await pw.chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const SLUGS = ['crucible-sites', 'verge', 'trellis'];
const W = +(process.env.W || 2400);
for (let i = 0; i < 3; i++) {
  const pg = await b.newPage({ viewport: { width: 800, height: 600 } });
  pg.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 400)));
  await pg.goto(`http://localhost:${port}/lab/ventures/still.html?i=${i}&w=${W}`);
  await pg.waitForFunction(() => window.__ready || window.__err, null, { timeout: 600000 });
  const err = await pg.evaluate(() => window.__err);
  if (err) { console.log('ERR', err.slice(0, 2000)); process.exit(1); }
  const png = Buffer.from((await pg.evaluate(() => document.getElementById('c').toDataURL('image/png'))).split(',')[1], 'base64');
  for (const w of [600, 1200, 2400]) {
    const o = path.join(OUT, `${SLUGS[i]}-${w}.webp`);
    await sharp(png).resize(w).webp({ quality: 86, alphaQuality: 90 }).toFile(o);
    console.log(o, Math.round(fs.statSync(o).size / 1024), 'KB');
  }
  await pg.close();
}
await b.close();
srv.close();
