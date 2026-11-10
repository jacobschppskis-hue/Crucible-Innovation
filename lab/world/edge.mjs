// Is every piece of the mark >= 14 px inside the screen on small phones? (hero + together, the mark's horizontal extent)
import { chromium, devices } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const w of [360, 375, 390, 393]) {
  const ctx = await b.newContext({ ...devices['iPhone 15'], viewport: { width: w, height: Math.round(w * 659 / 393) }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  await p.goto('file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=8');
  await p.waitForFunction(() => window.__world, null, { timeout: 60000 });
  let worst = 1e9, at = '';
  for (const [pl, fs] of [['hero', [0, 0.5, 1]], ['together', [0, 0.25, 0.5, 0.75, 1]]]) for (const f of fs) {
    await p.evaluate(([a, b]) => window.__world.goPlace(a, b), [pl, f]);
    const m = await p.evaluate(() => {
      const F = window.__world.engine.frame, s = F.sun, k = s.R / 4.8, r = 28.8 * k;
      const L = F.project(s.pos.map((x, i) => x - F.cam.r[i] * r)), R = F.project(s.pos.map((x, i) => x + F.cam.r[i] * r));
      return L && R ? Math.min(L[0], F.w - R[0]) : 1e9;
    });
    if (m < worst) { worst = m; at = `${pl} ${f}`; }
  }
  await ctx.close();
  console.log(w, 'min margin px', worst.toFixed(1), 'at', at);
}
await b.close();
