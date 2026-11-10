// The hero still (before the world starts, and for no WebGL): the hero frame at full quality with the DOM hidden.
// node lab/world/still.mjs  ->  public/world/hero-{portrait,landscape}.webp
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
fs.mkdirSync('public/world', { recursive: true });
for (const [name, vp, w] of [['portrait', { width: 390, height: 844 }, 585], ['landscape', { width: 1440, height: 900 }, 1600]]) {
  const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: name === 'portrait', hasTouch: name === 'portrait' })).newPage();
  await p.goto('file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=1');
  await p.waitForFunction(() => window.__world, null, { timeout: 120000 });
  await p.evaluate(async () => { await window.__world.go(0); window.__world.hold(); for (let i = 0; i < 4; i++) await window.__world.step(16); });
  await p.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden!important}' });
  await p.waitForTimeout(500);
  const png = `/tmp/claude-0/still-${name}.png`;
  await p.screenshot({ path: png, timeout: 300000 });
  execFileSync('python3', ['-c', `from PIL import Image; im=Image.open('${png}').convert('RGB'); im=im.resize((${w}, round(im.height*${w}/im.width))); im.save('public/world/hero-${name}.webp', quality=70, method=6)`]);
  console.log(name, fs.statSync(`public/world/hero-${name}.webp`).size);
}
await b.close();
