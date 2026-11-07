import { expect, test, type Page } from '@playwright/test';

// The liquid (components/Liquid.tsx, lib/liquid/*), the floating (lib/liquid/float.ts) and the pull on large visuals
// (components/Magnetic.tsx, lib/liquid/lean.ts).

type Near = { slopeMax: number; slopeRms: number; hRms: number; cells: number };
const near = (page: Page, x: number, y: number, r = 120) =>
  page.evaluate(([x, y, r]) => (window as unknown as { __liquid: { near(x: number, y: number, r: number): Near } }).__liquid.near(x, y + scrollY, r), [x, y, r]);
// two frames of the one clock (the grid steps in the frame after the events arrive)
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

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
  const frameCount = () => liquid.evaluate((c) => Number((c as HTMLCanvasElement).dataset.frames ?? 0));
  const f0 = await frameCount();
  await expect.poll(frameCount).toBeGreaterThan(f0);
  // Moving makes waves.
  await page.mouse.move(200, 400);
  await page.mouse.move(700, 300, { steps: 24 });
  await page.mouse.down();
  await page.mouse.up();
  // Software GL draws a few frames a second at the lowest step, so only ask for "some".
  await expect.poll(() => liquid.evaluate((c) => Number((c as HTMLCanvasElement).dataset.live ?? 0)), { timeout: 20_000 }).toBeGreaterThan(2);
  // One clock: the liquid is a renderer on it, and a harness can wait for its frames.
  const clock = await page.evaluate(() => {
    const c = (window as unknown as { __clock?: { v: number; settle(t: number): Promise<void>; renderers(): { name: string }[]; now(): number } }).__clock;
    return c ? { v: c.v, names: c.renderers().map((r) => r.name), settle: typeof c.settle } : null;
  });
  expect(clock).toMatchObject({ v: 1, settle: 'function' });
  expect(clock!.names).toContain('liquid');
});

test('a cursor that keeps moving without a click always has waves right at it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a mouse cursor');
  await page.goto('/sites?tier=rich', { waitUntil: 'networkidle' });
  await expect(page.locator('canvas.liquid')).toHaveAttribute('data-on', '', { timeout: 10_000 });
  // Wander on a smooth closed path (no button pressed) and look at the surface around the cursor after every leg:
  // there must be a wave there every time, not only in the first second (v1 lost it after ~1.7 s).
  const cx = 720;
  const cy = 420;
  const at = (k: number) => [cx + Math.cos(k * 0.45) * 260, cy + Math.sin(k * 0.9) * 150] as const;
  await page.mouse.move(...at(0));
  const slopes: number[] = [];
  for (let k = 1; k <= 14; k++) {
    await page.mouse.move(...at(k), { steps: 6 });
    await frames(page);
    slopes.push((await near(page, ...at(k))).slopeMax);
  }
  for (const s of slopes) expect(s).toBeGreaterThan(0.02);
  // the waves are there because of the movement: they show up as recent sources near the cursor's path
  const kinds = await page.evaluate(() => (window as unknown as { __liquid: { sources(): { kind: string }[] } }).__liquid.sources().map((s) => s.kind));
  expect(kinds.filter((k) => k === 'move').length).toBeGreaterThan(10);
  expect(kinds).not.toContain('tap');
});

test('at rest the text keeps rocking on the swell, and links and buttons come to an exact rest', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a mouse cursor');
  await page.goto('/sites?tier=rich', { waitUntil: 'networkidle' });
  await expect(page.locator('canvas.liquid')).toHaveAttribute('data-on', '', { timeout: 10_000 });
  const h1 = page.locator('h1').first();
  await expect(h1).toHaveAttribute('data-fl', '', { timeout: 10_000 });
  // Nobody touches the page: the heading is never exactly still (the idle swell), and it moves smoothly.
  const offsets: [number, number, number][] = [];
  for (let i = 0; i < 12; i++) {
    offsets.push(await h1.evaluate((el) => {
      const t = getComputedStyle(el).translate.split(' ').map(parseFloat);
      return [t[0] || 0, t[1] || 0, parseFloat(getComputedStyle(el).rotate) || 0] as [number, number, number];
    }));
    await page.waitForTimeout(150);
  }
  const ys = offsets.map((o) => o[1]);
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.05);
  // Stir the liquid next to the primary button, then leave: within 2.5 s of the last input every control rests exactly
  // (no inline offset at all), so a click lands where the button is drawn.
  const btn = page.locator('main .btn-primary').first();
  await expect(btn).toHaveAttribute('data-fl-c', '');
  const b = (await btn.boundingBox())!;
  await page.mouse.move(b.x - 60, b.y + b.height / 2);
  await page.mouse.move(b.x + b.width + 60, b.y + b.height / 2, { steps: 20 });
  await page.mouse.move(b.x - 60, b.y + b.height / 2, { steps: 20 });
  await page.mouse.move(5, 5, { steps: 4 });
  const t0 = Date.now();
  await expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-fl-c]')].filter((el) => el.style.translate || el.style.rotate).length), { timeout: 2_500, intervals: [100] })
    .toBe(0);
  expect(Date.now() - t0).toBeLessThan(2_500);
});

test('a finger dragging the page (a native pan) still makes waves where it touches', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch');
  await page.goto('/?tier=rich', { waitUntil: 'networkidle' });
  await expect(page.locator('canvas.liquid')).toHaveAttribute('data-on', '', { timeout: 10_000 });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: y === undefined ? [] : [{ x: 200, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  const sy0 = await page.evaluate(() => scrollY);
  await touch('touchStart', 620);
  for (let y = 600; y >= 300; y -= 20) await touch('touchMove', y);
  // the browser took the pan: the page scrolled, the finger is still on the glass
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(sy0 + 50);
  await frames(page);
  const n = await near(page, 200, 300, 140);
  await touch('touchEnd');
  expect(n.slopeMax).toBeGreaterThan(0.02);
  const kinds = await page.evaluate(() => (window as unknown as { __liquid: { sources(): { kind: string }[] } }).__liquid.sources().map((s) => s.kind));
  expect(kinds).toContain('touch');
});

test('reduced motion: plain dark ground, no liquid', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.mouse.move(200, 400);
  await page.mouse.move(700, 300, { steps: 12 });
  await page.waitForTimeout(500);
  await expect(page.locator('canvas.liquid')).not.toHaveAttribute('data-on', '');
  // nothing floats either
  expect(await page.locator('[data-fl], [data-fl-c]').count()).toBe(0);
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
