// node lab/story/probe.mjs <place> <f>: camera + sea coords at a few screen points (from out/)
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const srv = http.createServer((q, r) => { let f = path.join('out', decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) return r.writeHead(404).end(); r.end(fs.readFileSync(f)); }).listen(8133);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:8133/?t=6&q=4'); await p.mouse.move(5, 5);
await p.waitForFunction(() => window.__world, null, { timeout: 30000 });
await p.evaluate(([a, f]) => window.__world.goPlace(a, +f), process.argv.slice(2)); await p.waitForTimeout(400);
console.log(await p.evaluate(() => { const e = window.__world.engine; const fr = e.frame; const c = fr.cam; const pts = [[195, 500], [195, 700], [195, 840]].map(([x, y]) => { const h = fr.hitSea(x, y); return h && `${x},${y} w=${h.w.map((v) => v.toFixed(1))} t=${h.t.toFixed(1)}`; }); return { s: c.s, x: c.x, h: c.h, theta: c.theta, ch: { yaw: fr.ch.yaw, pitch: fr.ch.pitch, s: fr.ch.s }, pts, uOn: e.uniforms.get('shore_uOn') }; }));
await b.close(); srv.close();
