#!/usr/bin/env node
// The deep QA harness. `npm run qa:deep -- --target=out --checks=walk,loop,...`
//   --target   out | dist | frame | iframe | airless | continuum | URL     (see lab/qa/lib.mjs)
//   --checks   comma list (default: all): walk film loop touch keys rm nojs nowebgl frame overflow dead contrast perf memory
//   --devices  iphone,desktop (default both)        --n=24 frames per walk        --tag=name (report suffix)
// Writes lab/qa/out/<tag>/report.md + report.json and frames; contact sheets (small webp) go to lab/qa/shots/<tag>/.
import {
  args, target, browser, context, watch, benignError, waitWorld, adapter, settle, shot, stats, diff, raw, saveWebp,
  relLum, contrast, cdp, touchDrag, tap, flick, sleep, sharp, fs, path, QA,
} from './lib.mjs';

const A = args({ target: 'out', checks: 'walk,film,loop,touch,keys,rm,nojs,nowebgl,frame,overflow,dead,contrast,perf,memory', devices: 'iphone,desktop', n: '24' });
const TAG = A.tag || A.target.replace(/[^a-z0-9]+/gi, '-').slice(0, 30);
const OUT = path.join(QA, 'out', TAG);
const SHOTS = path.join(QA, 'shots', TAG);
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
const CHECKS = new Set(String(A.checks).split(','));
const DEVS = String(A.devices).split(',').map((d) => (d === 'iphone' ? 'iphoneFull' : d));
const findings = []; // {sev: 'P0'|'P1'|'P2', check, device, msg, frame?}
const info = [];
const F = (sev, check, device, msg, frame) => { findings.push({ sev, check, device, msg, frame: frame && path.relative(path.join(QA, '..', '..'), frame) }); console.log(`${sev} ${check} [${device}] ${msg}`); };
const I = (check, device, msg) => { info.push({ check, device, msg }); console.log(`   ${check} [${device}] ${msg}`); };
const tg = await target(A.target === 'iframe' ? 'frame' : A.target);
const URL0 = tg.url + (A.target === 'iframe' ? '/iframe.html' : tg.path);
const withQ = (u, q) => u + (u.includes('?') ? '&' : '?') + q;
const devName = (d) => (d === 'iphoneFull' ? 'iphone' : d);
let B = await browser();

async function open(device, { url = URL0, dpr = 1, ctxOpts = {}, b = B } = {}) {
  const ctx = await context(b, device, { dpr, ctx: ctxOpts });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  const kind = await waitWorld(page, 15000);
  return { ctx, page, log, kind };
}
async function contactSheet(files, out, cols = 6, w = 240) {
  if (!files.length) return;
  const imgs = await Promise.all(files.map((f) => sharp(f).resize({ width: w }).toBuffer({ resolveWithObject: true })));
  const h = Math.max(...imgs.map((i) => i.info.height));
  const rows = Math.ceil(imgs.length / cols);
  const base = sharp({ create: { width: cols * w, height: rows * h, channels: 3, background: '#000' } });
  await base.composite(imgs.map((im, i) => ({ input: im.data, left: (i % cols) * w, top: Math.floor(i / cols) * h }))).webp({ quality: 60 }).toFile(out);
  const kb = fs.statSync(out).size / 1024;
  if (kb > 290) await sharp(out).resize({ width: Math.round(cols * w * 0.7) }).webp({ quality: 50 }).toFile(out + '.tmp.webp').then(() => fs.renameSync(out + '.tmp.webp', out));
}

// ---------------------------------------------------------------- walk: the whole journey, frame by frame, held clock
async function walk(device) {
  const { ctx, page, log, kind } = await open(device);
  if (kind === 'none') { F('P0', 'walk', devName(device), 'no world hooks (__world / __state)'); await ctx.close(); return; }
  await page.evaluate(() => window.__qa.hold());
  const N = +A.n, files = [];
  const dir = path.join(OUT, 'walk', devName(device));
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const p = i / N;
    await page.evaluate((p) => window.__qa.go(p), p);
    await settle(page, 24, 40);
    const png = await shot(page);
    const s = await stats(png);
    const f = path.join(dir, `${String(i).padStart(2, '0')}-p${p.toFixed(3)}.webp`);
    await saveWebp(png, f, { width: device === 'desktop' ? 720 : 390 });
    files.push(f);
    if (s.mean < 0.0015 && s.grad < 0.0004) F('P0', 'walk', devName(device), `p=${p.toFixed(3)} black frame`, f);
    if (s.mean > 0.55) F('P1', 'walk', devName(device), `p=${p.toFixed(3)} frame mostly white/blown (mean L ${s.mean.toFixed(2)})`, f);
    if (s.hot > 0.25) F('P2', 'walk', devName(device), `p=${p.toFixed(3)} ${(s.hot * 100).toFixed(0)}% of the frame is saturated Ember/orange (colour budget?)`, f);
    if (prev && i === N) {
      const d = await diff(prev.first, png);
      if (d.mad > 6) F('P0', 'loop', devName(device), `last frame (p=1) != first frame (p=0): mean |Δ| ${d.mad.toFixed(1)}, p99 ${d.p99}`, f);
      else I('loop', devName(device), `p=1 frame matches p=0 (mean |Δ| ${d.mad.toFixed(2)})`);
    }
    if (i === 0) prev = { first: png };
  }
  await contactSheet(files, path.join(SHOTS, `walk-${devName(device)}.webp`), device === 'desktop' ? 5 : 9, device === 'desktop' ? 288 : 130);
  I('walk', devName(device), `${N + 1} frames -> ${path.relative(QA, dir)}; sheet shots/${TAG}/walk-${devName(device)}.webp; state ${JSON.stringify(await page.evaluate(() => window.__qa.state())).slice(0, 200)}`);
  for (const e of log.errors.filter((e) => !benignError(e)).slice(0, 5)) F('P1', 'walk', devName(device), e);
  await ctx.close();
}

