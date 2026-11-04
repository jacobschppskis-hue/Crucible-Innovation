import { expect, test, type Locator, type Page } from '@playwright/test';

// Process on /sites (components/Process.tsx): seven days you can scrub, a site building itself in a browser frame.

const steps = ['The call', 'First draft', 'Two rounds of edits', 'Launch'];
const days = ['Day 1', 'Day 3', 'Days 4 to 6', 'Day 7'];
const opacity = (l: Locator) => l.evaluate((el) => Number(getComputedStyle(el).opacity));
/** Which step is being read (the others stay in the accessibility tree at opacity 0). */
const reading = (page: Page, i: number) => expect.poll(() => opacity(page.locator('.days-step').nth(i))).toBeGreaterThan(0.9);

test('scrolling runs the week: the call, the first draft, then the site goes live', async ({ page }) => {
  await page.goto('/sites', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'From first call to live site in about a week' })).toBeVisible();
  const pin = page.locator('.days-pin');
  const vh = page.viewportSize()!.height;
  const to = async (p: number) => {
    const { top, h } = await pin.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + scrollY, h: r.height };
    });
    await page.evaluate((y) => scrollTo(0, y), top + (h - vh) * p);
  };
  expect((await pin.boundingBox())!.height).toBeGreaterThan(vh * 3);

  await to(0.06);
  await reading(page, 0);
  await expect.poll(() => opacity(page.locator('.days-live'))).toBeLessThan(0.1);

  await to(0.33);
  await reading(page, 1);

  await to(1);
  await reading(page, 3);
  await expect.poll(() => opacity(page.locator('.days-live'))).toBeGreaterThan(0.9);
  // The address has written itself in.
  expect(await page.locator('.days-addr').evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--typed')))).toBe(1);
  // Every step is still a heading for screen readers, shown or not; the frame is one labelled image.
  for (const s of steps) await expect(page.getByRole('heading', { name: s, exact: true })).toHaveCount(1);
  await expect(page.locator('.days-frame')).toHaveAttribute('aria-hidden', 'true');
});

for (const mode of ['no JavaScript', 'reduced motion'] as const) {
  test(`${mode}: the days as a list beside the finished, live site, no pinning`, async ({ browser }) => {
    const ctx = await browser.newContext(mode === 'no JavaScript' ? { javaScriptEnabled: false } : { reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/sites', { waitUntil: 'networkidle' });
    const vh = page.viewportSize()!.height;
    expect((await page.locator('.days-pin').boundingBox())!.height).toBeLessThan(vh * 2.6);
    for (const s of steps) await expect(page.getByRole('heading', { name: s, exact: true })).toBeVisible();
    for (const d of days) await expect(page.locator('.days-when', { hasText: d })).toBeVisible();
    await expect(page.locator('.days-count')).toBeHidden();
    expect(await opacity(page.locator('.days-live'))).toBe(1);
    await ctx.close();
  });
}
