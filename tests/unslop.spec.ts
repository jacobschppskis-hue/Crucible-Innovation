import { expect, test, type Page } from '@playwright/test';

// The "unslop" rules (.claude/skills/unslop/SKILL.md) that a machine can check. The concept client sites (.ls) are
// other businesses' designs and are exempt; so is anything marked data-unslop-ok.

const PAGES = ['/', '/sites', '/work', '/ventures', '/ventures/verge'];

type Finding = { rule: string; text: string };

const audit = (page: Page) =>
  page.evaluate(() => {
    const out: { rule: string; text: string }[] = [];
    const exempt = (el: Element) => !!el.closest('.ls, [data-unslop-ok], [aria-hidden="true"] .ls');
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const ownText = (el: Element) =>
      [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .trim();

    // Headings never end with a period.
    for (const h of document.querySelectorAll('h1, h2, h3')) {
      if (exempt(h)) continue;
      const t = (h.textContent ?? '').trim();
      if (/[^.]\.$/.test(t) && !/\b(Co|St|Jr)\.$/.test(t)) out.push({ rule: 'heading ends with a period', text: t });
    }
    // No second "voice" face, no mono outside real data, no wide-tracked caps.
    for (const el of document.querySelectorAll('body *')) {
      if (exempt(el) || !visible(el) || !ownText(el)) continue;
      const cs = getComputedStyle(el);
      const t = ownText(el).slice(0, 60);
      if (/instrument/i.test(cs.fontFamily)) out.push({ rule: 'Instrument Serif outside the concept sites', text: t });
      if (/mono|menlo|courier/i.test(cs.fontFamily) && !el.closest('.try-url, .bs-url, .wk-url, [data-mono-ok]')) out.push({ rule: 'mono outside data', text: t });
      const ls = parseFloat(cs.letterSpacing) || 0;
      if (cs.textTransform === 'uppercase' && ls > parseFloat(cs.fontSize) * 0.05 + 0.01) out.push({ rule: 'wide-tracked caps', text: t });
      if (/^0\d\s*[·.]/.test(t)) out.push({ rule: 'decorative section numbering', text: t });
    }
    return out;
  });

for (const path of PAGES) {
  test(`unslop: ${path}`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: 'networkidle' });
    test.skip(!res || res.status() !== 200, `${path} does not exist yet`);
    const found: Finding[] = await audit(page);
    expect(found, JSON.stringify(found, null, 1)).toEqual([]);
  });
}

// No dead zones on the home page: the whole page is one world (lib/world) whose camera follows the scroll, so at
// every half-viewport of scroll the journey's progress moves on (the world answers the scroll everywhere).
test('home: the world answers the scroll at every position', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?loop=0', { waitUntil: 'load' });
  await page.mouse.move(200, 300);
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __world?: unknown }).__world), { timeout: 20_000 }).toBe(true);
  const vh = page.viewportSize()!.height;
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const dead: number[] = [];
  let last = -1;
  for (let y = 0; y <= max; y += vh / 2) {
    await page.evaluate((t) => scrollTo(0, t), y);
    // the world reads the scroll on its next frame (software GL draws a few a second)
    const read = () => page.evaluate(() => (window as unknown as { __world: { state(): { progress: number; scroll: number } } }).__world.state());
    let p = -1;
    for (let k = 0; k < 100; k++) { const st = await read(); p = st.progress; if (p > last + 1e-4) break; await page.waitForTimeout(100); }
    if (last >= 0 && !(p > last)) dead.push(Math.round((y / vh) * 10) / 10);
    last = p;
  }
  expect(dead, `the world did not move on at these scroll positions (viewport heights): ${dead.join(', ')}`).toEqual([]);
});