// ---------------------------------------------------------------- film: constant-speed scroll, one frame per step; flags pops
async function film(device) {
  const { ctx, page, kind } = await open(device);
  if (kind === 'none') { await ctx.close(); return; }
  await page.evaluate(() => window.__qa.hold());
  const N = Math.round(+A.filmN || 160);
  // real scroll positions (what a visitor does), one 40 ms frame per step; the full loop period
  const maxY = await page.evaluate(() => window.__qa.maxY());
  const ds = [], frames = [];
  let last = null;
  for (let i = 0; i <= N; i++) {
    await page.evaluate(([i, N]) => { const p = i / N; if (window.__world?.go) window.__qa.go(p); else scrollTo(0, Math.round(p * window.__qa.maxY())); window.__qa.step(40); window.__qa.step(40); }, [i, N]);
    const png = await shot(page, { scale: 'css' });
    const small = await sharp(png).resize({ width: 240 }).png().toBuffer();
    if (last) ds.push((await diff(last, small)).mad);
    frames.push(small);
    last = small;
  }
  // a pop: a frame-to-frame change much larger than its neighbours (scroll speed is constant)
  const pops = [];
  for (let i = 0; i < ds.length; i++) {
    const nb = ds.slice(Math.max(0, i - 4), i).concat(ds.slice(i + 1, i + 5)).sort((a, b) => a - b);
    const med = nb[Math.floor(nb.length / 2)] ?? 0;
    if (ds[i] > Math.max(6, med * 3.5)) pops.push({ i, p: (i + 1) / N, d: ds[i], med });
  }
  const dir = path.join(OUT, 'film', devName(device));
  fs.mkdirSync(dir, { recursive: true });
  for (const pp of pops) {
    const f = path.join(dir, `pop-${pp.p.toFixed(3)}.webp`);
    // before | after side by side
    const a = await sharp(frames[pp.i]).toBuffer(), b = await sharp(frames[pp.i + 1]).toBuffer();
    const m = await sharp(a).metadata();
    await sharp({ create: { width: m.width * 2 + 4, height: m.height, channels: 3, background: '#f0f' } })
      .composite([{ input: a, left: 0, top: 0 }, { input: b, left: m.width + 4, top: 0 }]).webp({ quality: 70 }).toFile(f);
    F(pp.d > 25 ? 'P1' : 'P2', 'film', devName(device), `pop at p≈${pp.p.toFixed(3)} (scrollY≈${Math.round(pp.p * maxY)}): frame Δ ${pp.d.toFixed(1)} vs neighbours ${pp.med.toFixed(1)}`, f);
  }
  fs.writeFileSync(path.join(dir, 'deltas.json'), JSON.stringify(ds.map((d) => +d.toFixed(2))));
  I('film', devName(device), `${N} steps over the loop, ${pops.length} pops; median Δ ${[...ds].sort((a, b) => a - b)[ds.length >> 1]?.toFixed(2)}`);
  await ctx.close();
}

