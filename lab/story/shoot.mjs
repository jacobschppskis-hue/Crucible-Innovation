// node lab/story/shoot.mjs <page> <out-prefix> [query...]: renders frames at iPhone 15 and 1440x900 (SwiftShader)
import { chromium, devices } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
const root = resolve(new URL('../..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css' };
const srv = createServer(async (q, r) => { try { const u = decodeURIComponent(q.url.split('?')[0]); const b = await readFile(join(root, u)); r.writeHead(200, { 'content-type': types[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const port = srv.address().port;
const [page, out, ...qs] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const only = process.env.ONLY;
for (const [name, ctx] of [['phone', devices['iPhone 15']], ['desk', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }]]) {
  if (only && only !== name) continue;
  const c = await b.newContext(ctx); const p = await c.newPage();
  p.on('console', (m) => m.type() === 'error' && console.log(name, m.text()));
  for (const q of qs.length ? qs : ['']) {
    await p.goto(`http://localhost:${port}/lab/story/${page}?${q}`);
    await p.waitForSelector('html[data-ready]', { timeout: 60000, state: 'attached' });
    await p.waitForTimeout(150);
    const f = `${out}-${name}-${q.replace(/[^a-z0-9.]+/gi, '_') || 'x'}.png`;
    await p.screenshot({ path: f });
    console.log(f);
  }
  await c.close();
}
await b.close(); srv.close();
