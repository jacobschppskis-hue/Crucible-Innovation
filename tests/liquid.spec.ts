import { expect, test } from '@playwright/test';

// The liquid (components/Liquid.tsx, lib/liquid/*) and the pull on large visuals (components/Magnetic.tsx).

test('the liquid starts after load, is alive on its own, and answers the cursor', async ({ page }) => {
  await page.goto('/?tier=rich', { waitUntil: 'networkidle' });
  const liquid = page.locator('canvas.liquid');
  await expect(liquid).toHaveAttribute('data-on', '', { timeout: 10_000 });
  // One fixed full-viewport canvas behind the page.
  const box = await liquid.evaluate((c) => {
    const s = getComputedStyle(c);
    return { pos: s.position, z: s.zIndex, ev: s.pointerEvents, w: c.clientWidth, h: c.clientHeight };
  });
  expect(box).toMatchObject({ pos: 'fixed', z: '-1', ev: 'none' });
  expect(box.w).toBeGreaterThan(300);
  // Animating with nobody touching it (the idle swell).
  const frames = () => liquid.evaluate((c) => Number((c as HTMLCanvasElement).dataset.frames ?? 0));
  const f0 = await frames();
  await expect.poll(frames).toBeGreaterThan(f0);
  // Moving makes waves.
  await page.mouse.move(200, 400);
  await page.mouse.move(700, 300, { steps: 12 });
  await expect.poll(() => liquid.evaluate((c) => Number((c as HTMLCanvasElement).dataset.live ?? 0))).toBeGreaterThan(3);
});

test('reduced motion: plain dark ground, no liquid', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.mouse.move(200, 400);
  await page.mouse.move(700, 300, { steps: 12 });
  await page.waitForTimeout(500);
  await expect(page.locator('canvas.liquid')).not.toHaveAttribute('data-on', '');
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
