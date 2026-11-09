#!/usr/bin/env node
// V2 "smooth": iPhone 15 emulation with 4x CPU throttling, scrolling through PayPal and ventures with the world running.
// Records long animation frames (LoAF, > 50 ms) and long tasks with their script attribution, so main-thread spikes
// caused by our code (shader compiles, step changes, layout) show up by source. (Software GL's own GPU time runs in the
// GPU process and is not throttled; this measures the main thread.)
//   node lab/qa/v2-smooth.mjs --dir=<built out/> [--q=4] [--rate=4]
import { args, serve, browser, context, waitWorld, cdp, sleep, fs, path, QA, ROOT } from './lib.mjs';
const A = args({ dir: path.join(ROOT, 'out'), q: '4', rate: '4' });
const srv = await serve(path.resolve(A.dir));
const b = await browser();
const ctx = await context(b, 'iphoneFull', { dpr: 1 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__loaf = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), block: Math.round(e.blockingDuration || 0), scripts: (e.scripts || []).sort((a, b) => b.duration - a.duration).slice(0, 2).map((s) => `${Math.round(s.duration)}ms ${s.invoker || ''} ${(s.sourceURL || '').split('/').pop()}:${s.sourceFunctionName || ''}`) }); }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
});
await page.goto(`${srv.url}/?q=${A.q}`, { waitUntil: 'load' });
await waitWorld(page, 40000);
await page.evaluate(() => window.__qa.resume());
const c = await cdp(page);
await c.send('Emulation.setCPUThrottlingRate', { rate: +A.rate });
const res = {};
for (const place of ['paypal', 'ventures']) {
  const r = await page.evaluate((p) => { const s = window.__world.state().places[p]; return s; }, place);
  await page.evaluate((y) => scrollTo(0, y), Math.max(0, r.top - 200)); await sleep(3000);
  await page.evaluate(() => { window.__loaf.length = 0; });
  // scroll through the place with the wheel-free path a phone uses: small programmatic steps at ~60 Hz for its height
  const steps = Math.ceil((r.h + 400) / 12);
  const t0 = Date.now();
  await page.evaluate(async (n) => { for (let i = 0; i < n; i++) { scrollBy(0, 12); await new Promise((r) => requestAnimationFrame(r)); } }, steps);
  const secs = (Date.now() - t0) / 1000;
  const loaf = await page.evaluate(() => window.__loaf.slice());
  const over50 = loaf.filter((e) => e.d > 50);
  res[place] = { secs: +secs.toFixed(1), frames: steps, fps: +(steps / secs).toFixed(1), longFrames: over50.length, worst: over50.sort((a, b) => b.d - a.d).slice(0, 5) };
  console.log(place, JSON.stringify(res[place]).slice(0, 900));
}
fs.mkdirSync(path.join(QA, 'out'), { recursive: true });
fs.writeFileSync(path.join(QA, 'out', 'v2-smooth.json'), JSON.stringify(res, null, 1));
await b.close(); srv.close();