// ---------------------------------------------------------------- loop: real input across the wrap (wheel, keys, touch)
async function trace(page, ms, every = 33) {
  return page.evaluate(async ([ms, every]) => {
    const out = []; const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      out.push([Math.round(performance.now() - t0), scrollY, window.__qa.progress()]);
      await new Promise((r) => setTimeout(r, every));
    }
    return out;
  }, [ms, every]);
}
function analyse(tr, dir = 1) {
  // wraps = big scrollY jumps against the direction of travel; progress should stay continuous modulo 1
  const wraps = [], backs = [];
  let stall = 0;
  for (let i = 1; i < tr.length; i++) {
    const dy = tr[i][1] - tr[i - 1][1];
    let dp = tr[i][2] - tr[i - 1][2];
    if (dp < -0.5) dp += 1; if (dp > 0.5) dp -= 1;
    if (Math.sign(dy) === -dir && Math.abs(dy) > 400) wraps.push({ t: tr[i][0], from: tr[i - 1][1], to: tr[i][1], dp });
    else if (dy * dir < -2) backs.push({ t: tr[i][0], dy });
    if (Math.abs(dp) > 0.08) backs.push({ t: tr[i][0], progressJump: +dp.toFixed(3) });
  }
  return { wraps, backs, moved: tr.at(-1)[1] - tr[0][1] };
}
// input tests can run the world at a cheap step so SwiftShader does not starve input (--inputQuery=q=5)
const INPUT_URL = A.inputQuery ? withQ(URL0, A.inputQuery) : URL0;
async function loop(device) {
  const dn = devName(device);
  const { ctx, page, kind } = await open(device, { url: INPUT_URL });
  if (kind === 'none') { await ctx.close(); return; }
  await page.evaluate(() => window.__qa.resume());
  const maxY = await page.evaluate(() => window.__qa.maxY());
  const H = await page.evaluate(() => innerHeight);
  // 1) wheel / trackpad (desktop) down through the bottom
  if (device === 'desktop') {
    await page.evaluate((y) => scrollTo(0, y), maxY - 2 * H); await sleep(600);
    const p0 = await page.evaluate(() => window.__qa.progress());
    // keep wheeling until well past the bottom (input is frame-gated under SwiftShader, so count distance, not ticks)
    const tp = trace(page, 14000);
    for (let i = 0, t = Date.now(); Date.now() - t < 12000; i++) {
      await page.mouse.wheel(0, 120); await sleep(50);
      if (i % 10 === 9 && (await page.evaluate(([m, h]) => scrollY < m - 3 * h || window.__qa.progress() < 0.2, [maxY, H]))) { await sleep(1500); break; }
    }
    const tr = await tp;
    const a = analyse(tr, 1);
    fs.writeFileSync(path.join(OUT, `loop-wheel-${dn}.json`), JSON.stringify(tr));
    if (!a.wraps.length) F('P0', 'loop', dn, `wheel: no wrap after scrolling past the bottom (scrollY ${tr[0][1]} -> ${tr.at(-1)[1]}, maxY ${maxY}, progress ${p0.toFixed(3)} -> ${tr.at(-1)[2].toFixed(3)})`);
    else I('loop', dn, `wheel: wrapped ${a.wraps.length}× (${a.wraps.map((w) => `${w.from}->${w.to} dp ${w.dp.toFixed(3)}`).join(', ')})`);
    if (a.backs.length) F('P1', 'loop', dn, `wheel: ${a.backs.length} backward/discontinuous steps: ${JSON.stringify(a.backs.slice(0, 3))}`);
    // upward through the top
    await page.evaluate(() => scrollTo(0, 300)); await sleep(600);
    const tp2 = trace(page, 4000);
    for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, -120); await sleep(50); }
    const tr2 = await tp2; const a2 = analyse(tr2, -1);
    if (!a2.wraps.length) F('P1', 'loop', dn, `wheel up: no wrap past the top (scrollY ${tr2[0][1]} -> ${tr2.at(-1)[1]})`);
    else I('loop', dn, `wheel up: wrapped (${a2.wraps.map((w) => `${w.from}->${w.to}`).join(', ')})`);
  }
  // 2) touch: flicks with momentum through the bottom (iPhone)
  if (device !== 'desktop') {
    const c = await cdp(page);
    await page.evaluate((y) => scrollTo(0, y), maxY - 1.5 * H); await sleep(800);
    const tp = trace(page, 6000, 25);
    for (let k = 0; k < 4; k++) { await flick(c, { y: H * 0.8, dy: -H * 0.45 }); await sleep(700); }
    const tr = await tp; const a = analyse(tr, 1);
    fs.writeFileSync(path.join(OUT, `loop-flick-${dn}.json`), JSON.stringify(tr));
    if (!a.wraps.length) F('P0', 'loop', dn, `touch flick: no wrap past the bottom (scrollY ${tr[0][1]} -> ${tr.at(-1)[1]}, maxY ${maxY})`);
    else {
      // momentum must survive the wrap: the page keeps moving forward for a while after it
      const w = a.wraps[0]; const after = tr.filter((r) => r[0] > w.t && r[0] < w.t + 400);
      const movedAfter = after.length > 1 ? after.at(-1)[1] - after[0][1] : 0;
      I('loop', dn, `flick: wrapped ${a.wraps.length}×; moved ${movedAfter}px in the 400 ms after the first wrap`);
      if (movedAfter < 30) F('P1', 'loop', dn, `flick: momentum looks killed at the wrap (only ${movedAfter}px in the next 400 ms)`);
    }
    if (a.backs.length) F('P1', 'loop', dn, `flick: ${a.backs.length} backward/discontinuous steps: ${JSON.stringify(a.backs.slice(0, 3))}`);
  }
  // 3) keyboard: PageDown / Space through the bottom
  if (device === 'desktop') {
    await page.evaluate((y) => scrollTo(0, y), maxY - 2 * H); await sleep(500);
    await page.locator('body').click({ position: { x: 5, y: H / 2 } }).catch(() => {});
    const tp = trace(page, 6000);
    for (let k = 0; k < 4; k++) { await page.keyboard.press(k % 2 ? 'Space' : 'PageDown'); await sleep(900); }
    const tr = await tp; const a = analyse(tr, 1);
    if (!a.wraps.length) F('P1', 'keys', dn, `PageDown/Space: no wrap past the bottom (scrollY ${tr[0][1]} -> ${tr.at(-1)[1]})`);
    else I('keys', dn, `PageDown/Space wrap ok (${a.wraps.length})`);
  }
  await ctx.close();
}

