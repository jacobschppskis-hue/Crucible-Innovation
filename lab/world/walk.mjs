// Walk the lap on iPhone 15 (or desk) in N even progress steps from the preview; frames + one contact sheet.
// node lab/world/walk.mjs [phone|desk] [N] [q]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const which = process.argv[2] || 'phone', N = +(process.argv[3] || 24), q = process.argv[4] || '6';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const prof = which === 'phone' ? devices['iPhone 15'] : { viewport: { width: 1440, height: 900 } };
const p = await (await b.newContext({ ...prof, deviceScaleFactor: 1 })).newPage();
await p.goto('file://' + process.cwd() + `/world/dist/crucible.html?t=6&q=${q}`);
await p.waitForFunction(() => window.__world, null, { timeout: 60000 });
const dir = `lab/world/shots/walk-${which}`;
fs.mkdirSync(dir, { recursive: true });
const files = [];
for (let i = 0; i < N; i++) {
  const x = i / N;
  await p.evaluate((x) => window.__world.go(x), x);
  await p.waitForTimeout(300);
  const f = `${dir}/${String(i).padStart(2, '0')}.png`;
  await p.screenshot({ path: f, timeout: 120000 });
  files.push(f);
  console.log(x.toFixed(3), await p.evaluate(() => { const s = window.__world.state(); return `${s.place.name} f${s.place.f.toFixed(2)} h${s.cam.h.toFixed(0)}`; }));
}
execFileSync('python3', ['lab/world/sheet.py', `lab/world/shots/walk-${which}.png`, which === 'phone' ? '200' : '360', which === 'phone' ? '8' : '6', ...files]);
await b.close();
