// Smooth GIFs/MP4s for the PR, even on a machine without a GPU:
//  - intro: records the page with CSS animations slowed down (DevTools protocol), then re-times it to real speed.
//  - scroll: steps through scroll positions and takes one frame per step, so every frame is fully rendered.
//
//   node overnight/tools/record.mjs intro  <path> <out-name> [--phone] [--ms 3600] [--tier rich|light] [--width 720]
//   node overnight/tools/record.mjs scroll <path> <out-name> [--phone] [--from 0] [--to 1] [--frames 60] [--el selector]
//
// Writes overnight/media/<out-name>.gif and .mp4. Needs `npx serve out -l 4173`, ffmpeg.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const a = process.argv.slice(2);
const opt = (n, d) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : d);
const [mode, path, name] = a;
const phone = a.includes('--phone');
const viewport = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const width = Number(opt('width', phone ? 300 : 600));
const tier = opt('tier', 'light');
const media = 'overnight/media';
const tmp = join(media, `.tmp-${name}`);
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const slow = Number(opt('slow', 0.2));
const ctx = await browser.newContext({
  viewport,
  deviceScaleFactor: phone ? 2 : 1,
  isMobile: phone,
  hasTouch: phone,
  ...(mode === 'intro' ? { recordVideo: { dir: tmp, size: viewport } } : {}),
});
const page = await ctx.newPage();
const url = `http://localhost:4173${path}${path.includes('?') ? '&' : '?'}tier=${tier}`;
const sh = (cmd) => execSync(cmd, { stdio: 'pipe' });
const gif = (input, out, fps) =>
  sh(`ffmpeg -y -loglevel error ${input} -vf "fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" ${out}`);

if (mode === 'intro') {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: slow });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForTimeout(Number(opt('ms', 3600)) / slow);
  const lead = (Date.now() - t0) / 1000;
  await ctx.close();
  const webm = join(tmp, readdirSync(tmp).find((f) => f.endsWith('.webm')));
  // Trim the blank start (before first paint), then speed back up to real time.
  const skip = Number(opt('skip', 0.6)) / slow > lead ? 0 : Number(opt('skip', 0.6));
  const retimed = join(tmp, 'retimed.mp4');
  sh(`ffmpeg -y -loglevel error -ss ${skip} -i ${webm} -vf "setpts=${slow}*PTS,fps=30" -an -pix_fmt yuv420p ${retimed}`);
  sh(`ffmpeg -y -loglevel error -i ${retimed} -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${join(media, `${name}.mp4`)}`);
  gif(`-i ${retimed}`, join(media, `${name}.gif`), 12);
} else {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // intro done
  const sel = opt('el', 'main > section');
  const box = await page.evaluate((s) => {
    const el = document.querySelector(s);
    const r = el.getBoundingClientRect();
    return { top: r.top + scrollY, height: r.height };
  }, sel);
  const from = Number(opt('from', 0));
  const to = Number(opt('to', 1));
  const frames = Number(opt('frames', 60));
  const range = box.height - viewport.height;
  for (let i = 0; i < frames; i++) {
    const f = from + ((to - from) * i) / (frames - 1);
    await page.evaluate((y) => scrollTo(0, y), box.top + range * f);
    await page.waitForTimeout(140);
    await page.screenshot({ path: join(tmp, `f${String(i).padStart(3, '0')}.png`) });
  }
  await ctx.close();
  const input = `-framerate 15 -i ${join(tmp, 'f%03d.png')}`;
  sh(`ffmpeg -y -loglevel error ${input} -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${join(media, `${name}.mp4`)}`);
  gif(input, join(media, `${name}.gif`), 12);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
const size = (f) => (Number(execSync(`stat -c %s ${f}`)) / 1e6).toFixed(1);
console.log(`${name}: gif ${size(join(media, `${name}.gif`))} MB, mp4 ${size(join(media, `${name}.mp4`))} MB`);
