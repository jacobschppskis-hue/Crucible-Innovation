// Records what a visitor sees, so animations can be judged frame by frame.
//
//   node overnight/tools/capture.mjs <path> [--phone] [--ms 4000] [--scroll 2400] [--out dir] [--tier rich|light]
//     [--reduced] [--video] [--fps 10] [--slow 0.25] [--every 4]
//
// --slow plays CSS animations at that rate (Chrome DevTools protocol) so a fast intro can be studied frame by frame.
//
// Serves nothing itself: start `npx serve out -l 4173` first. Always records the real-time video and writes frames of
// the opening (v###.png at --fps) with a contact sheet (sheet.png), plus stills taken while scrolling (s###.png,
// scroll.png). With --video it also writes an .mp4 and a .gif. Needs ffmpeg and ImageMagick.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const path = args.find((a) => a.startsWith('/')) ?? '/';
const phone = flag('phone');
const ms = Number(opt('ms', 4000));
const scroll = Number(opt('scroll', 0));
const fps = Number(opt('fps', 10));
const out = opt('out', `overnight/capture/${phone ? 'phone' : 'desktop'}${path.replace(/\W+/g, '-')}`);
const tier = opt('tier', '');
const base = opt('base', 'http://localhost:4173');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const viewport = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
// Cloud sessions ship a newer Chromium than the pinned Playwright expects.
const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({
  viewport,
  deviceScaleFactor: phone ? 2 : 1,
  isMobile: phone,
  hasTouch: phone,
  reducedMotion: flag('reduced') ? 'reduce' : 'no-preference',
  recordVideo: { dir: out, size: viewport },
});
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()));
page.on('pageerror', (e) => console.log('page error:', String(e)));
if (opt('slow')) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: Number(opt('slow')) });
}
const url = `${base}${path}${tier ? `${path.includes('?') ? '&' : '?'}tier=${tier}` : ''}`;
await page.goto(url, { waitUntil: 'commit' });

let n = 0;
const shot = async () => page.screenshot({ path: join(out, `s${String(n++).padStart(3, '0')}.png`) });
// The opening is judged from the real-time video (screenshots are too slow to catch animation); just wait it out.
await page.waitForTimeout(ms);
if (scroll) {
  // Wheel-like scroll in small steps, a still after every few.
  const steps = Math.ceil(scroll / 60);
  for (let i = 0; i < steps; i++) {
    if (phone) await page.evaluate(() => scrollBy(0, 60));
    else await page.mouse.wheel(0, 60);
    await page.waitForTimeout(60);
    if (i % Number(opt('every', 4)) === 0) await shot();
  }
  await page.waitForTimeout(600);
  await shot();
}
const tierUsed = await page.evaluate(() => document.documentElement.dataset.tier ?? '(none)');
console.log(`${n} scroll stills → ${out} (tier: ${tierUsed})`);
await ctx.close();
await browser.close();

const webm = readdirSync(out).find((f) => f.endsWith('.webm'));
if (webm) {
  renameSync(join(out, webm), join(out, 'video.webm'));
  const sh = (cmd) => {
    try {
      execSync(cmd, { stdio: 'pipe' });
    } catch (e) {
      console.log('failed:', cmd.slice(0, 60), String(e.stderr ?? e.message).split('\n')[0]);
    }
  };
  // Frames of the opening at --fps, and a contact sheet of them.
  sh(`ffmpeg -y -loglevel error -i ${join(out, 'video.webm')} -t ${ms / 1000} -vf fps=${fps} ${join(out, 'v%03d.png')}`);
  const frames = readdirSync(out).filter((f) => /^v\d+\.png$/.test(f)).sort();
  if (frames.length) sh(`montage ${frames.map((f) => join(out, f)).join(' ')} -tile 6x -geometry ${phone ? '195x422' : '360x225'}+4+4 -background '#222' ${join(out, 'sheet.png')}`);
  const stills = readdirSync(out).filter((f) => /^s\d+\.png$/.test(f)).sort();
  if (stills.length) sh(`montage ${stills.map((f) => join(out, f)).join(' ')} -tile 6x -geometry ${phone ? '195x422' : '360x225'}+4+4 -background '#222' ${join(out, 'scroll.png')}`);
  if (flag('video')) {
    sh(`ffmpeg -y -loglevel error -i ${join(out, 'video.webm')} -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${join(out, 'video.mp4')}`);
    const w = phone ? 300 : 720;
    sh(`ffmpeg -y -loglevel error -i ${join(out, 'video.webm')} -vf "fps=15,scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" ${join(out, 'video.gif')}`);
  }
}
