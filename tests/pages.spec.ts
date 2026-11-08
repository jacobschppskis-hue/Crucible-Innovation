import { expect, test } from '@playwright/test';

// The other pages and moving between them. The home page paints one world (lib/world): see tests/world.spec.ts.

test('venture pages: a freestanding ingot with a still fallback, and the share image is the casting', async ({ page }) => {
  for (const slug of ['verge', 'trellis']) {
    await page.goto(`/ventures/${slug}?tier=light`, { waitUntil: 'networkidle' });
    const img = page.locator('.vx-visual .ing-still');
    await expect(img).toHaveAttribute('src', `/film/ingots/${slug}-1200.webp`);
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(page.locator('.vx-visual .ing-canvas')).toHaveCount(1);
    await expect(page.locator('.vx-visual .ing[data-on]')).toHaveCount(0); // light tier: the still only
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`/og/${slug}\\.jpg$`));
  }
});

test('every other page ends on a dark footer, and no page has a bone one', async ({ page }) => {
  for (const path of ['/sites', '/ventures', '/ventures/verge', '/work']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const foot = page.locator('footer.foot');
    await expect(foot).toHaveCount(1);
    const { bg, fg } = await foot.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el.querySelector('.foot-mail')!).color }));
    const lum = (c: string) => {
      const [r, g, b, a = 1] = (c.match(/[\d.]+/g) ?? []).map(Number);
      return a === 0 ? 0 : (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    expect(lum(bg), `${path} footer background`).toBeLessThan(0.3);
    expect(lum(fg), `${path} footer text`).toBeGreaterThan(0.5);
  }
});

test('no alloy beat and CRT portraits on / and /sites', async ({ page }) => {
  for (const path of ['/', '/sites']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.alloy, [class*="AlloyBeat"], [data-alloy]')).toHaveCount(0);
    const portraits = page.locator('img[alt^="CRT "]');
    const n = await portraits.count();
    if (path === '/') expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) expect(await portraits.nth(i).getAttribute('src')).toMatch(/-crt\.webp/);
    // Straight on the page, not on a bone card.
    await expect(page.locator('img[alt^="CRT "]').locator('xpath=ancestor::*[contains(@class,"bg-bone")]')).toHaveCount(0);
  }
});

test('moving to /sites pours the next page in, then gets out of the way', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /See Crucible Sites/ }).first().click();
  await expect(page).toHaveURL(/\/sites$/);
  await expect(page.locator('h1')).toHaveText(/actually looks good/);
  await expect(page.locator('html')).not.toHaveAttribute('data-leaving', '');
  // The slide off the new page is a 760 ms CSS animation; the attribute goes when it ends. A busy CI runner can hold the
  // main thread for a second or two while /sites mounts, so this allows for that rather than timing the runner.
  await expect(page.locator('html')).not.toHaveAttribute('data-arriving', '', { timeout: 8000 });
  await expect(page.locator('.route-sheet')).toBeHidden();
  // Back is ordinary navigation (no sheet).
  await page.goBack();
  await expect(page.locator('h1')).toHaveText(/Intelligence, alloyed/);
  await expect(page.locator('.route-sheet')).toBeHidden();
});

test('going Back while the next page is still pouring in never leaves the sheet behind', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /See Crucible Sites/ }).first().click();
  await expect(page).toHaveURL(/\/sites$/);
  await page.goBack();
  await expect(page.locator('h1')).toHaveText(/Intelligence, alloyed/);
  await expect(page.locator('html')).not.toHaveAttribute('data-arriving', '', { timeout: 8000 });
  await expect(page.locator('.route-sheet')).toBeHidden();
});

test('the opening fits a 360 × 640 phone with no sideways scroll', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const path of ['/', '/sites']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} horizontal scroll`).toBeLessThanOrEqual(0);
  }
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // intro settled
  const cta = (await page.getByRole('link', { name: 'Our ventures' }).boundingBox())!;
  expect(cta.y + cta.height, 'both buttons on screen').toBeLessThanOrEqual(640);
  await ctx.close();
});
