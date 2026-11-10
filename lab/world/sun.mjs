import { chromium, devices } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ ...devices['iPhone 15'], deviceScaleFactor: 1 })).newPage();
await p.goto('file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=8');
await p.waitForFunction(() => window.__world, null, { timeout: 60000 });
for (const f of [0.5, 0.7, 0.85, 1]) {
  await p.evaluate((f) => window.__world.goPlace('shore', f), f);
  console.log(f, await p.evaluate(() => {
    const F = window.__world.engine.frame, s = F.sun, c = F.project(s.pos), r = (28.8 * s.R / 4.8) / s.dist * F.cam.focal;
    const txt = [...document.querySelectorAll('[data-place="shore"] a, [data-place="shore"] p, [data-place="shore"] h2, [data-place="shore"] li')].map(e => e.getBoundingClientRect()).filter(r => r.bottom > 0 && r.top < innerHeight && r.width);
    const bottom = Math.max(...txt.map(r => r.bottom));
    return `sun ${c ? c[0].toFixed(0) + ',' + c[1].toFixed(0) : 'none'} markR ${r.toFixed(0)} textBottom ${bottom.toFixed(0)} h ${innerHeight}`;
  }));
}
await b.close();
