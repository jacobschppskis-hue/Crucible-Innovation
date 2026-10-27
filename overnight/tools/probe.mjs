// Evaluates an expression in a page and prints the JSON result. Quick layout/state checks without writing a test.
//   node overnight/tools/probe.mjs <path> <width> <height> "<expression>" [--scroll px] [--tier rich|light]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const [path = '/', w = '1440', h = '900', expr = 'document.title'] = args;
const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const b = await chromium.launch({ executablePath });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => console.log('console:', m.text()));
p.on('pageerror', (e) => console.log('pageerror:', String(e)));
const tier = opt('tier');
await p.goto(`http://localhost:4173${path}${tier ? `?tier=${tier}` : ''}`, { waitUntil: 'networkidle' });
if (opt('scroll')) await p.evaluate((y) => scrollTo(0, y), Number(opt('scroll')));
await p.waitForTimeout(600);
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close();
