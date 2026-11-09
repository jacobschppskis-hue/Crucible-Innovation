#!/usr/bin/env node
// V2 per-place review: iPhone 15 (390x844, dpr 2) at a real phone step (?q=4), text visible, fixed clock, a frame at
// every place's middle and between places, plus a contact sheet for review against Jacob's list.
//   node lab/qa/v2-walk.mjs --dir=<built out/> [--q=4] [--n=16]
import { args, serve, browser, context, waitWorld, settle, shot, saveWebp, sharp, fs, path, QA, ROOT } from './lib.mjs';
const A = args({ dir: path.join(ROOT, 'out'), q: '4', n: '16', device: 'iphone' });
const OUT = path.join(QA, 'out', 'v2-walk', A.device); fs.mkdirSync(OUT, { recursive: true });
const srv = await serve(path.resolve(A.dir));
const b = await browser(); const ctx = await context(b, A.device === 'iphone' ? 'iphoneFull' : A.device, { dpr: A.device === 'iphone' ? 2 : 1 }); const page = await ctx.newPage();
await page.goto(`${srv.url}/?q=${A.q}&t=8`, { waitUntil: 'load' }); await waitWorld(page, 40000);
await page.evaluate(() => window.__qa.hold());
const files = [];
for (let i = 0; i < +A.n; i++) {
  const p = i / +A.n;
  await page.evaluate((p) => window.__qa.go(p), p); await settle(page, 8, 70);
  const place = await page.evaluate(() => window.__world.state().place.name);
  const f = path.join(OUT, `${String(i).padStart(2, '0')}-${p.toFixed(3)}-${place}.webp`);
  await saveWebp(await shot(page), f, { width: 390 }); files.push(f);
  console.log(p.toFixed(3), place);
}
const imgs = await Promise.all(files.map((f) => sharp(f).resize({ width: 195 }).toBuffer({ resolveWithObject: true })));
const h = Math.max(...imgs.map((i) => i.info.height)), cols = 8, rows = Math.ceil(imgs.length / cols);
await sharp({ create: { width: cols * 195, height: rows * h, channels: 3, background: '#000' } })
  .composite(imgs.map((im, i) => ({ input: im.data, left: (i % cols) * 195, top: Math.floor(i / cols) * h }))).webp({ quality: 62 })
  .toFile(path.join(QA, 'shots', 'v2', `walk-${A.device}-q${A.q}.webp`));
await b.close(); srv.close();
