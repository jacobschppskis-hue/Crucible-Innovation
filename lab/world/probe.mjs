import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('console', m => console.log('console:', m.text()));
await p.goto('file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=7');
await p.waitForFunction(() => window.__world, null, { timeout: 30000 });
for (const [pl, f] of [['shore', 0.5], ['dawn', 0.5], ['hero', 0]]) {
  await p.evaluate(([a, b]) => window.__world.goPlace(a, b), [pl, f]);
  console.log(pl, await p.evaluate(() => { const f = window.__world.engine.frame; return JSON.stringify({ sunScreen: f.project(f.sun.pos), rad: f.sun.rad, mods: window.__world.state().modules }); }));
}
await b.close();
