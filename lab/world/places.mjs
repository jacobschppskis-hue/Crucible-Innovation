// Prints each place's top/height (and the DOM elements carrying it) on iPhone 15 and 1440x900.
import { chromium, devices } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [n, prof] of [['phone', devices['iPhone 15']], ['desk', { viewport: { width: 1440, height: 900 } }]]) {
  const p = await (await b.newContext({ ...prof, deviceScaleFactor: 1 })).newPage();
  await p.goto('file://' + process.cwd() + '/world/dist/crucible.html?t=6&q=8');
  await p.waitForFunction(() => window.__world, null, { timeout: 60000 });
  console.log(n, await p.evaluate(() => JSON.stringify(window.__world.state().places)));
  console.log(n, await p.evaluate(() => [...document.querySelectorAll('[data-place]')].map(e => e.dataset.place + ':' + e.tagName + ':' + Math.round(e.getBoundingClientRect().top + scrollY) + '+' + Math.round(e.getBoundingClientRect().height)).join(' ')));
}
await b.close();
