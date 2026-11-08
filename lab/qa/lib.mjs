// QA harness core: static server, targets, browsers/devices, the world hooks adapter, pixels.
// Framework-free Node ESM (Playwright library + sharp, both already in node_modules).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
import sharp from 'sharp';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const QA = path.join(ROOT, 'lab/qa');

// ---------- args ----------
export function args(defaults = {}) {
  const out = { ...defaults };
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

// ---------- static server ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.txt': 'text/plain',
  '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.wasm': 'application/wasm',
};
export function serve(dir, port = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const cands = [p, p + '.html', path.join(p, 'index.html')];
      for (const c of cands) {
        const f = path.join(dir, c);
        if (!f.startsWith(dir)) break;
        if (fs.existsSync(f) && fs.statSync(f).isFile()) {
          res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
          return fs.createReadStream(f).pipe(res);
        }
      }
      const nf = path.join(dir, '404.html');
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'not found');
    });
    srv.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }));
  });
}

// ---------- targets ----------
// out       the Next static export (out/, home at /)
// dist      the single-file preview (world/dist/crucible.html)
// frame     the preview wrapped in the claude.ai artifact frame head (plan/final/artifact-frame-head.html)
// airless | continuum   the two concepts (lab/qa/concepts/*.html, fetched from their branches if missing)
// http(s)://...         anything already running (e.g. the dev server)
const CONCEPTS = {
  airless: ['origin/claude/inspiring-allen-sz5kjl-concept-airless', 'concepts/airless/index.html'],
  continuum: ['origin/claude/inspiring-allen-sz5kjl-concept-continuum', 'concepts/continuum/index.html'],
};
export function frameWrap(html) {
  // The artifact host prepends its head and puts the page into a document skeleton; our file's own <html>/<head>/<body>
  // tags then sit inside its body, which the parser drops (their children stay). The host body is white on black.
  const head = fs.readFileSync(path.join(ROOT, 'plan/final/artifact-frame-head.html'), 'utf8');
  const inner = html.replace(/<!doctype[^>]*>/i, '');
  return head + inner + '</body></html>';
}
export async function target(name = 'out') {
  if (/^https?:/.test(name)) return { url: name, path: '', close() {} , name };
  if (name === 'out') {
    const dir = path.join(ROOT, 'out');
    if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error('out/ missing: run `npm run build` first (or --target=dist|URL)');
    const s = await serve(dir);
    return { ...s, path: '/', name };
  }
  if (name === 'dist' || name === 'frame') {
    const f = path.join(ROOT, 'world/dist/crucible.html');
    if (!fs.existsSync(f)) throw new Error('world/dist/crucible.html missing: run `npm run world:preview` first');
    const dir = path.join(QA, '.serve');
    fs.mkdirSync(dir, { recursive: true });
    const html = fs.readFileSync(f, 'utf8');
    fs.writeFileSync(path.join(dir, 'crucible.html'), html);
    fs.writeFileSync(path.join(dir, 'frame.html'), frameWrap(html));
    // a sandboxed cross-origin-ish iframe, the way the artifact viewer embeds pages
    fs.writeFileSync(path.join(dir, 'iframe.html'),
      `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style><iframe sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms" src="frame.html"></iframe>`);
    const s = await serve(dir);
    return { ...s, path: name === 'dist' ? '/crucible.html' : '/frame.html', name };
  }
  if (CONCEPTS[name]) {
    const dir = path.join(QA, 'concepts');
    const f = path.join(dir, name + '.html');
    if (!fs.existsSync(f)) {
      fs.mkdirSync(dir, { recursive: true });
      const [ref, p] = CONCEPTS[name];
      fs.writeFileSync(f, execSync(`git show ${ref}:${p}`, { cwd: ROOT, maxBuffer: 64 << 20 }));
    }
    const s = await serve(dir);
    return { ...s, path: `/${name}.html`, name };
  }
  throw new Error('unknown target ' + name);
}

// ---------- browser + devices ----------
export const CHROME = process.env.PW_CHROMIUM_PATH ||
  ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/opt/pw-browsers/chromium/chrome-linux64/chrome'].find((p) => fs.existsSync(p));
