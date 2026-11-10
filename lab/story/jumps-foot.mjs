// Continuity: walk the lap in small scroll steps (camera only, no rendering waits) and list the biggest per-px changes
// of camera direction, altitude (log), sun direction and fov, with where they happen. node lab/world/jumps.mjs [phone|desk]
import { chromium, devices } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const which = process.argv[2] || 'phone';
const prof = which === 'phone' ? devices['iPhone 15'] : { viewport: { width: 1440, height: 900 } };
const p = await (await b.newContext({ ...prof, deviceScaleFactor: 1 })).newPage();
await p.goto('file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=8');
await p.waitForFunction(() => window.__world, null, { timeout: 60000 });
const rows = await p.evaluate(async () => {
  const W = window.__world, E = W.engine, f = E.frame;
  W.hold();
  const L = f.loopLen, out = [];
  const step = 8;
  let prev = null;
  for (let y = 0; y <= L; y += step) {
    E.scroll.to(y, true);
    await W.step(16);
    const c = { y, place: f.place.name, fwd: [...f.cam.f], h: f.cam.h, sun: [...f.sun.dir], fov: f.cam.fov };
    if (prev) {
      const ang = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 57.3;
      out.push({ y, place: c.place, view: ang(prev.fwd, c.fwd) / step * 100, alt: Math.abs(Math.log(c.h / prev.h)) / step * 100, sunRel: Math.abs(ang(prev.sun, c.sun) - ang(prev.fwd, c.fwd)) / step * 100, fov: Math.abs(c.fov - prev.fov) / step * 100 });
    }
    prev = c;
  }
  return out;
});
for (const k of ['view', 'alt', 'fov']) {
  const top = [...rows].filter((r) => ["shore","dawn","loop"].includes(r.place)).sort((a, b) => b[k] - a[k]).slice(0, 6);
  console.log(which, k, 'per 100px:', top.map((r) => `${r[k].toFixed(2)}@${r.y}(${r.place})`).join('  '));
}
await b.close();
