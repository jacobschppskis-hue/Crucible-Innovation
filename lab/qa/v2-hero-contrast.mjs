#!/usr/bin/env node
// Hero text over the sea on iPhone 15 (390x844, dpr 2, ?q=4, clock held): per text block (headline, paragraph, buttons),
// contrast of the text colour against the rendered pixels behind its glyph boxes (text hidden, same frame).
// Reports the 5th-percentile contrast (95% of the box at or above it); body text needs >= 4.5, large text >= 3.
//   node lab/qa/v2-hero-contrast.mjs --dir=<built out/> [--p=0]
import { args, serve, browser, context, waitWorld, settle, shot, raw, relLum, contrast, path, ROOT } from './lib.mjs';
const A = args({ dir: path.join(ROOT, 'out'), p: '0', q: '4', device: 'iphone' });
const srv = await serve(path.resolve(A.dir));
const b = await browser(); const ctx = await context(b, A.device === 'iphone' ? 'iphoneFull' : A.device, { dpr: A.device === 'iphone' ? 2 : 1 }); const page = await ctx.newPage();
await page.goto(`${srv.url}/?q=${A.q}&t=8`, { waitUntil: 'load' }); await waitWorld(page, 40000);
await page.evaluate(() => window.__qa.hold());
await page.evaluate((p) => window.__qa.go(+p), A.p); await settle(page, 10, 70);
const boxes = await page.evaluate(() => {
  const hero = document.querySelector('[data-place="hero"]') || document.body;
  const out = [];
  for (const el of hero.querySelectorAll('h1, p, a, button')) {
    const t = el.textContent.trim(); if (!t) continue;
    const r = document.createRange(); r.selectNodeContents(el);
    const rects = [...r.getClientRects()].filter((q) => q.width > 2 && q.height > 4 && q.bottom > 0 && q.top < innerHeight).map((q) => [q.left, q.top, q.width, q.height]);
    if (!rects.length) continue;
    const cs = getComputedStyle(el);
    out.push({ tag: el.tagName.toLowerCase(), text: t.slice(0, 40), size: parseFloat(cs.fontSize), weight: +cs.fontWeight, color: cs.color.match(/[\d.]+/g).map(Number), bg: cs.backgroundColor, rects });
  }
  return out;
});
const hide = await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important} h1 *,h1,p,a{background-image:none!important}' });
const png = await shot(page);
await hide.evaluate((e) => e.remove());
const { data, w, h } = await raw(png);
const dpr = w / (A.device === 'iphone' ? 390 : 1440);
let fails = 0;
for (const bx of boxes) {
  // buttons with their own opaque fill are judged against that fill, not the sea
  const fill = bx.bg.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
  const vals = [];
  const [r0, g0, b0, a0 = 1] = bx.color;
  for (const [x, y, ww, hh] of bx.rects) for (let py = Math.floor(y * dpr); py < Math.min(h, (y + hh) * dpr); py += 2) for (let px = Math.floor(x * dpr); px < Math.min(w, (x + ww) * dpr); px += 2) {
    const i = (py * w + px) * 3; const R = data[i], G = data[i + 1], B = data[i + 2];
    const tr = a0 * r0 + (1 - a0) * R, tg = a0 * g0 + (1 - a0) * G, tb = a0 * b0 + (1 - a0) * B;
    vals.push(contrast(relLum(Math.round(tr), Math.round(tg), Math.round(tb)), relLum(R, G, B)));
  }
  vals.sort((a, c) => a - c);
  const p5 = vals[Math.floor(vals.length * 0.05)] ?? 0;
  const large = bx.size >= 24 || (bx.size >= 18.66 && bx.weight >= 700);
  const need = large ? 3 : 4.5;
  const ok = p5 >= need || (fill[3] ?? 0) > 0.9;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} <${bx.tag}> "${bx.text}" ${bx.size}px: p5 contrast ${p5.toFixed(2)} (need ${need})${(fill[3] ?? 0) > 0.9 ? ' [own fill]' : ''}`);
}
await b.close(); srv.close();
process.exit(fails ? 1 : 0);
