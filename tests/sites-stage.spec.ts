import { expect, test } from '@playwright/test';

// The /sites opening (components/BuildStage.tsx): a live concept site that is cast, turned into a phone and recast.

const captions = ['Built for the phone in their pocket.', 'Not a template.', 'Then it’s yours.'];
/** Which caption is showing (hidden ones stay in the accessibility tree at opacity 0). */
const shown = (page: import('@playwright/test').Page, i: number) =>
  expect.poll(() => page.locator('.bs-cap').nth(i).evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);

test('one h1 on /sites (the live concept sites are decorative)', async ({ page }) => {
  await page.goto('/sites');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.bs-screen')).toHaveAttribute('aria-hidden', 'true');
});

test('scrolling turns the frame into a phone, then recasts it as other businesses', async ({ page }) => {
  await page.goto('/sites', { waitUntil: 'networkidle' });
  const scene = page.locator('section.bs');
  const device = page.locator('.bs-device');
  const box = (await scene.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.height).toBeGreaterThan(vh * 3);
  const to = (f: number) => page.evaluate((y) => scrollTo(0, y), (box.height - vh) * f);

  await to(0.3);
  await expect(device).toHaveAttribute('data-layout', 'phone');
  const phone = (await device.boundingBox())!;
  expect(phone.height, 'phone is taller than wide').toBeGreaterThan(phone.width * 1.5);
  await shown(page, 0);
  await expect(scene).toHaveAttribute('data-out', '');

  await to(0.6);
  await expect(scene).toHaveAttribute('data-theme', 'barber');
  await shown(page, 1);

  await to(0.98);
  await expect(scene).toHaveAttribute('data-theme', 'landscaper');
  await expect(device).toHaveAttribute('data-layout', 'desktop');
  await shown(page, 2);
  await expect(page.locator('.bs-type')).toContainText('Concept');
  // Every caption is still a heading for screen readers, shown or not.
  for (const c of captions) await expect(page.getByRole('heading', { name: c })).toHaveCount(1);
});

for (const mode of ['no JavaScript', 'reduced motion'] as const) {
  test(`${mode}: hero, finished café and all three captions, no pinning`, async ({ browser }) => {
    const ctx = await browser.newContext(mode === 'no JavaScript' ? { javaScriptEnabled: false } : { reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/sites', { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toBeVisible();
    for (const c of captions) await expect(page.getByRole('heading', { name: c })).toBeVisible();
    const vh = page.viewportSize()!.height;
    expect((await page.locator('section.bs').boundingBox())!.height).toBeLessThan(vh * 2.6);
    // The finished café is what shows (not the blueprint or an empty frame).
    const fin = page.locator('.bs-c1 .bs-fin');
    await expect(fin).toBeVisible();
    expect(await fin.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    await ctx.close();
  });
}
