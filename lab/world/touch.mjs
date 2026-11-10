// Touch flick across the loop seam on iPhone 15 (CDP touch with timestamps), preview file. Prints the scroll trace.
import { chromium, devices } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['iPhone 15'], deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto('file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=8');
await p.waitForFunction(() => window.__world, null, { timeout: 30000 });
const start = +(process.argv[2] || 0.97);
await p.evaluate((x) => window.__world.go(x), start);
const cdp = await ctx.newCDPSession(p);
const T0 = Date.now() / 1000;
let ts = T0;
const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }], timestamp: (ts += 0.008) });
const trace = [];
const rec = async (tag) => trace.push([tag, await p.evaluate(() => { const s = window.__world.state(); return [Math.round(s.scroll), Math.round(s.y), s.laps, s.place.name, Math.round(scrollY)]; })]);
await rec('start');
await touch('touchStart', 700);
for (let i = 1; i <= 12; i++) await touch('touchMove', 700 - i * 35);
await touch('touchEnd', 280);
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(100);
  await rec('t+' + (i + 1) * 100);
}
for (const [t, v] of trace) console.log(t.padEnd(7), JSON.stringify(v));
await b.close();
