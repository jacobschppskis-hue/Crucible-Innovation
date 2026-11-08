import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=8' + (process.argv[2] || ''));
await p.waitForFunction(() => window.__world || document.documentElement.dataset.worldFail, null, { timeout: 60000 });
console.log(await p.evaluate(() => JSON.stringify({ fail: document.documentElement.dataset.worldFail, dropped: document.documentElement.dataset.worldDropped, mods: window.__world && window.__world.state().modules })));
await b.close();
