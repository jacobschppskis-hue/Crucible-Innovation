// Screenshot one element after scrolling it into view: node overnight/tools/spot.mjs <path> <selector> <out.png> [--phone] [--tier t] [--wait ms] [--pad px]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const a = process.argv.slice(2);
const opt = (n, d) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : d);
const [path, sel, out] = a;
const phone = a.includes('--phone');
const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const b = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: phone ? 2 : 1 });
p.on('pageerror', (e) => console.log('pageerror:', String(e)));
await p.goto(`http://localhost:4173${path}${path.includes('?') ? '&' : '?'}tier=${opt('tier', 'light')}`, { waitUntil: 'networkidle' });
const el = p.locator(sel).first();
await el.scrollIntoViewIfNeeded();
await p.waitForTimeout(Number(opt('wait', 2500)));
const box = await el.boundingBox();
const pad = Number(opt('pad', 0));
await p.screenshot({ path: out, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(box.width + pad * 2, p.viewportSize().width), height: Math.min(box.height + pad * 2, p.viewportSize().height) } });
await b.close();
