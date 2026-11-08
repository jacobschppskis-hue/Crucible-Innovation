// node lab/mark/shoot.mjs <out-prefix> <query> <beat,beat,...> [iphone|desk]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = pw;
import path from 'node:path';
const [,, out, query = '', beats = '0', dev = 'iphone'] = process.argv;
const exe = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = dev === 'iphone' ? await browser.newContext({ ...devices['iPhone 15'] }) : await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (m) => console.log('console:', m.text()));
const file = 'file://' + path.resolve('lab/mark/proto.html') + '?' + query;
await page.goto(file);
await page.waitForFunction(() => document.title !== '', null, { timeout: 120000 });
const title = await page.title();
if (title.startsWith('ERR')) { console.log(title); process.exit(1); }
for (const b of beats.split(',')) {
  const t0 = Date.now();
  await page.evaluate(([b]) => window.render(+b, 3), [b]);
  await page.screenshot({ path: `${out}-${b}.png` });
  console.log(`${out}-${b}.png`, Date.now() - t0, 'ms');
}
await browser.close();
