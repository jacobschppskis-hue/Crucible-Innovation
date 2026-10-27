// The rich-tier ring with the cursor over it: node overnight/tools/hover.mjs <out-prefix> [x-frac y-frac ...]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const [out, ...pts] = process.argv.slice(2);
const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const b = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('pageerror:', String(e)));
await p.goto('http://localhost:4173/?tier=rich', { waitUntil: 'networkidle' });
await p.waitForSelector('section.ig[data-gl]', { timeout: 30000 });
const r = await p.locator('.ig-ring').boundingBox();
const at = pts.length ? pts.map(Number) : [0.2, 0.5];
for (let i = 0; i < at.length; i += 2) {
  const [fx, fy] = [at[i], at[i + 1]];
  for (let k = 0; k < 8; k++) await p.mouse.move(r.x + r.width * (fx - 0.04 + k * 0.01), r.y + r.height * fy, { steps: 2 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}-${i / 2}.png`, clip: { x: r.x - 40, y: r.y - 40, width: r.width + 80, height: r.height + 80 } });
}
await p.mouse.move(5, 880);
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}-away.png`, clip: { x: r.x - 40, y: r.y - 40, width: r.width + 80, height: r.height + 80 } });
console.log(await p.evaluate(() => getComputedStyle(document.querySelector('.ig-svg')).getPropertyValue('--hr')));
await b.close();
