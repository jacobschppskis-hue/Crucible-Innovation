// node lab/story/nojs-check.mjs: with JS off, every Thesis line is visible (opacity 1) on iPhone 15 and 1440x900
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const srv = http.createServer((q, r) => { let f = path.join('out', decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) return r.writeHead(404).end(); r.end(fs.readFileSync(f)); }).listen(8132);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
for (const ctx of [devices['iPhone 15'], { viewport: { width: 1440, height: 900 } }]) {
  const c = await b.newContext({ ...ctx, javaScriptEnabled: false }); const p = await c.newPage();
  await p.goto('http://localhost:8132/');
  console.log(await p.evaluate(() => [...document.querySelectorAll('.wthesis p, .wfoot-call, .wch-break-line')].map((e) => { let o = 1; for (let x = e; x; x = x.parentElement) o *= +getComputedStyle(x).opacity; const r = e.getBoundingClientRect(); return `${o.toFixed(2)} h${Math.round(r.height)} ${e.textContent.trim().slice(0, 32)}`; })));
  await c.close();
}
await b.close(); srv.close();
