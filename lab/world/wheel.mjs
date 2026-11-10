// Wheel through the whole lap (and across the seam) on desktop; reports any backwards jump of the journey progress.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=8');
await p.waitForFunction(() => window.__world, null, { timeout: 60000 });
await p.mouse.move(700, 450);
let prev = 0, laps = 0, worst = 0, where = '';
for (let i = 0; i < 260; i++) {
  await p.mouse.wheel(0, 300);
  await p.waitForTimeout(60);
  const s = await p.evaluate(() => { const s = window.__world.state(); return { p: s.progress, place: s.place.name, y: s.y }; });
  let d = s.p - prev;
  if (d < -0.5) { laps++; d += 1; }
  if (d < worst) { worst = d; where = `${s.place} y${Math.round(s.y)} i${i}`; }
  prev = s.p;
}
console.log('laps', laps, 'end progress', prev.toFixed(3), 'worst backwards step', worst.toFixed(4), where);
await b.close();
