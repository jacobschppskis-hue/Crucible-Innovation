// Stills of the home scroll story at given progress points (after the smoothing settles).
//   node overnight/tools/story.mjs <outdir> [--tier rich|light] [--phone] [--at 0,0.1,0.2]
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const a = process.argv.slice(2);
const opt = (n, d) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : d);
const out = a[0];
const phone = a.includes('--phone');
const at = opt('at', '0,0.06,0.1,0.13,0.16,0.25,0.35,0.5,0.6,0.7,0.76,0.8,0.84,0.9,1').split(',').map(Number);
mkdirSync(out, { recursive: true });
const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const b = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror:', String(e)));
p.on('console', (m) => m.type() === 'warning' && console.log('warn:', m.text()));
const tier = opt('tier', 'light');
await p.goto(`http://localhost:4173/?tier=${tier}`, { waitUntil: 'load' });
if (tier === 'rich') await p.waitForSelector('section.ig[data-gl]', { timeout: 20000 });
else await p.waitForTimeout(5000);
const [top, len] = await p.evaluate(() => {
  const el = document.querySelector('section.ig');
  return [el.getBoundingClientRect().top + scrollY, el.offsetHeight - innerHeight];
});
for (const t of at) {
  await p.evaluate((y) => scrollTo(0, y), top + t * len);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${out}/p${String(Math.round(t * 100)).padStart(3, '0')}.png` });
}
await b.close();
execSync(`montage -label '%f' ${out}/p*.png -tile 5x -geometry 480x300+3+3 -background '#222' -fill white ${out}/sheet.png`);
console.log('ok');
