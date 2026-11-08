#!/usr/bin/env node
// V2 checks (plan/v2/README.md "Checks"): never black (every 2-4% of the journey, world only, text hidden) with the floor
// taken from Jacob's reference frame (plan/v2/reference-orbit.webp), and a WebKit smoke (world starts, no errors, loop).
//   node lab/qa/v2.mjs --dir=<built out/ dir> [--step=0.04] [--devices=iphone,desktop] [--webkit]
import { args, serve, browser, context, waitWorld, settle, shot, stats, saveWebp, sharp, fs, path, QA, ROOT } from './lib.mjs';
import { webkit, devices } from 'playwright';
const A = args({ dir: path.join(ROOT, 'out'), step: '0.04', devices: 'iphone,desktop' });
const OUT = path.join(QA, 'out', 'v2'); fs.mkdirSync(OUT, { recursive: true });
const ref = A.ref || path.join(ROOT, 'plan/v2/reference-orbit.webp');
const lines = [], fails = [];
// the reference's levels: the floor is a fraction of its mean luminance and of its lit area
let floor = { mean: 0.004, lit: 0.08 };
if (fs.existsSync(ref)) {
  const s = await stats(await sharp(ref).png().toBuffer());
  const { data, info } = await sharp(ref).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lit = 0; for (let i = 0; i < data.length; i += 3) if (data[i] + data[i + 1] + data[i + 2] > 3 * 18) lit++;
  const litFrac = lit / (info.width * info.height);
  floor = { mean: s.mean * 0.25, lit: litFrac * 0.35 };
  lines.push(`reference: mean L ${s.mean.toFixed(4)}, lit area ${(litFrac * 100).toFixed(1)}% -> floor mean ${floor.mean.toFixed(4)}, lit ${(floor.lit * 100).toFixed(1)}%`);
}
const srv = await serve(path.resolve(A.dir));
const b = await browser();
for (const dev of A.devices.split(',')) {
  const ctx = await context(b, dev === 'iphone' ? 'iphoneFull' : dev, { dpr: 1 });
  const page = await ctx.newPage();
  await page.goto(srv.url + '/?q=8&t=8', { waitUntil: 'load' });
  if ((await waitWorld(page, 30000)) !== 'world') { fails.push(`[${dev}] world did not start`); await ctx.close(); continue; }
  await page.evaluate(() => window.__qa.hold());
  await page.addStyleTag({ content: 'main,footer,nav,header,[data-place]{visibility:hidden!important}' });
  const black = [];
  for (let p = 0; p <= 1.0001; p += +A.step) {
    await page.evaluate((p) => window.__qa.go(p), p); await settle(page, 8, 70);
    const png = await shot(page);
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let lit = 0, sum = 0; for (let i = 0; i < data.length; i += 3) { const v = data[i] + data[i + 1] + data[i + 2]; sum += v; if (v > 3 * 18) lit++; }
    const litFrac = lit / (info.width * info.height), mean = (await stats(png)).mean;
    const place = await page.evaluate(() => window.__world.state().place.name);
    if (mean < floor.mean || litFrac < floor.lit) {
      const f = path.join(OUT, `black-${dev}-p${p.toFixed(2)}.webp`); await saveWebp(png, f, { width: 390 });
      black.push(`${p.toFixed(2)} (${place}: mean ${mean.toFixed(4)}, lit ${(litFrac * 100).toFixed(1)}%)`);
    }
  }
  (black.length ? fails : lines).push(`[${dev}] never-black: ${black.length ? 'FAIL at ' + black.join(', ') : 'ok at every ' + A.step + ' of the journey'}`);
  await ctx.close();
}
await b.close();
if (A.webkit) {
  const wb = await webkit.launch();
  for (const [name, d] of [['iphone-webkit', devices['iPhone 15']], ['desktop-webkit', { viewport: { width: 1440, height: 900 } }]]) {
    const ctx = await wb.newContext(d); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 200)));
    await page.goto(srv.url + '/?q=6', { waitUntil: 'load' });
    const k = await waitWorld(page, 40000);
    const st = await page.evaluate(() => ({ on: document.documentElement.hasAttribute('data-world-on'), fail: document.documentElement.dataset.worldFail, loop: document.documentElement.hasAttribute('data-loop'), path: document.querySelector('canvas.world')?.dataset.path }));
    const png = await shot(page); await saveWebp(png, path.join(OUT, `${name}.webp`), { width: 390 });
    const s = await stats(png);
    // the loop on WebKit: jump near the end, scroll past it
    let wrap = 'n/a';
    if (k === 'world' && st.loop) {
      await page.evaluate(() => window.__qa.resume());
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      await page.evaluate((y) => scrollTo(0, y), max - 800); await page.waitForTimeout(1500);
      if (name.startsWith('desktop')) { for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); } }
      else { for (let i = 0; i < 4; i++) { await page.touchscreen.tap(195, 500).catch(() => {}); await page.evaluate(() => window.scrollBy(0, 400)); await page.waitForTimeout(400); } }
      await page.waitForTimeout(1500);
      wrap = (await page.evaluate(() => scrollY)) < max / 2 ? 'wrapped' : 'no wrap (scrollY ' + Math.round(await page.evaluate(() => scrollY)) + ')';
    }
    const line = `[${name}] hooks ${k}, world-on ${st.on}, fail ${st.fail ?? '-'}, path ${st.path}, loop ${st.loop}, mean L ${s.mean.toFixed(3)}, wheel/scroll past the end: ${wrap}, errors ${errs.length}${errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''}`;
    (k !== 'world' || errs.length ? fails : lines).push(line);
    await ctx.close();
  }
  await wb.close();
}
srv.close();
for (const l of lines) console.log('  ' + l);
for (const f of fails) console.log('FAIL ' + f);
process.exit(fails.length ? 1 : 0);
