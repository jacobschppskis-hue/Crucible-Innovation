#!/usr/bin/env node
// npm run world:smoke  — the fast check everyone runs before pushing (< 2 min, builds nothing).
//   --target=out (default: the Next export in out/) | dist (world/dist/crucible.html) | frame (dist inside the artifact
//   frame head) | airless | continuum | http://localhost:3000 (dev server)
//   --only=iphone|desktop   --shots (save frames to lab/qa/out/smoke)   --allow-no-world (pre-skeleton pages)
// Checks, at iPhone 15 and 1440x900: the page loads with no console/page errors, the h1 paints without waiting on
// WebGL, the world starts, frames at five places along the journey are neither black nor white, the page never
// scrolls sideways (also at 360 px), and the loop's two ends look the same.
import { domRules } from '../lab/qa/rules.mjs';
import { args, target, browser, context, watch, benignError, waitWorld, settle, shot, stats, diff, saveWebp, QA, path } from '../lab/qa/lib.mjs';

const A = args({ target: 'out', only: '' });
const t0 = Date.now();
const fails = [], warns = [], notes = [];
const fail = (d, m) => fails.push(`[${d}] ${m}`);
const warn = (d, m) => warns.push(`[${d}] ${m}`);

const tg = await target(A.target);
const b = await browser();
const PLACES = [0, 0.2, 0.45, 0.7, 0.95];