// ---------------------------------------------------------------- touch: drag makes waves, vertical drag scrolls, tap clicks
async function touch(device) {
  if (device === 'desktop') return;
  const dn = devName(device);
  const { ctx, page, kind } = await open(device);
  const c = await cdp(page);
  const H = await page.evaluate(() => innerHeight), W = await page.evaluate(() => innerWidth);
  // vertical drag scrolls the page even over the world
  await page.evaluate(() => scrollTo(0, 0)); await sleep(300);
  const y0 = await page.evaluate(() => scrollY);
  const pts = []; for (let i = 0; i <= 12; i++) pts.push([W * 0.5, H * 0.75 - (H * 0.4 * i) / 12]);
  await touchDrag(c, pts); await sleep(700);
  const y1 = await page.evaluate(() => scrollY);
  if (y1 - y0 < H * 0.2) F('P0', 'touch', dn, `a vertical finger drag did not scroll the page (${y0} -> ${y1}): touch-action / preventDefault on the world?`);
  else I('touch', dn, `vertical drag scrolls (${y0} -> ${y1})`);
  // horizontal drag: no sideways scroll, no history navigation
  const href0 = page.url();
  const hp = []; for (let i = 0; i <= 12; i++) hp.push([W * 0.1 + (W * 0.8 * i) / 12, H * 0.6]);
  await touchDrag(c, hp); await sleep(500);
  const sx = await page.evaluate(() => scrollX);
  if (sx !== 0) F('P1', 'touch', dn, `horizontal drag scrolled sideways (scrollX ${sx})`);
  if (page.url() !== href0) F('P0', 'touch', dn, `horizontal drag navigated away (${page.url()})`);
  // waves from the finger: the same held frames with and without a drag (where the camera swoops low)
  if (kind !== 'none') {
    const placeP = +(A.seaP ?? (kind === 'world' ? (await page.evaluate(() => window.__world.state?.().seaP ?? 0.0)) : 0));
    const frameAfter = async (drag) => {
      await page.evaluate((p) => { window.__qa.hold(); window.__qa.go(p); }, placeP);
      await settle(page, 20, 40);
      if (drag) {
        const dp = []; for (let i = 0; i <= 16; i++) dp.push([W * 0.2 + (W * 0.6 * i) / 16, H * 0.62 + Math.sin(i / 3) * 10]);
        // interleave clock steps with the moves so the engine samples the path
        await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: dp[0][0], y: dp[0][1], id: 1 }] });
        for (const [x, y] of dp.slice(1)) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }); await page.evaluate(() => window.__qa.step(16)); }
        await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else for (let i = 0; i < 16; i++) await page.evaluate(() => window.__qa.step(16));
      await settle(page, 30, 33);
      return shot(page);
    };
    const s0 = await page.evaluate(() => scrollY);
    const region = { x: 0, y: Math.round(H * 0.45), w: W, h: Math.round(H * 0.35) };
    const reload = async () => { await page.reload({ waitUntil: 'load' }); await waitWorld(page, 15000); };
    await reload(); const a = await frameAfter(false);
    // the noise floor: the same no-drag run again (time after a reload is not exactly the same everywhere)
    await reload(); const a2 = await frameAfter(false);
    await reload(); const b = await frameAfter(true);
    const s1 = await page.evaluate(() => scrollY);
    const d = await diff(a, b, region), n0 = await diff(a, a2, region);
    const f = path.join(OUT, `touch-wake-${dn}.webp`);
    await saveWebp(b, f, { width: 390 });
    I('touch', dn, `finger wake at p=${placeP}: Δ vs no-drag ${d.mad.toFixed(2)} (p99 ${d.p99}), noise floor ${n0.mad.toFixed(2)}; scroll ${s0}/${s1}`);
    if (d.mad < Math.max(0.4, n0.mad * 2)) F('P1', 'touch', dn, `a horizontal finger drag over the sea left no visible wake at p=${placeP} (Δ ${d.mad.toFixed(2)}): pass --seaP=<p> of a low swoop or expose state().seaP`, f);
  }
  // tap: the first visible link/button in main receives a click
  await page.evaluate(() => { window.__qa?.resume?.(); scrollTo(0, 0); });
  await sleep(400);
  const box = await page.evaluate(() => {
    const els = [...document.querySelectorAll('main a[href], main button')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 20 && r.height > 20 && r.top > 60 && r.bottom < innerHeight - 10; });
    const e = els[0]; if (!e) return null;
    window.__tapped = 0; e.addEventListener('click', (ev) => { window.__tapped++; ev.preventDefault(); }, { once: true });
    const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: (e.textContent || '').trim().slice(0, 40), h: r.height };
  });
  if (!box) I('touch', dn, 'no tappable link in the first screen of main');
  else {
    await tap(c, box.x, box.y); await sleep(400);
    const n = await page.evaluate(() => window.__tapped);
    if (!n) F('P0', 'touch', dn, `tapping "${box.t}" did not click it`);
    else I('touch', dn, `tap on "${box.t}" clicks`);
    if (box.h < 44) F('P2', 'touch', dn, `"${box.t}" tap target is ${box.h.toFixed(0)}px tall (< 44)`);
  }
  await ctx.close();
}

// ---------------------------------------------------------------- reduced motion: still, and the page simply ends
async function rm(device) {
  const dn = devName(device);
  const { ctx, page, log } = await open(device, { ctxOpts: { reducedMotion: 'reduce' } });
  const t = async () => page.evaluate(() => [document.querySelector('canvas')?.dataset.t, JSON.stringify(window.__qa?.state?.() ?? null).slice(0, 120)]);
  const a = await t(); await sleep(1200); const b = await t();
  const s1 = await shot(page); await sleep(800); const s2 = await shot(page);
  const d = await diff(s1, s2);
  if (d.mad > 1.5) F('P1', 'rm', dn, `reduced motion: the screen keeps changing at rest (Δ ${d.mad.toFixed(2)} over 0.8 s)`);
  const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await page.evaluate(() => scrollTo(0, 1e9)); await sleep(400);
  if (device === 'desktop') { for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 200); await sleep(60); } } else { const c = await cdp(page); await flick(c, { y: 600, dy: -400 }); await sleep(900); await flick(c, { y: 600, dy: -400 }); }
  await sleep(800);
  const y = await page.evaluate(() => scrollY);
  if (y < maxY - 5) F('P1', 'rm', dn, `reduced motion: the page does not simply end (scrollY ${y} after scrolling past the bottom, max ${maxY}): it should not loop`);
  const f = path.join(OUT, `rm-${dn}-end.webp`); await saveWebp(await shot(page), f, { width: 390 });
  const st = await stats(await shot(page));
  if (st.mean < 0.0015 && st.grad < 0.0004) F('P1', 'rm', dn, 'reduced motion: the end of the page is black (no still?)', f);
  await page.evaluate(() => scrollTo(0, 0)); await sleep(300);
  const f0 = path.join(OUT, `rm-${dn}-top.webp`); const top = await shot(page); await saveWebp(top, f0, { width: 390 });
  const st0 = await stats(top);
  if (st0.grad < 0.0006) F('P1', 'rm', dn, `reduced motion: the hero has no still image (flat frame)`, f0);
  I('rm', dn, `data-t ${a[0]} -> ${b[0]}; Δ at rest ${d.mad.toFixed(2)}; end scrollY ${y}/${maxY}`);
  for (const e of log.errors.filter((e) => !benignError(e)).slice(0, 4)) F('P1', 'rm', dn, e);
  await ctx.close();
}

