#!/usr/bin/env node
// V2 "sharp": on iPhone 15 (dpr 3) at a real phone step (?q=4), the crisp pass draws small sharp things at the
// canvas's resolution. Reports render px per CSS px of the canvas (>= 2), whether the crisp program compiled, which
// modules ship a crisp hook, and saves 100% crops of the mark (hero), PayPal and the monoliths for an eye check.
//   node lab/qa/v2-sharp.mjs --dir=<built out/> [--q=4]
import { args, serve, browser, context, waitWorld, settle, shot, sharp, fs, path, QA, ROOT } from './lib.mjs';
const A = args({ dir: path.join(ROOT, 'out'), q: '4' });
const OUT = path.join(QA, 'out', 'v2-sharp'); fs.mkdirSync(OUT, { recursive: true });
const srv = await serve(path.resolve(A.dir));
const b = await browser();
const ctx = await context(b, 'iphoneFull', { dpr: 3 });
const page = await ctx.newPage();
await page.goto(`${srv.url}/?q=${A.q}&t=8`, { waitUntil: 'load' });
const k = await waitWorld(page, 40000);
const info = await page.evaluate(() => {
  const c = document.querySelector('canvas.world');
  const e = window.__world.engine || {};
  const src = (e.composed && (e.composed.crisp || '')) + '';
  const ids = [...new Set([...src.matchAll(/vec4 (\w+)_crisp\(/g)].map((m) => m[1]))];
  return { kind: 'world', canvasPxPerCss: c ? +(c.width / innerWidth).toFixed(2) : null, crispFail: document.documentElement.hasAttribute('data-world-crisp-fail'), crispIds: ids, q: window.__world.state().quality };
});
console.log(k, JSON.stringify(info));
await page.evaluate(() => window.__qa.hold());
await page.addStyleTag({ content: 'main,footer,nav,header,[data-place]{visibility:hidden!important}' });
for (const [name, place, f] of [['mark', 'hero', 0.02], ['paypal', 'paypal', 0.55], ['ventures', 'ventures', 0.5]]) {
  await page.evaluate(([p, f]) => window.__world.goPlace(p, f), [place, f]); await settle(page, 8, 70);
  const png = await shot(page);
  const m = await sharp(png).metadata();
  // the middle of the screen at 100% (3 device px per CSS px)
  await sharp(png).extract({ left: Math.round(m.width * 0.1), top: Math.round(m.height * 0.2), width: Math.round(m.width * 0.8), height: Math.round(m.height * 0.45) }).webp({ quality: 80 }).toFile(path.join(OUT, `${name}-iphone-dpr3-q${A.q}.webp`));
  console.log(name, 'crop ->', path.relative(ROOT, path.join(OUT, `${name}-iphone-dpr3-q${A.q}.webp`)));
}
await b.close(); srv.close();
