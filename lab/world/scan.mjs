// Journey scan: channel values, sun elevation and place along the lap (desktop + phone), from the preview file.
import { chromium, devices } from 'playwright';
const exe = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const url = 'file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=7';
for (const [name, prof] of [['desk', { viewport: { width: 1440, height: 900 } }], ['phone', devices['iPhone 15']]]) {
  if (process.argv[2] && process.argv[2] !== name) continue;
  const ctx = await b.newContext({ ...prof, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.waitForFunction(() => window.__world, null, { timeout: 30000 });
  const N = +(process.argv[3] || 40);
  for (let i = 0; i <= N; i++) {
    await p.evaluate((x) => window.__world.go(x), i / N);
    const s = await p.evaluate(() => {
      const f = window.__world.engine.frame;
      const el = Math.asin(f.sun.dir[0] * f.cam.up[0] + f.sun.dir[1] * f.cam.up[1] + f.sun.dir[2] * f.cam.up[2]) * 57.3;
      const fwdSun = Math.acos(f.sun.dir[0] * f.cam.f[0] + f.sun.dir[1] * f.cam.f[1] + f.sun.dir[2] * f.cam.f[2]) * 57.3;
      return `${f.place.name.padEnd(9)} th ${(f.cam.theta * 57.3).toFixed(1).padStart(6)} h ${f.cam.h.toFixed(1).padStart(7)} yaw ${f.ch.yaw.toFixed(0).padStart(4)} pitch ${f.ch.pitch.toFixed(0).padStart(4)} | sun el ${el.toFixed(1).padStart(6)} off-axis ${fwdSun.toFixed(0).padStart(4)} rad ${(f.sun.rad * 57.3).toFixed(2)} dist ${f.sun.dist.toExponential(1)}`;
    });
    console.log(name, (i / N).toFixed(3), s);
  }
  await ctx.close();
}
await b.close();