// ---------------------------------------------------------------- no JS: everything readable, a designed still
async function nojs(device) {
  const dn = devName(device);
  const ctx = await context(B, device, { dpr: 1, ctx: { javaScriptEnabled: false } });
  const page = await ctx.newPage();
  await page.goto(URL0, { waitUntil: 'load' });
  const r = await page.evaluate(() => {
    const hidden = [];
    for (const e of document.querySelectorAll('main h1, main h2, main h3, main p, main li, main a, footer p, footer a')) {
      if (!e.textContent.trim()) continue;
      let op = 1, n = e;
      while (n && n.nodeType === 1) { const cs = getComputedStyle(n); op *= +cs.opacity; if (cs.visibility === 'hidden' || cs.display === 'none') { op = 0; break; } n = n.parentElement; }
      if (op < 0.5 && !e.closest('.sr, .sr-only, [aria-hidden=true], noscript, [hidden]')) hidden.push(e.tagName + ' "' + e.textContent.trim().slice(0, 40) + '" opacity ' + op.toFixed(2));
    }
    return { hidden, h1: document.querySelector('h1')?.textContent?.trim(), ov: document.documentElement.scrollWidth - innerWidth, H: document.documentElement.scrollHeight };
  });
  if (!r.h1) F('P0', 'nojs', dn, 'no h1 without JS');
  if (r.hidden.length) F('P1', 'nojs', dn, `${r.hidden.length} text blocks invisible without JS: ${r.hidden.slice(0, 4).join('; ')}`);
  if (r.ov > 0) F('P1', 'nojs', dn, `horizontal overflow ${r.ov}px without JS`);
  const files = [];
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    await page.evaluate((p) => scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)), p);
    const png = await shot(page);
    const f = path.join(OUT, 'nojs', `${dn}-${p}.webp`); await saveWebp(png, f, { width: 390 }); files.push(f);
    const s = await stats(png);
    if (s.mean > 0.5) F('P0', 'nojs', dn, `p=${p}: white page without JS (body background?)`, f);
  }
  await contactSheet(files, path.join(SHOTS, `nojs-${dn}.webp`), 5, 200);
  I('nojs', dn, `h1 "${r.h1}", height ${r.H}, hidden ${r.hidden.length}`);
  await ctx.close();
}

// ---------------------------------------------------------------- no WebGL: a designed still, no errors
async function nowebgl(device) {
  const dn = devName(device);
  const b = await browser({ webgl: false });
  const { ctx, page, log, kind } = await open(device, { b });
  const files = [];
  for (const p of [0, 0.5, 1]) {
    await page.evaluate((p) => scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)), p); await sleep(500);
    const png = await shot(page); const f = path.join(OUT, 'nowebgl', `${dn}-${p}.webp`); await saveWebp(png, f, { width: 390 }); files.push(f);
    const s = await stats(png);
    if (s.mean > 0.5) F('P0', 'nowebgl', dn, `p=${p}: white page without WebGL`, f);
    if (p === 0 && s.grad < 0.0006) F('P1', 'nowebgl', dn, 'hero is a flat colour without WebGL (no designed still)', f);
  }
  const errs = log.errors.filter((e) => !benignError(e));
  if (errs.length) F('P1', 'nowebgl', dn, `errors without WebGL: ${errs.slice(0, 3).join(' || ')}`);
  I('nowebgl', dn, `hooks ${kind}, ${errs.length} errors`);
  await ctx.close(); await b.close();
}

// ---------------------------------------------------------------- artifact frame: dist inside the claude.ai frame head (+ sandboxed iframe)
async function frame(device) {
  const dn = devName(device);
  let tf;
  try { tf = await target('frame'); } catch (e) { I('frame', dn, 'skipped: ' + e.message); return; }
  for (const variant of ['frame.html', 'iframe.html']) {
    const ctx = await context(B, device, { dpr: 1 });
    const page = await ctx.newPage(); const log = watch(page);
    await page.goto(`${tf.url}/${variant}`, { waitUntil: 'load', timeout: 45000 });
    await page.mouse.move(100, 200); await sleep(6000);
    const png = await shot(page); const f = path.join(OUT, `frame-${variant.replace('.html', '')}-${dn}.webp`); await saveWebp(png, f, { width: 390 });
    const s = await stats(png);
    if (s.mean > 0.45) F('P0', 'frame', dn, `${variant}: page shows white inside the artifact frame (mean L ${s.mean.toFixed(2)})`, f);
    if (s.grad < 0.0006) F('P1', 'frame', dn, `${variant}: flat frame (world did not start?)`, f);
    const fr = variant === 'iframe.html' ? page.frames()[1] : page.mainFrame();
    const kind = fr ? await fr.evaluate(() => (window.__world ? 'world' : window.__state ? 'concept' : 'none')).catch((e) => 'err ' + e.message) : 'no frame';
    const errs = log.errors.filter((e) => !benignError(e));
    if (errs.length) F('P1', 'frame', dn, `${variant}: ${errs.slice(0, 3).join(' || ')}`);
    if (kind !== 'world' && kind !== 'concept') F('P0', 'frame', dn, `${variant}: the world did not start (${kind})`, f);
    I('frame', dn, `${variant}: hooks ${kind}, mean L ${s.mean.toFixed(3)}, ${errs.length} errors`);
    await ctx.close();
  }
  tf.close();
}

// ---------------------------------------------------------------- overflow at 360 / 390 / 1440 down the whole page
async function overflow() {
  for (const device of ['narrow', 'iphone', 'desktop']) {
    const { ctx, page } = await open(device);
    const H = await page.evaluate(() => document.documentElement.scrollHeight), vh = await page.evaluate(() => innerHeight);
    let worst = 0, at = 0, culprit = '';
    for (let y = 0; y < H; y += vh * 0.8) {
      await page.evaluate((y) => scrollTo(0, y), y); await sleep(60);
      const r = await page.evaluate(() => {
        const ov = document.documentElement.scrollWidth - innerWidth; if (ov <= 0) return { ov };
        let c = ''; for (const e of document.querySelectorAll('body *')) { const b = e.getBoundingClientRect(); if (b.right > innerWidth + 1 && b.width > 0) { c = e.tagName + '.' + [...e.classList].join('.') + ` right ${b.right.toFixed(0)}`; break; } }
        return { ov, c };
      });
      if (r.ov > worst) { worst = r.ov; at = y; culprit = r.c; }
    }
    if (worst > 0) F('P0', 'overflow', device, `horizontal overflow ${worst}px at scrollY ${at} (${culprit})`);
    else I('overflow', device, 'no horizontal overflow');
    await ctx.close();
  }
}

