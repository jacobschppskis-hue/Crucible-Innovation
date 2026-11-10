// Transparent stills of the three venture castings, from the real shader (lib/world/glsl/monolith.glsl) and the real
// tone curve (lib/world/glsl/post.glsl) through lab/ventures/still.html: public/film/monoliths/<slug>-{600,1200,2400}.webp
// (2:3). For the /ventures pages and the reduced-motion / no-WebGL home page.
//
//   node scripts/monolith-stills.mjs             render the nine files from the frame stored in lab/ventures/still.html
//   node scripts/monolith-stills.mjs --capture   first re-capture that frame from the built site (run `npm run build`
//                                                before): the world's uniforms at place `ventures`, f 0.6, 1440 x 900
//                                                (camera, poses, shapes, finishes, the moon, the night sky). Do this
//                                                after any change to lib/world/ventures.ts, its keys or look's night.
//   W=1200 SS=3 ONLY=verge                       a quicker pass (render width, supersamples per axis, one slug)
// Then: node scripts/venture-og.mjs (the share images are made from these).
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = req('/opt/node22/lib/node_modules/playwright'); }
const sharp = req('sharp');
const root = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = process.env.OUT || path.join(root, 'public/film/monoliths');
const STILL = path.join(root, 'lab/ventures/still.html');
fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.glsl': 'text/plain', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = (dir) =>
  new Promise((res) => {
    const srv = http.createServer((q, r) => {
      const p = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
      const f = [p, p + '.html', path.join(p, 'index.html')].find((x) => x.startsWith(dir) && fs.existsSync(x) && fs.statSync(x).isFile());
      if (!f) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
const exe = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const b = await pw.chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// ---- --capture: the home page's frame at its settled ventures shot, written into still.html ----
if (process.argv.includes('--capture')) {
  const out = path.join(root, 'out');
  if (!fs.existsSync(path.join(out, 'index.html'))) { console.log('no out/: run `npm run build` first'); process.exit(1); }
  const srv = await serve(out);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  // record every uniform the world sets (by name) and the framebuffer of look's sky-view LUT (192 x 108)
  await ctx.addInitScript(() => {
    const names = new WeakMap(), U = (window.__U = {}), gls = new Set();
    const P = WebGL2RenderingContext.prototype;
    const gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = gc.call(this, t, ...a); if (t === 'webgl2' && c) gls.add(c); return c; };
    const gul = P.getUniformLocation, bf = P.bindFramebuffer, vp = P.viewport, da = P.drawArrays;
    P.getUniformLocation = function (p, n) { const l = gul.call(this, p, n); if (l) names.set(l, n); return l; };
    P.bindFramebuffer = function (t, f) { this.__fb = f; return bf.call(this, t, f); };
    P.viewport = function (x, y, w, h) { this.__vp = [w, h]; return vp.call(this, x, y, w, h); };
    P.drawArrays = function (...a) { if (this.__fb && this.__vp && this.__vp[0] === 192 && this.__vp[1] === 108) this.__sky = this.__fb; return da.apply(this, a); };
    for (const k of Object.getOwnPropertyNames(P)) {
      if (!/^uniform(Matrix)?[1-4]?[fi]v?$/.test(k)) continue;
      const orig = P[k];
      P[k] = function (l, ...a) { const n = l && names.get(l); if (n) { const v = k.startsWith('uniformMatrix') ? a[1] : a.length === 1 ? a[0] : a; U[n] = typeof v === 'number' ? v : Array.from(v); } return orig.call(this, l, ...a); };
    }
    window.__sky = () => { for (const g of gls) if (g.__sky) { bf.call(g, g.FRAMEBUFFER, g.__sky); const d = new Float32Array(192 * 108 * 4); g.readPixels(0, 0, 192, 108, g.RGBA, g.FLOAT, d); bf.call(g, g.FRAMEBUFFER, null); return Array.from(d); } return null; };
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 400)));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/?q=3&motion`, { waitUntil: 'load' });
  await pg.waitForSelector('html[data-world-on]', { timeout: 300000 });
  await pg.evaluate(async () => { const w = window.__world; w.hold(); w.goPlace('ventures', 0.6); await w.step(1000); await w.step(1000); await w.step(200); });
  const [U, sky, place] = await pg.evaluate(() => [window.__U, window.__sky(), window.__world.state().place]);
  await ctx.close(); srv.close();
  if (!sky || !U['ventures_uP[0]']) { console.log('capture failed: no sky LUT or no ventures uniforms'); process.exit(1); }
  const keep = ['uCamPos', 'uCam', 'uFocal', 'uRes', 'uR', 'uCamH', 'uCamUp', 'uSunDir', 'uTime', 'uExposure', 'look_uMoonDir', 'look_uMoonE', 'look_uCam', 'look_uRg'];
  const u = {};
  const r6 = (x) => +x.toPrecision(7);
  for (const [n, v] of Object.entries(U)) {
    if (!keep.includes(n) && !n.startsWith('ventures_')) continue;
    u[n] = typeof v === 'number' ? r6(v) : v.length === 1 ? r6(v[0]) : v.map(r6);
  }
  // the sky above the sea: at night the LUT does not vary with azimuth; keep one column of its top rows
  const ROW0 = 84, rows = [];
  let spread = 0;
  for (let y = ROW0; y < 108; y++) {
    const s = [0, 0, 0], mn = [1e9, 1e9, 1e9], mx = [0, 0, 0];
    for (let x = 0; x < 192; x++) for (let c = 0; c < 3; c++) { const v = sky[(y * 192 + x) * 4 + c]; s[c] += v / 192; mn[c] = Math.min(mn[c], v); mx[c] = Math.max(mx[c], v); }
    for (let c = 0; c < 3; c++) spread = Math.max(spread, (mx[c] - mn[c]) / Math.max(s[c], 1e-9));
    rows.push(s.map((v) => +v.toPrecision(4)));
  }
  if (spread > 0.05) console.log(`warning: the sky varies ${(spread * 100).toFixed(1)}% with azimuth; still.html keeps one column`);
  const frame = { from: `place ${place.name} f ${place.f.toFixed(2)}, 1440 x 900`, u, sky: rows, skyRow0: ROW0, skyH: 108 };
  const src = fs.readFileSync(STILL, 'utf8');
  const next = src.replace(/\/\* FRAME:begin \*\/[\s\S]*?\/\* FRAME:end \*\//, () => `/* FRAME:begin */\nconst FRAME = ${JSON.stringify(frame)};\n/* FRAME:end */`);
  if (next === src && !src.includes(JSON.stringify(frame))) { console.log('capture failed: no FRAME block in still.html'); process.exit(1); }
  fs.writeFileSync(STILL, next);
  console.log('captured', frame.from, '->', path.relative(root, STILL));
}

// ---- render ----
const srv = await serve(root);
const port = srv.address().port;
const SLUGS = ['crucible-sites', 'verge', 'trellis'];
const W = +(process.env.W || 2400), SS = +(process.env.SS || 4);
for (let i = 0; i < 3; i++) {
  if (process.env.ONLY && process.env.ONLY !== SLUGS[i]) continue;
  const t0 = Date.now();
  const pg = await b.newPage({ viewport: { width: 800, height: 600 } });
  pg.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 400)));
  await pg.goto(`http://127.0.0.1:${port}/lab/ventures/still.html?i=${i}&w=${W}&ss=${SS}${process.env.Q ? '&' + process.env.Q : ''}`);
  await pg.waitForFunction(() => window.__ready || window.__err, null, { timeout: 1800000 });
  const err = await pg.evaluate(() => window.__err);
  if (err) { console.log('ERR', err.slice(0, 2000)); process.exit(1); }
  const png = Buffer.from((await pg.evaluate(() => document.getElementById('c').toDataURL('image/png'))).split(',')[1], 'base64');
  if (process.env.PNG) fs.writeFileSync(path.join(OUT, `${SLUGS[i]}.png`), png);
  for (const w of [600, 1200, 2400]) {
    if (w > W) continue;
    const o = path.join(OUT, `${SLUGS[i]}-${w}.webp`);
    await sharp(png).resize(w).webp({ quality: 86, alphaQuality: 90 }).toFile(o);
    console.log(o, Math.round(fs.statSync(o).size / 1024), 'KB', w === 600 ? `(${Math.round((Date.now() - t0) / 1000)} s)` : '');
  }
  await pg.close();
}
await b.close();
srv.close();
