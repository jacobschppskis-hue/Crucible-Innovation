// node lab/story/starts.mjs: the built home page (out/) starts the world (no data-world-fail, window.__world, data-world-on)
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const srv = http.createServer((q, r) => { let f = path.join('out', decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) return r.writeHead(404).end(); r.end(fs.readFileSync(f)); }).listen(8136);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.goto('http://localhost:8136/'); await p.mouse.move(5, 5); await p.waitForTimeout(8000);
const r = await p.evaluate(() => ({ fail: document.documentElement.dataset.worldFail || '', world: !!window.__world, on: document.documentElement.hasAttribute('data-world-on') }));
console.log(r); await b.close(); srv.close(); process.exit(r.fail || !r.world || !r.on ? 1 : 0);