async function run(device) {
  const ctx = await context(b, device, { dpr: 1 });
  const page = await ctx.newPage();
  const log = watch(page);
  const url = tg.url + tg.path + (tg.path.includes('?') ? '&' : '?') + 'smoke';
  const res = await page.goto(tg.url + tg.path, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => fail(device, 'goto: ' + e.message));
  if (res && res.status() >= 400) fail(device, `HTTP ${res.status()}`);
  // the headline paints without WebGL: an h1 with text, visible, at DOMContentLoaded + 1.5 s
  const h1 = await page.waitForFunction(() => {
    const h = document.querySelector('h1');
    if (!h) return null;
    const r = h.getBoundingClientRect(), cs = getComputedStyle(h);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.05 ? h.textContent.trim().slice(0, 60) : null;
  }, null, { timeout: 4000 }).then((h) => h.jsonValue()).catch(() => null);
  if (!h1) fail(device, 'no visible h1 within 4 s of DOMContentLoaded');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => warn(device, 'load event > 20 s'));
  const kind = await waitWorld(page, 15000);
  notes.push(`[${device}] h1 "${h1}" · hooks: ${kind}`);
  if (kind.startsWith('fail')) fail(device, `the world failed to start: ${kind.slice(6).slice(0, 300)} (html[data-world-fail]; a module that does not compile?)`);
  const wf = await page.evaluate(() => document.documentElement.dataset.worldFail).catch(() => undefined);
  if (wf !== undefined && !kind.startsWith('fail')) fail(device, `html[data-world-fail] is set: ${String(wf).slice(0, 300)}`);
  if (kind === 'none' && !A['allow-no-world'] && !['airless', 'continuum'].includes(A.target)) fail(device, 'the world never started (no window.__world within 15 s of load + first use)');
  // body must set its own background/colour (the artifact frame sets white/black)
  const body = await page.evaluate(() => { const cs = getComputedStyle(document.body); return { bg: cs.backgroundColor, color: cs.color }; });
  if (/rgb\(255, 255, 255\)/.test(body.bg)) fail(device, `body background is white (${body.bg}): set body{background:transparent}`);
  if (/rgb\(0, 0, 0\)\b/.test(body.color) && !/rgba\(0, 0, 0, 0\)/.test(body.color)) fail(device, `body colour is black (${body.color})`);

  // Jacob's copy/brand rules: P0s fail the smoke, the rest are warnings (the deep harness reports them all)
  const home = ['out', 'dist', 'frame'].includes(A.target) || /\/$/.test(tg.path);
  for (const r of await page.evaluate(domRules, { home })) (r.sev === 'P0' ? fail : warn)(device, `${r.rule}: ${r.text}`);
  if (kind === 'world' || kind === 'concept') await page.evaluate(() => window.__qa.hold());
  const frames = {};
  for (const p of PLACES) {
    if (kind === 'world' || kind === 'concept') { await page.evaluate((p) => window.__qa.go(p), p); await settle(page, 18, 40); }
    else { await page.evaluate((p) => scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)), p); await page.waitForTimeout(300); }
    const png = await shot(page);
    frames[p] = png;
    const s = await stats(png);
    if (s.mean < 0.0015 && s.grad < 0.0005) fail(device, `p=${p}: frame is black (mean L ${s.mean.toFixed(4)})`);
    if (s.mean > 0.6) fail(device, `p=${p}: frame is mostly white (mean L ${s.mean.toFixed(2)}): artifact frame / body background?`);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ov > 0) fail(device, `p=${p}: horizontal overflow ${ov}px`);
    if (A.shots) await saveWebp(png, path.join(QA, 'out/smoke', `${A.target}-${device}-${String(p * 100).padStart(2, '0')}.webp`), { width: 600 });
  }
  // the loop seam, at a fixed scene clock (?t): crossing the seam (1-e -> e) must change the frame no more than the
  // same scroll distance inside the page does (e -> 3e)
  if (kind === 'world') {
    const st = await page.evaluate(() => window.__qa.state());
    notes.push(`[${device}] state ${JSON.stringify(st).slice(0, 160)}`);
    await page.goto(tg.url + tg.path + (tg.path.includes('?') ? '&' : '?') + 't=8', { waitUntil: 'load' });
    await waitWorld(page, 15000); await page.evaluate(() => window.__qa.hold());
    const at = async (p) => { await page.evaluate((p) => window.__qa.go(p), p); await settle(page, 24, 40); return shot(page); };
    const e = 0.0001;
    const a0 = await at(1 - 3 * e), a = await at(1 - e), b2 = await at(e), c = await at(3 * e);
    const seam = await diff(a, b2), r1 = await diff(b2, c), r2 = await diff(a0, a);
    const ref = { mad: Math.max(r1.mad, r2.mad) };
    if (seam.mad > ref.mad * 2 + 1) fail(device, `loop seam: crossing it changes the frame by ${seam.mad.toFixed(2)} vs ${ref.mad.toFixed(2)} for the same scroll inside the page`);
    else notes.push(`[${device}] loop seam ok (Δ ${seam.mad.toFixed(2)} vs in-page ${ref.mad.toFixed(2)})`);
  }
  const errs = log.errors.filter((e) => !benignError(e));
  for (const e of errs.slice(0, 8)) fail(device, e);
  for (const f of log.failed.slice(0, 5)) fail(device, 'request failed: ' + f);
  await ctx.close();
}

async function narrow() {
  const ctx = await context(b, 'narrow', { dpr: 1 });
  const page = await ctx.newPage();
  await page.goto(tg.url + tg.path, { waitUntil: 'load', timeout: 30000 });
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  let worst = 0;
  for (let y = 0; y < H; y += 780) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(40);
    worst = Math.max(worst, await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  }
  if (worst > 0) fail('360', `horizontal overflow ${worst}px at 360 px wide`);
  await ctx.close();
}

const want = A.only ? [A.only] : ['iphone', 'desktop'];
await Promise.all([...want.map(run), narrow()]);
await b.close(); tg.close();

const secs = ((Date.now() - t0) / 1000).toFixed(0);
for (const n of notes) console.log('  ' + n);
for (const w of warns) console.log('WARN ' + w);
for (const f of fails) console.log('FAIL ' + f);
console.log(fails.length ? `world:smoke FAILED (${fails.length}) in ${secs}s` : `world:smoke ok in ${secs}s (${A.target})`);
process.exit(fails.length ? 1 : 0);
