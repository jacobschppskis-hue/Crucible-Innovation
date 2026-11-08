// node lab/look/shoot.mjs out.png "scene=hero&w=390&h=844&dpr=2" [more...]
import { chromium } from 'playwright';
const [out, ...qs] = process.argv.slice(2);
const exe = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.LAB || 'http://localhost:8765/lab/look/index.html';
let i = 0;
for (const qq of qs) {
  const p = new URLSearchParams(qq);
  const w = +(p.get('w') || 390), h = +(p.get('h') || 844), dpr = +(p.get('dpr') || 1);
  const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const errs = []; pg.on('console', (m) => m.type() === 'error' && errs.push(m.text())); pg.on('pageerror', (e) => errs.push(String(e)));
  const t0 = Date.now();
  await pg.goto(base + '?' + qq);
  await pg.waitForFunction(() => document.title === 'ready' || window.__err, null, { timeout: 180000 }).catch((e) => errs.push(String(e)));
  if (errs.length) console.error(errs.join('\n').slice(0, 3000));
  const name = qs.length > 1 ? out.replace(/(\.\w+)$/, `-${i}$1`) : out;
  await pg.screenshot({ path: name });
  console.log(name, (Date.now() - t0) + 'ms');
  await pg.close(); i++;
}
await b.close();
