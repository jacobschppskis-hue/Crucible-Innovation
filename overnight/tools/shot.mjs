// Screenshot after the intro has settled: node overnight/tools/shot.mjs <path> <w> <h> <out.png> [--scroll px] [--wait ms] [--tier t] [--reduced] [--nojs]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const a = process.argv.slice(2);
const opt = (n) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : undefined);
const [path, w, h, out] = a;
const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const b = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const ctx = await b.newContext({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: +w < 800 ? 2 : 1,
  reducedMotion: a.includes('--reduced') ? 'reduce' : 'no-preference',
  javaScriptEnabled: !a.includes('--nojs'),
});
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror:', String(e)));
const tier = opt('tier');
await p.goto(`http://localhost:4173${path}${tier ? `${path.includes('?') ? '&' : '?'}tier=${tier}` : ''}`, { waitUntil: 'networkidle' });
if (opt('scroll')) {
  await p.evaluate((y) => scrollTo(0, y), Number(opt('scroll')));
}
await p.waitForTimeout(Number(opt('wait') ?? 3200));
await p.screenshot({ path: out, fullPage: a.includes('--full') });
await b.close();
