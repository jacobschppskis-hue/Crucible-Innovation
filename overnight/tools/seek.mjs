// Stills of the intro at exact times: pauses every animation and seeks it, so nothing depends on render speed.
//   node overnight/tools/seek.mjs <path> <outdir> [--phone] [--size 360x640] [--tier light|rich] [--times 0,200,400] [--clip ring]
// Writes <outdir>/t<ms>.png and a labelled contact sheet <outdir>/sheet.png (ImageMagick). Needs `npx serve out -l 4173`.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const a = process.argv.slice(2);
const opt = (n, d) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : d);
const [path, out] = a;
const phone = a.includes('--phone');
const times = opt('times', '0,150,300,450,600,750,900,1050,1200,1350,1500,1650,1800,1950,2100,2250,2400,2550,2700,2850,3000,3150,3300,3450,3600,3750,3900,4050,4200,4500')
  .split(',')
  .map(Number);
mkdirSync(out, { recursive: true });
const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const b = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const [vw, vh] = (opt('size') ?? (phone ? '390x844' : '1280x800')).split('x').map(Number);
const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: phone ? 2 : 1 });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror:', String(e)));
await p.goto(`http://localhost:4173${path}${path.includes('?') ? '&' : '?'}tier=${opt('tier', 'light')}`, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
const clip = opt('clip') === 'ring' ? await p.evaluate(() => {
  const r = document.querySelector('.ig-ring').getBoundingClientRect();
  const pad = r.width * 0.45;
  return { x: Math.max(0, r.left - pad), y: 0, width: Math.min(innerWidth, r.width + pad * 2), height: Math.min(innerHeight, r.bottom + pad * 0.4) };
}) : undefined;
for (const t of times) {
  await p.evaluate((t) => document.getAnimations().forEach((an) => { an.pause(); an.currentTime = t; }), t);
  await p.waitForTimeout(60);
  await p.screenshot({ path: `${out}/t${String(t).padStart(5, '0')}.png`, clip });
}
await b.close();
const files = times.map((t) => `-label ${t}ms ${out}/t${String(t).padStart(5, '0')}.png`).join(' ');
execSync(`montage ${files} -tile 6x -geometry +4+4 -background '#222' -fill white -pointsize 14 ${out}/sheet.png`);
console.log('ok', out);