// ---------------------------------------------------------------- dead zones: never > 0.3 viewport of scroll with nothing to read or look at
async function dead(device) {
  const dn = devName(device);
  const { ctx, page, kind } = await open(device);
  if (kind !== 'none') await page.evaluate(() => window.__qa.hold());
  const vh = await page.evaluate(() => innerHeight);
  const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const stepY = Math.round(vh * 0.1);
  const empty = [];
  for (let y = 0; y <= maxY; y += stepY) {
    await page.evaluate((y) => { scrollTo(0, y); }, y);
    if (kind !== 'none') await settle(page, 4, 40);
    const n = await page.evaluate(() => {
      let n = 0; const H = innerHeight;
      for (const e of document.querySelectorAll('h1,h2,h3,p,li,figcaption,blockquote,[data-caption],a.btn,button')) {
        if (!e.textContent.trim() || e.closest('nav,header,[aria-hidden=true],.sr,.sr-only')) continue;
        const r = e.getBoundingClientRect(); if (r.bottom < H * 0.12 || r.top > H * 0.88 || r.width < 2) continue;
        let op = 1, x = e; while (x && x.nodeType === 1) { const cs = getComputedStyle(x); op *= +cs.opacity; if (cs.visibility === 'hidden' || cs.display === 'none') { op = 0; break; } x = x.parentElement; }
        if (op > 0.3) n++;
      }
      return n;
    });
    empty.push([y, n]);
  }
  // runs of text-free scroll; for each long run, judge the world frame mid-run
  const runs = []; let s = null;
  for (const [y, n] of empty) { if (n === 0) { if (s === null) s = y; } else if (s !== null) { runs.push([s, y]); s = null; } }
  if (s !== null) runs.push([s, maxY]);
  let deadN = 0;
  for (const [a, b] of runs) {
    const len = (b - a) / vh; if (len <= 0.3) continue;
    const mid = Math.round((a + b) / 2);
    await page.evaluate((y) => scrollTo(0, y), mid); if (kind !== 'none') await settle(page, 12, 40);
    const png = await shot(page); const st = await stats(png);
    const f = path.join(OUT, 'dead', `${dn}-${mid}.webp`); await saveWebp(png, f, { width: 390 });
    // a world frame with structure is something to look at; a near-flat dark frame is a dead screen
    const looks = st.grad > 0.004 || st.std > 0.04;
    if (!looks) { deadN++; F('P1', 'dead', dn, `${len.toFixed(2)} vh of scroll (y ${a}-${b}) with no text and a flat frame (grad ${st.grad.toFixed(4)}, std ${st.std.toFixed(3)})`, f); }
    else I('dead', dn, `${len.toFixed(2)} vh text-free at y ${a}-${b}, world carries it (grad ${st.grad.toFixed(4)}) -> ${path.relative(QA, f)}`);
  }
  I('dead', dn, `${runs.length} text-free runs, ${deadN} dead`);
  await ctx.close();
}

