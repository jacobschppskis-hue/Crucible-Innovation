// Hero contrast check (world's repro): iPhone 15 at 390x844, q 4, t 8, hero f 0, text hidden; reports the sea's
// luminance behind the headline and the glitter column's bright span.
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const srv = http.createServer((req, res) => { let f = path.join('out', decodeURIComponent(new URL(req.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) return res.writeHead(404).end(); res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => srv.listen(0, r));
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext(process.env.DESK ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { ...devices['iPhone 15'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`http://localhost:${srv.address().port}/?q=4&t=8`);
await page.waitForFunction(() => window.__world);
await page.evaluate(() => window.__world.goPlace('hero', 0));
await page.waitForTimeout(400);
await page.addStyleTag({ content: 'main *, nav * { color: transparent !important; background: transparent !important; border-color: transparent !important; }' });
if (process.env.GLINT0) await page.evaluate(() => { window.__lava.LAVA.glint = 0; });
if (process.env.ENV0) await page.evaluate(() => { window.__lava.LAVA.env = 0; });
await page.evaluate(() => { window.__world.hold(); window.__world.step(16); });
const out = process.argv[2] || '/tmp/hero-notext.png';
await page.screenshot({ path: out, timeout: 180000 });
console.log(out);
await b.close(); srv.close();
