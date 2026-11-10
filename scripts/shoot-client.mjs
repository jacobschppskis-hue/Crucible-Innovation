// Screenshots a live client site for /work and /sites, as rendered in a real browser, at every size the pages serve.
//
//   node scripts/shoot-client.mjs <slug> <url> [<key>=<selector>@<fraction> ...]
//   e.g. node scripts/shoot-client.mjs halcyon https://halcyon.coffee menu=#menu@0
//
// Always: the top of the page.
//   public/work/<slug>.webp            desktop, 1440 × 900, plus -960 and -640 (lib/imageLoader.ts serves them)
//   public/work/<slug>-phone.webp      phone, 780 × 1688 (390 × 844 at 2x), plus -390
// For each <key>=<selector>@<fraction>, a "moment" further down the page (data/work.ts `moments`, the film on /work):
//   public/work/<slug>-<key>.webp and public/work/<slug>-<key>-phone.webp, with the same variants.
//   The page is scrolled to the element's top plus <fraction> of its scroll length (its height less one screen), so
//   0.5 is halfway through a pinned scene and 0 is its first screen. <fraction> may be "desktop/phone" (0.2/0.05).
//
// The phone shot is a 390 × 797 viewport under a 47 px status bar in the page's own theme colour, the way a phone shows
// it, so the frame's island on /work never covers the site's own header.
// Needs Playwright's Chromium (npx playwright install chromium) or CHROMIUM_PATH, and sharp (Next installs it).
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [slug, url, ...rest] = process.argv.slice(2);
const moments = rest.map((a) => /^([a-z0-9-]+)=(.+)@([\d.]+)(?:\/([\d.]+))?$/.exec(a));
if (!slug || !/^https?:\/\//.test(url ?? '') || moments.includes(null)) {
  console.error('Usage: node scripts/shoot-client.mjs <slug> <url> [<key>=<selector>@<fraction>[/<phone fraction>] ...]');
  process.exit(1);
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public/work');
const STATUS = 47; // CSS px: the phone's status bar
const QUALITY = 74;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const devices = [
  { suffix: '', phone: false, widths: [960, 640], context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  {
    suffix: '-phone',
    phone: true,
    widths: [390],
    context: { viewport: { width: 390, height: 844 - STATUS }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE },
  },
];

let total = 0;
async function write(png, name, widths) {
  const full = sharp(png);
  const { width } = await full.metadata();
  for (const w of [width, ...widths]) {
    const file = `${name}${w === width ? '' : `-${w}`}.webp`;
    await sharp(png).resize({ width: w }).webp({ quality: QUALITY, effort: 6 }).toFile(join(out, file));
    const kb = statSync(join(out, file)).size / 1024;
    total += kb;
    console.log(`wrote public/work/${file} (${w} wide, ${kb.toFixed(0)} KB)`);
  }
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const d of devices) {
  const page = await browser.newPage(d.context);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500); // entrances
  const bar = d.phone
    ? await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.content || getComputedStyle(document.body).backgroundColor)
    : null;

  const shoot = async (name) => {
    let png = await page.screenshot({ type: 'png' });
    if (bar) {
      const s = STATUS * d.context.deviceScaleFactor;
      png = await sharp(png).extend({ top: s, background: bar }).png().toBuffer();
    }
    await write(png, name, d.widths);
  };

  await shoot(`${slug}${d.suffix}`);
  for (const [, key, selector, desktop, phone] of moments) {
    const f = Number(d.phone && phone ? phone : desktop);
    const target = () =>
      page.evaluate(
        ([selector, f]) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return Math.round(r.top + scrollY + f * Math.max(0, r.height - innerHeight));
        },
        [selector, f],
      );
    let y = await target();
    if (y === null) throw new Error(`${key}: nothing matches ${selector}`);
    // In steps, the way a visitor scrolls, so scroll-driven scenes follow and lazy images load.
    const from = await page.evaluate(() => scrollY);
    for (let i = 1; i <= 12; i++) {
      await page.evaluate((to) => scrollTo(0, to), from + ((y - from) * i) / 12);
      await page.waitForTimeout(80);
    }
    // Images that load on the way change the page's height: aim again until the target holds still.
    for (let i = 0; i < 6; i++) {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(600);
      const again = await target();
      if (Math.abs(again - y) < 2) break;
      y = again;
      await page.evaluate((to) => scrollTo(0, to), y);
    }
    // Arrive the way a hand does, with a few last small moves: a canvas that draws on scroll gets its events.
    for (const dy of [-90, -45, -12, 0]) {
      await page.evaluate((to) => scrollTo(0, to), y + dy);
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(2400); // the scene's own easing and reveals
    await shoot(`${slug}-${key}${d.suffix}`);
    console.log(`  ${key}: ${selector} at ${f}, scrolled to ${y}`);
  }
  await page.close();
}
await browser.close();
console.log(`${total.toFixed(0)} KB in all (a visitor loads one width of each)`);