// ---------------------------------------------------------------- contrast: text over the rendered world, per glyph box
async function contrastCheck(device) {
  const dn = devName(device);
  const { ctx, page, kind } = await open(device);
  if (kind !== 'none') await page.evaluate(() => window.__qa.hold());
  const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const vh = await page.evaluate(() => innerHeight);
  const dpr = 1;
  const worst = [];
  for (let y = 0; y <= maxY; y += Math.round(vh * 0.5)) {
    await page.evaluate((y) => scrollTo(0, y), y);
    if (kind !== 'none') await settle(page, 16, 40);
    const fg = await shot(page);
    const boxes = await page.evaluate(() => {
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const el = t.parentElement; if (!el || !t.textContent.trim() || seen.has(el)) continue;
        if (el.closest('script,style,noscript,[aria-hidden=true],.sr,.sr-only,svg')) continue;
        seen.add(el);
        const cs = getComputedStyle(el);
        let op = 1, x = el; while (x && x.nodeType === 1) { const c = getComputedStyle(x); op *= +c.opacity; if (c.visibility === 'hidden' || c.display === 'none') { op = 0; break; } x = x.parentElement; }
        if (op < 0.2) continue;
        const r = document.createRange(); r.selectNodeContents(el);
        const rects = [...r.getClientRects()].filter((b) => b.width > 2 && b.height > 4 && b.bottom > 0 && b.top < innerHeight && b.left < innerWidth && b.right > 0);
        if (!rects.length) continue;
        const size = parseFloat(cs.fontSize), weight = +cs.fontWeight || 400;
        const m = cs.color.match(/[\d.]+/g).map(Number);
        out.push({ text: t.textContent.trim().slice(0, 50), tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40), color: m, op, large: size >= 24 || (size >= 18.66 && weight >= 700), size,
          rects: rects.map((b) => [b.left, b.top, b.width, b.height]) });
      }
      return out;
    });
    // background only: hide all text and form chrome; the world's frame is held so it does not change
    await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;text-decoration-color:transparent!important} *::placeholder{color:transparent!important}', }).then((h) => page.evaluate((e) => e.setAttribute('data-qa-hide', ''), h));
    const bg = await shot(page);
    await page.evaluate(() => document.querySelectorAll('style[data-qa-hide]').forEach((s) => s.remove()));
    const { data, w, h } = await raw(bg);
    for (const b of boxes) {
      const vals = [];
      const [r0, g0, b0, a0 = 1] = b.color; const alpha = a0 * b.op;
      for (const [x, yy, ww, hh] of b.rects) {
        const st = Math.max(1, Math.floor(Math.sqrt((ww * hh) / 400)));
        for (let py = Math.max(0, Math.floor(yy * dpr)); py < Math.min(h, (yy + hh) * dpr); py += st)
          for (let px = Math.max(0, Math.floor(x * dpr)); px < Math.min(w, (x + ww) * dpr); px += st) {
            const i = (py * w + px) * 3;
            const R = data[i], G = data[i + 1], Bc = data[i + 2];
            const tr = Math.round(alpha * r0 + (1 - alpha) * R), tgc = Math.round(alpha * g0 + (1 - alpha) * G), tb = Math.round(alpha * b0 + (1 - alpha) * Bc);
            vals.push(contrast(relLum(tr, tgc, tb), relLum(R, G, Bc)));
          }
      }
      if (!vals.length) continue;
      vals.sort((a, b) => a - b);
      const p10 = vals[Math.floor(vals.length * 0.1)], min = vals[0];
      const need = b.large ? 3 : 4.5;
      if (p10 < need) worst.push({ y, ...b, p10, min, need });
    }
    if (worst.some((x) => x.y === y)) {
      // overlay the failing boxes for the report
      const fails = worst.filter((x) => x.y === y);
      const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${fails.flatMap((x) => x.rects.map(([a, b2, c, d]) => `<rect x="${a}" y="${b2}" width="${c}" height="${d}" fill="none" stroke="#0ff" stroke-width="2"/>`)).join('')}</svg>`;
      const f = path.join(OUT, 'contrast', `${dn}-y${y}.webp`); fs.mkdirSync(path.dirname(f), { recursive: true });
      await sharp(fg).composite([{ input: Buffer.from(svg) }]).resize({ width: Math.min(w, 720) }).webp({ quality: 70 }).toFile(f);
      for (const x of fails) x.frame = f;
    }
  }
  // dedupe by text
  const by = new Map(); for (const x of worst) { const k = x.text; if (!by.has(k) || by.get(k).p10 > x.p10) by.set(k, x); }
  for (const x of [...by.values()].sort((a, b) => a.p10 - b.p10).slice(0, 25))
    F(x.p10 < x.need * 0.66 ? 'P1' : 'P2', 'contrast', dn, `"${x.text}" <${x.tag}${x.cls ? ' .' + x.cls.split(' ')[0] : ''}> ${x.size}px: contrast p10 ${x.p10.toFixed(2)} (min ${x.min.toFixed(2)}) < ${x.need} at scrollY ${x.y}`, x.frame);
  I('contrast', dn, `${by.size} text blocks below AA somewhere`);
  await ctx.close();
}

// ---------------------------------------------------------------- perf proxy: SwiftShader ms per quality step -> iPhone estimate
async function calibrate() {
  // SwiftShader's arithmetic rate on this machine: a full-screen pass of a known number of FMAs per pixel
  const ctx = await context(B, 'desktop'); const page = await ctx.newPage();
  await page.setContent('<canvas width=512 height=512></canvas>');
  const r = await page.evaluate(async () => {
    const gl = document.querySelector('canvas').getContext('webgl2', { antialias: false });
    const vs = '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}';
    const fs = (n) => `#version 300 es\nprecision highp float;uniform float u;out vec4 o;void main(){vec4 a=vec4(gl_FragCoord.xy*1e-3,u,1.);vec4 b=vec4(1.0001,.9999,1.0002,.9998);for(int i=0;i<${n};i++){a=a*b+vec4(1e-4);}o=a;}`;
    const prog = (n) => { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs(n)]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); gl.attachShader(p, sh); } gl.linkProgram(p); return p; };
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const px = new Uint8Array(4);
    const time = (n) => { const p = prog(n); gl.useProgram(p); const l = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now(); for (let k = 0; k < 3; k++) { gl.uniform1f(gl.getUniformLocation(p, 'u'), k); gl.drawArrays(gl.TRIANGLES, 0, 3); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / 3; };
    const t1 = time(64), t2 = time(1024);
    const flops = 512 * 512 * (1024 - 64) * 8; // vec4 FMA = 8 flops
    return { ms64: t1, ms1024: t2, gflops: flops / ((t2 - t1) / 1000) / 1e9, renderer: gl.getParameter(gl.RENDERER) };
  });
  await ctx.close();
  return r;
}
async function perf() {
  const cal = await calibrate();
  // A16 (iPhone 15) GPU: ~1.8 TFLOPS fp32 peak; assume shaders reach ~45% of peak there as SwiftShader reaches its own
  // (a rough proxy: ±2x; real devices also pay bandwidth and thermal throttling, so budget 10 ms of a 16.7 ms frame).
  const IPHONE_GFLOPS = 1790;
  I('perf', 'calib', `SwiftShader ~${cal.gflops.toFixed(1)} GFLOPS (${cal.renderer}); iPhone 15 GPU ≈ ${(IPHONE_GFLOPS / cal.gflops).toFixed(0)}x faster on ALU`);
  const rows = [];
  for (const device of DEVS) {
    const dn = devName(device);
    for (const q of (A.qs || '0,1,2,3,4,5,full').split(',')) {
      const u = q === 'full' ? withQ(URL0, 'world=full&liquid=full') : withQ(URL0, `q=${q}`);
      // real pixel count of the device (dpr 3 on iPhone), so the canvas is the size the phone would draw
      const { ctx, page, kind } = await open(device, { url: u, dpr: device === 'desktop' ? 1 : 3 });
      if (kind === 'none') { await ctx.close(); break; }
      const res = [];
      for (const p of [0, 0.33, 0.66]) {
        await page.evaluate((p) => { window.__qa.hold(); window.__qa.go(p); }, p);
        await settle(page, 6, 40);
        const r = await page.evaluate(async () => {
          // time held-clock steps; each step renders one frame; a readback-free sync: wait for 2 rAFs after
          const ts = [];
          for (let i = 0; i < 8; i++) {
            const t0 = performance.now(); window.__qa.step(16.7);
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            ts.push(performance.now() - t0);
          }
          ts.sort((a, b) => a - b);
          const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
          return { med: ts[4], p90: ts[7], cw: cv?.width, ch: cv?.height, st: JSON.stringify(window.__qa.state()).slice(0, 100) };
        });
        res.push({ p, ...r });
      }
      // subtract the idle cost of two rAFs (~33 ms at 60 Hz in headless) measured on an empty page
      const med = res.map((r) => r.med).sort((a, b) => a - b)[1];
      const est = Math.max(0, med - 33) / (IPHONE_GFLOPS / cal.gflops);
      rows.push({ dn, q, med, est, cw: res[0].cw, ch: res[0].ch });
      I('perf', dn, `q=${q}: SwiftShader ${med.toFixed(0)} ms/frame (canvas ${res[0].cw}x${res[0].ch}) -> iPhone 15 est ~${est.toFixed(1)} ms`);
      await ctx.close();
    }
  }
  const ip = rows.filter((r) => r.dn === 'iphone');
  if (ip.length && Math.min(...ip.map((r) => r.est)) > 10) F('P1', 'perf', 'iphone', `even the lowest step estimates ${Math.min(...ip.map((r) => r.est)).toFixed(1)} ms on an iPhone 15 GPU (> 10 ms budget)`);
  const top = ip.find((r) => r.q === '0');
  if (top && top.est > 14) F('P2', 'perf', 'iphone', `the top step (q=0) estimates ${top.est.toFixed(1)} ms on iPhone 15: it will step down on a real phone`);
  fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify({ cal, rows }, null, 1));
}

