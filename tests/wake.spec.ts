import { expect, test } from '@playwright/test';

// The heat wake (components/Wake.tsx) and the pull on large visuals (components/Magnetic.tsx).

test('the wake costs nothing until someone moves, then answers the cursor', async ({ page }) => {
  await page.goto('/?tier=light', { waitUntil: 'networkidle' });
  const wake = page.locator('canvas.wake');
  // Untouched page (Lighthouse, a background tab): the simulation never started.
  await expect(wake).not.toHaveAttribute('data-on', '');
  await page.mouse.move(200, 400);
  await page.mouse.move(700, 300, { steps: 12 });
  await expect(wake).toHaveAttribute('data-on', '');
  // Something glows along the path.
  const lit = await wake.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++;
    return n;
  });
  expect(lit).toBeGreaterThan(10);
});

test('reduced motion: no wake at all', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.mouse.move(200, 400);
  await page.mouse.move(700, 300, { steps: 12 });
  await expect(page.locator('canvas.wake')).not.toHaveAttribute('data-on', '');
  await ctx.close();
});

test('phones get a menu with every page', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu).toBeVisible();
  for (const name of ['Crucible Sites', 'Ventures', 'Work']) await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
  await menu.getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  await ctx.close();
});

test('desktop has no menu button (the links are in the bar)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Menu' })).toBeHidden();
  await ctx.close();
});
