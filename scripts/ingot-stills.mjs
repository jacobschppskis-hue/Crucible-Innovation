// Fallback stills of the 3D ingots (reduced motion, no JS, no WebGL): the same scene the page runs (lib/gl3d/ingotPose.ts),
// square-on with the slight constant tilt, captured from our renderer with a transparent background and written as
// retina-sized WebP to public/film/ingots/<slug>-{600,1200,2400}.webp. Then run `node scripts/venture-og.mjs`.
// Usage: node scripts/ingot-stills.mjs   (needs playwright + a Chromium; WebGL via swiftshader if there is no GPU)
import { chromium } from 'playwright';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'ingot-stills-'));
const tsc = join(root, 'node_modules/.bin/tsc');
execFileSync(tsc, ['--outDir', tmp, '--module', 'esnext', '--target', 'es2020', '--moduleResolution', 'bundler', '--lib', 'es2020,dom', '--skipLibCheck', '--noCheck', join(root, 'lib/gl3d/ingotPose.ts')], { stdio: 'inherit' });
writeFileSync(join(tmp, 'index.html'), '<!doctype html><body style="margin:0"><canvas id="c" style="width:2400px;height:1500px;display:block"></canvas>');
// Extensionless relative imports → .js
copyFileSync(join(root, 'film/fonts/Archivo-ExtraBold.ttf'), join(tmp, 'Archivo.ttf'));
const srv = createServer((q, r) => {
  let f = join(tmp, decodeURIComponent(q.url.split('?')[0]));
  if (!existsSync(f) && existsSync(f + '.js')) f += '.js';
  if (!existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.ttf') ? 'font/ttf' : 'text/html');
  r.end(readFileSync(f));
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${srv.address().port}`;
const exe = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers') ? readdirSync('/opt/pw-browsers').filter((d) => /^chromium-/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux64/chrome`).find(existsSync) : undefined);
const browser = await chromium.launch({ executablePath: exe, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 2400, height: 1500 } });
page.on('pageerror', (e) => console.log('page error', e.message));
await page.goto(base + '/index.html');
const out = join(root, 'public/film/ingots');
for (const slug of ['sites', 'verge', 'trellis']) {
  const png = await page.evaluate(async (slug) => {
    const { buildIngot } = await import('/gl3d/ingotPose.js');
    const { loadIngotFont } = await import('/gl3d/ingots.js');
    document.fonts.add(await new FontFace('Archivo', 'url(/Archivo.ttf)', { weight: '800' }).load());
    await loadIngotFont();
    const old = document.getElementById('c');
    const cv = old.cloneNode();
    old.replaceWith(cv);
    const { stage } = buildIngot(cv, slug, { dpr: 1, quality: 1 });
    stage.render();
    const url = cv.toDataURL('image/png');
    stage.dispose();
    return url;
  }, slug);
  const buf = Buffer.from(png.split(',')[1], 'base64');
  for (const w of [2400, 1200, 600]) {
    await sharp(buf).resize(w, Math.round((w * 5) / 8)).webp({ quality: w === 600 ? 88 : 90, alphaQuality: 100, effort: 5 }).toFile(join(out, `${slug}-${w}.webp`));
  }
  console.log('wrote', slug);
}
await browser.close();
srv.close();
