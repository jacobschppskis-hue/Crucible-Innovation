// Frame-accurate videos, smooth even on a machine that renders a few frames a second:
//  - intro: pauses every CSS animation and seeks it to each frame's time.
//  - story: runs the page's requestAnimationFrame/performance.now on a virtual clock and scrolls the home story the way
//    a person does with a mouse wheel: in uneven jumps with pauses (--input smooth for a steady scroll instead).
//
//   node overnight/tools/film.mjs intro <path> <out.mp4> [--phone] [--tier light|rich] [--ms 4800] [--fps 30]
//   node overnight/tools/film.mjs story <path> <out.mp4> [--phone] [--tier light|rich] [--ms 9000] [--input jerky|smooth]
//
// Needs `npx serve out -l 4173` and ffmpeg.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const a = process.argv.slice(2);
const opt = (n, d) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : d);
const [mode, path, out] = a;
const phone = a.includes('--phone');
const fps = Number(opt('fps', 30));
const ms = Number(opt('ms', mode === 'intro' ? 4800 : 9000));
const tier = opt('tier', 'light');
const viewport = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const tmp = `${out}.frames`;
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(dirname(out), { recursive: true });

const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
// A virtual clock for rAF and performance.now, switched on with __manual() and advanced with __tick(ms).
await ctx.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  const cancel = window.cancelAnimationFrame.bind(window);
  const now = performance.now.bind(performance);
  const q = new Map();
  let manual = false;
  let vt = 0;
  let id = 1e7;
  window.requestAnimationFrame = (cb) => {
    if (!manual) return raf(cb);
    q.set(++id, cb);
    return id;
  };
  window.cancelAnimationFrame = (i) => (q.has(i) ? q.delete(i) : cancel(i));
  performance.now = () => (manual ? vt : now());
  window.__manual = () => {
    manual = true;
    vt = now();
  };
  window.__tick = (ms) => {
    vt += ms;
    const cbs = [...q.values()];
    q.clear();
    for (const cb of cbs) cb(vt);
  };
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', String(e)));
await page.goto(`http://localhost:4173${path}${path.includes('?') ? '&' : '?'}tier=${tier}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const frames = Math.round((ms / 1000) * fps);
const shot = (i) => page.screenshot({ path: join(tmp, `f${String(i).padStart(4, '0')}.png`) });

if (mode === 'intro') {
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => document.getAnimations().forEach((an) => (an.pause(), (an.currentTime = t))), (i * 1000) / fps);
    await shot(i);
  }
} else {
  if (tier === 'rich') await page.waitForSelector('section.ig[data-gl]', { timeout: 30000 });
  await page.waitForTimeout(5500); // the pour is done
  const { top, len } = await page.evaluate(() => {
    const el = document.querySelector('section.ig');
    return { top: el.getBoundingClientRect().top + scrollY, len: el.offsetHeight - innerHeight };
  });
  // The scroll position over time: either a steady scroll, or wheel-like jumps of uneven size with uneven pauses.
  const end = ms - 1800;
  const steps = [];
  if (opt('input', 'jerky') === 'jerky') {
    let t = 300;
    let y = 0;
    let k = 0;
    while (y < len) {
      const jump = len * [0.05, 0.11, 0.03, 0.08, 0.14, 0.04, 0.06][k % 7];
      steps.push([t, (y = Math.min(len, y + jump))]);
      t += [90, 420, 60, 700, 140, 260, 1100][k % 7] * (end / 9000);
      k++;
    }
  }
  const raw = (t) => {
    if (!steps.length) return len * Math.min(1, Math.max(0, (t - 300) / (end - 300)));
    let y = 0;
    for (const [at, to] of steps) if (t >= at) y = to;
    return y;
  };
  await page.evaluate(() => window.__manual());
  for (let i = 0; i < frames; i++) {
    const t = (i * 1000) / fps;
    await page.evaluate((y) => {
      if (Math.abs(scrollY - y) > 0.5) {
        scrollTo(0, y);
        dispatchEvent(new Event('scroll'));
      }
    }, top + raw(t));
    await page.evaluate((dt) => window.__tick(dt), 1000 / fps);
    await shot(i);
  }
}
await browser.close();
const scale = phone ? 'scale=540:-2' : 'scale=1280:-2';
execSync(`ffmpeg -y -loglevel error -framerate ${fps} -i ${join(tmp, 'f%04d.png')} -vf "${scale}:flags=lanczos" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags faststart ${out}`);
rmSync(tmp, { recursive: true, force: true });
console.log(`${out}: ${(Number(execSync(`stat -c %s ${out}`)) / 1e6).toFixed(1)} MB`);