// ---------------------------------------------------------------- memory: no growth across three loops
async function memory() {
  const { ctx, page, kind } = await open('desktop');
  if (kind === 'none') { await ctx.close(); return; }
  const c = await cdp(page); await c.send('Performance.enable');
  const sample = async () => {
    await c.send('HeapProfiler.collectGarbage');
    const m = Object.fromEntries((await c.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    const extra = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, workers: performance.getEntriesByType('resource').filter((r) => /worker|blob:/.test(r.name)).length }));
    return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, docs: m.Documents, ...extra };
  };
  const samples = [await sample()];
  await page.evaluate(() => window.__qa.hold());
  for (let L = 1; L <= 3; L++) {
    for (let i = 0; i <= 40; i++) { await page.evaluate((p) => { window.__qa.go(p); window.__qa.step(33); window.__qa.step(33); }, (L - 1) + i / 40 > L - 1 ? (i / 40) % 1 : 0); }
    // also cross the wrap by real scrolling, if the world loops on scroll
    await page.evaluate(() => window.__qa.resume());
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(400);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 300); await sleep(80); }
    await sleep(500); await page.evaluate(() => window.__qa.hold());
    samples.push(await sample());
  }
  I('memory', 'desktop', samples.map((s, i) => `L${i}: ${s.heapMB} MB, ${s.nodes} nodes, ${s.listeners} listeners, ${s.canvases} canvases`).join(' · '));
  const [, a, , c3] = samples;
  if (c3.heapMB > a.heapMB * 1.2 + 3) F('P1', 'memory', 'desktop', `JS heap grows across loops: ${a.heapMB} -> ${c3.heapMB} MB`);
  if (c3.nodes > a.nodes * 1.1 + 50) F('P1', 'memory', 'desktop', `DOM nodes grow across loops: ${a.nodes} -> ${c3.nodes}`);
  if (c3.listeners > a.listeners * 1.1 + 20) F('P1', 'memory', 'desktop', `event listeners grow across loops: ${a.listeners} -> ${c3.listeners}`);
  if (c3.canvases > a.canvases) F('P1', 'memory', 'desktop', `canvases grow across loops: ${a.canvases} -> ${c3.canvases}`);
  await ctx.close();
}

// ---------------------------------------------------------------- run
const t0 = Date.now();
const per = { walk, film, loop, touch, rm, nojs, nowebgl, frame, dead, contrast: contrastCheck };
const once = { overflow, perf, memory };
for (const ch of CHECKS) {
  if (ch === 'keys') continue; // part of loop
  try {
    if (per[ch]) for (const d of DEVS) { console.log(`-- ${ch} ${devName(d)}`); await per[ch](d); }
    else if (once[ch]) { console.log(`-- ${ch}`); await once[ch](); }
  } catch (e) { F('P1', ch, '-', 'harness error: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); }
}
await B.close(); tg.close();
const order = { P0: 0, P1: 1, P2: 2 };
findings.sort((a, b) => order[a.sev] - order[b.sev]);
const md = [`# QA ${TAG} — ${new Date().toISOString().slice(0, 16)}Z (${((Date.now() - t0) / 60000).toFixed(1)} min)`, '', `target ${A.target}, checks ${[...CHECKS].join(',')}`, '', '## Findings', '',
  ...(findings.length ? findings.map((f) => `- **${f.sev}** ${f.check} [${f.device}] ${f.msg}${f.frame ? ` — \`${f.frame}\`` : ''}`) : ['- none']), '', '## Notes', '', ...info.map((i) => `- ${i.check} [${i.device}] ${i.msg}`)];
fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n'));
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ findings, info }, null, 1));
console.log(`\nreport: ${path.relative(process.cwd(), path.join(OUT, 'report.md'))} — ${findings.filter((f) => f.sev === 'P0').length} P0, ${findings.filter((f) => f.sev === 'P1').length} P1, ${findings.filter((f) => f.sev === 'P2').length} P2`);