export async function browser({ webgl = true, extra = [] } = {}) {
  const a = webgl ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    : ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'];
  return chromium.launch({ executablePath: CHROME, args: [...a, '--autoplay-policy=no-user-gesture-required', ...extra] });
}
// iPhone 15 in Chromium (Playwright's preset is WebKit; keep its metrics, UA, touch).
const { defaultBrowserType: _b, ...IPHONE15 } = devices['iPhone 15'];
export const DEVICES = {
  iphone: IPHONE15, // 393x659 viewport (Safari chrome shown), dpr 3, touch, mobile
  iphoneFull: { ...IPHONE15, viewport: { width: 390, height: 844 } }, // the brief's 390x844 (address bar collapsed)
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  narrow: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE15.userAgent },
};
export async function context(b, device = 'desktop', opts = {}) {
  const d = typeof device === 'string' ? DEVICES[device] : device;
  // Screenshots only we look at: dpr 1 unless asked (fast; SwiftShader cost scales with pixels).
  return b.newContext({ ...d, deviceScaleFactor: opts.dpr ?? d.deviceScaleFactor, ...opts.ctx });
}

// Collect console errors / page errors / failed requests.
export function watch(page) {
  const log = { errors: [], warnings: [], failed: [] };
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + (e.stack || e.message || String(e)).split('\n').slice(0, 3).join(' | ')));
  page.on('console', (m) => {
    if (m.type() === 'error') { if (!/^Failed to load resource/.test(m.text())) log.errors.push('console: ' + m.text().slice(0, 400)); }
    else if (m.type() === 'warning') log.warnings.push(m.text().slice(0, 300));
  });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) log.failed.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`); });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (/fonts\.(googleapis|gstatic)\.com|umami|formspree/.test(u)) return; // external, not ours
    log.failed.push(`${r.failure()?.errorText} ${u.slice(0, 160)}`);
  });
  return log;
}
export const benignError = (e) => /favicon|Failed to load resource: the server responded with a status of 404 .*\.(ico|png)$/.test(e)
  // headless SwiftShader noise, not the page's fault
  || /GPU stall due to ReadPixels|Automatic fallback to software WebGL has been deprecated|WebGL: too many errors/.test(e);

// ---------- the hooks adapter ----------
// Installs window.__qa in the page: one interface over the final engine (__world + __clock) and the concepts
// (__state/__hold/__step). go(p) = journey progress 0..1 (the loop's period); step(ms) renders exactly one frame.
export async function adapter(page) {
  return page.evaluate(() => {
    const w = window;
    const kind = w.__world ? 'world' : w.__state ? 'concept' : 'none';
    const maxY = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const qa = {
      kind,
      hold() { if (w.__world?.hold) w.__world.hold(); else if (w.__clock) w.__clock.pause(); else w.__hold?.(); },
      resume() { if (w.__world?.resume) w.__world.resume(); else if (w.__clock) w.__clock.resume(); else w.__resume?.(); },
      step(ms = 1000 / 60) {
        if (w.__world?.step) return w.__world.step(ms);
        if (w.__clock) return w.__clock.step(ms);
        return w.__step?.(ms / 1000);
      },
      go(p) {
        if (w.__world?.go) return w.__world.go(p);
        scrollTo(0, Math.round(p * maxY()));
      },
      state() {
        try { return w.__world?.state ? w.__world.state() : w.__state ? w.__state() : null; } catch (e) { return { error: String(e) }; }
      },
      progress() {
        const s = qa.state();
        if (s && typeof s.progress === 'number') return s.progress;
        return scrollY / (maxY() || 1);
      },
      maxY,
    };
    w.__qa = qa;
    return kind;
  });
}
// wait until the world (or a concept) is up; returns the adapter kind or 'none'
export async function waitWorld(page, ms = 15000) {
  const t0 = Date.now();
  // the engine starts after load + idle or first use: give it a first use
  try { await page.mouse.move(200, 300); await page.mouse.move(210, 310); } catch {}
  while (Date.now() - t0 < ms) {
    const k = await page.evaluate(() => (window.__world ? 'world' : window.__state ? 'concept' : 'none')).catch(() => 'none');
    if (k !== 'none') { await adapter(page); return k; }
    await page.waitForTimeout(250);
  }
  await adapter(page);
  return 'none';
}
export async function settle(page, frames = 60, ms = 1000 / 60) {
  await page.evaluate(async ([n, ms]) => { for (let i = 0; i < n; i++) { window.__qa.step(ms); if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0)); } }, [frames, ms]);
}

// ---------- pixels ----------
export async function shot(page, opts = {}) {
  return page.screenshot({ type: 'png', animations: 'allow', caret: 'initial', ...opts });
}
export async function raw(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const LIN = Float32Array.from({ length: 256 }, (_, i) => lin(i));
export const relLum = (r, g, b) => 0.2126 * LIN[r] + 0.7152 * LIN[g] + 0.0722 * LIN[b];
export const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
// mean/std luminance, fraction of near-black pixels, a coarse 'interest' (mean local gradient)
export async function stats(png, region) {
  const { data, w, h } = await raw(png);
  const x0 = region?.x ?? 0, y0 = region?.y ?? 0, x1 = Math.min(w, x0 + (region?.w ?? w)), y1 = Math.min(h, y0 + (region?.h ?? h));
  let n = 0, s = 0, s2 = 0, black = 0, grad = 0, maxL = 0, hot = 0;
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 120000)));
  for (let y = y0; y < y1 - step; y += step) for (let x = x0; x < x1 - step; x += step) {
    const i = (y * w + x) * 3;
    const L = relLum(data[i], data[i + 1], data[i + 2]);
    const j = (y * w + x + step) * 3, k = ((y + step) * w + x) * 3;
    grad += Math.abs(L - relLum(data[j], data[j + 1], data[j + 2])) + Math.abs(L - relLum(data[k], data[k + 1], data[k + 2]));
    n++; s += L; s2 += L * L; if (L < 0.002) black++; if (L > maxL) maxL = L;
    if (data[i] > 200 && data[i] - data[i + 2] > 90) hot++;
  }
  const mean = s / n;
  return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)), black: black / n, grad: grad / n, maxL, hot: hot / n, w, h };
}
// mean absolute difference (0..255) between two PNGs (same size), optionally in a region
export async function diff(a, b, region) {
  const A = await raw(a), B = await raw(b);
  if (A.w !== B.w || A.h !== B.h) return { mad: 255, p99: 255, sizeMismatch: true };
  const x0 = region?.x ?? 0, y0 = region?.y ?? 0, x1 = Math.min(A.w, x0 + (region?.w ?? A.w)), y1 = Math.min(A.h, y0 + (region?.h ?? A.h));
  const hist = new Uint32Array(256); let n = 0, s = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * A.w + x) * 3;
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    hist[d]++; s += d; n++;
  }
  let acc = 0, p99 = 0; for (let d = 0; d < 256; d++) { acc += hist[d]; if (acc >= n * 0.99) { p99 = d; break; } }
  return { mad: s / n, p99 };
}
export async function saveWebp(png, file, { width = 900, quality = 72 } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(png).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(file);
  return file;
}

// ---------- touch via CDP ----------
export async function cdp(page) { return page.context().newCDPSession(page); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// a finger drag along points [[x,y],...] at ~60 Hz
export async function touchDrag(c, pts, { dt = 16 } = {}) {
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1], id: 1 }] });
  for (const [x, y] of pts.slice(1)) { await sleep(dt); await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }); }
  await sleep(dt);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
export async function tap(c, x, y) {
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(60);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
// a flick: Chromium's own touch gesture pipeline, with a fling (momentum) after lift
export async function flick(c, { x = 195, y = 600, dy = -500, speed = 3000 } = {}) {
  await c.send('Input.synthesizeScrollGesture', { x, y, yDistance: dy, xDistance: 0, speed, gestureSourceType: 'touch', preventFling: false, repeatCount: 1 });
}
export { sleep, sharp, fs, path };
