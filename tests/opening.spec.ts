import { expect, test } from '@playwright/test';

// The home opening (components/Ignition.tsx) and the runtime tiers (lib/tier.ts).

const readVar = (el: Element, name: string) => Number(getComputedStyle(el).getPropertyValue(name).trim() || 'NaN');

test('the tier can be forced from the URL', async ({ page }) => {
  await page.goto('/?tier=light');
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'light');
  await page.goto('/?tier=rich');
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'rich');
});

test('a repeat visit in the same session plays the quick intro', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-intro', 'quick');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'quick');
});

test('the intro pours the mark into a mould, then only the solid ring is left', async ({ page }) => {
  await page.goto('/?tier=light');
  const pour = page.locator('.ig-pour');
  await expect(pour).toBeVisible();
  await expect(pour.locator('.ig-cru')).toHaveCount(1);
  // Done: the pour layers are gone from the page (not just hidden) and the solid ring shows.
  await expect(pour).toBeHidden({ timeout: 20_000 });
  await expect(pour).toHaveCSS('display', 'none');
  await expect.poll(() => page.locator('.ig-svg').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
});

test('the scroll story ends fused: core lit, last line showing, headline out of the way', async ({ page }) => {
  await page.goto('/?tier=light', { waitUntil: 'networkidle' });
  const scene = page.locator('section.ig');
  const box = (await scene.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.height, 'pinned scene is tall').toBeGreaterThan(vh * 3);
  // Partway: the machine half has scattered and the headline has parted.
  await page.evaluate((y) => scrollTo(0, y), (box.height - vh) * 0.3);
  await expect.poll(() => scene.evaluate(readVar, '--sm')).toBeGreaterThan(0.9);
  await expect(scene).toHaveAttribute('data-out', '');
  // End: fused.
  await page.evaluate((y) => scrollTo(0, y), box.height - vh);
  await expect.poll(() => scene.evaluate(readVar, '--t3')).toBeGreaterThan(0.99);
  expect(await scene.evaluate(readVar, '--core')).toBeGreaterThan(0.99);
  expect(await scene.evaluate(readVar, '--sm')).toBeLessThan(0.01);
  expect(await scene.evaluate(readVar, '--sh')).toBeLessThan(0.01);
  await expect(page.getByRole('heading', { name: 'Neither, alone.' })).toBeVisible();
});

test('reduced motion: no pinning, every part finished and visible', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'light');
  const h = (await page.locator('section.ig').boundingBox())!.height;
  expect(h).toBeLessThan(800 * 2);
  await expect(page.locator('h1')).toBeVisible();
  for (const name of ['Not the person.', 'Not the model.']) await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Neither, alone.' })).toBeVisible();
  // "alloyed." has finished cooling: the hot copy over it is gone. No pour: the ring is simply there.
  expect(await page.locator('.ig-cool').evaluate((el) => getComputedStyle(el, '::after').opacity)).toBe('0');
  await expect(page.locator('.ig-pour')).toBeHidden();
  expect(await page.locator('.ig-svg').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await ctx.close();
});

test('without JavaScript the opening is static and complete', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText(/Intelligence, alloyed/);
  await expect(page.getByRole('link', { name: /See Crucible Sites/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Neither, alone.' })).toBeVisible();
  await expect(page.locator('.ig-pour')).toBeHidden();
  await expect(page.locator('.ig-svg')).toBeVisible();
  expect((await page.locator('section.ig').boundingBox())!.height).toBeLessThan(page.viewportSize()!.height * 2.5);
  await ctx.close();
});

test('furnace floors: heat only moves while it is on screen, and never with reduced motion', async ({ page, browser }) => {
  await page.goto('/?tier=light', { waitUntil: 'networkidle' });
  const floor = page.locator('.footer-giant .furnace');
  const waves = page.locator('.footer-giant .furnace-waves i').first();
  await expect(floor).not.toHaveAttribute('data-live', '');
  expect(await waves.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('paused');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(floor).toHaveAttribute('data-live', '');
  expect(await waves.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe('running');

  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const calm = await ctx.newPage();
  await calm.goto('/', { waitUntil: 'networkidle' });
  for (const sel of ['.footer-giant .furnace-waves i', '#ventures .molten-flow']) {
    expect(await calm.locator(sel).first().evaluate((el) => getComputedStyle(el).animationName), sel).toBe('none');
  }
  await ctx.close();
});

test('ventures: the live one pours in a labelled concept site; the rest are still forging', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const cast = page.locator('#ventures [data-cast]');
  await cast.scrollIntoViewIfNeeded();
  await expect(cast).toHaveAttribute('data-in', '');
  await expect(cast.getByText('Concept')).toBeVisible();
  await expect(page.locator('#ventures .forging-mark')).toHaveCount(2);
});

test('moving to /sites pours the next page in, then gets out of the way', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /See Crucible Sites/ }).click();
  await expect(page).toHaveURL(/\/sites$/);
  await expect(page.locator('h1')).toHaveText(/actually looks good/);
  await expect(page.locator('html')).not.toHaveAttribute('data-leaving', '');
  await expect(page.locator('html')).not.toHaveAttribute('data-arriving', '', { timeout: 3000 });
  await expect(page.locator('.route-sheet')).toBeHidden();
  // Back is ordinary navigation (no sheet).
  await page.goBack();
  await expect(page.locator('h1')).toHaveText(/Intelligence, alloyed/);
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

test.describe('rich tier', () => {
  // Headless Chromium's WebGL is SwiftShader, which the tier check rightly rejects, so these force the tier.
  test('forced rich: solid at rest, melts into dots for the story, sets solid at the end', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/?tier=rich', { waitUntil: 'networkidle' });
    const scene = page.locator('section.ig');
    await expect(scene).toHaveAttribute('data-gl', '', { timeout: 15000 });
    const opacity = (sel: string) => page.locator(sel).evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(await opacity('.ig-svg')).toBe(1);
    const box = (await scene.boundingBox())!;
    const vh = page.viewportSize()!.height;
    await page.evaluate((y) => scrollTo(0, y), (box.height - vh) * 0.3);
    await expect.poll(() => opacity('.ig-svg')).toBeLessThan(0.01);
    await page.evaluate((y) => scrollTo(0, y), box.height - vh);
    await expect.poll(() => opacity('.ig-svg')).toBeGreaterThan(0.99);
    expect(errors).toEqual([]);
  });

  test('light tier never downloads any WebGL code, on either page', async ({ page }) => {
    for (const path of ['/', '/sites']) {
      const urls: string[] = [];
      page.on('request', (r) => urls.push(r.url()));
      await page.goto(`${path}?tier=light`, { waitUntil: 'networkidle' });
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(2500);
      await expect(page.locator('[data-gl]')).toHaveCount(0);
      const js = await Promise.all(urls.filter((u) => u.endsWith('.js')).map((u) => page.evaluate((x) => fetch(x).then((r) => r.text()), u)));
      expect(js.some((src) => src.includes('gl_FragColor')), `${path}: shader source fetched`).toBe(false);
      page.removeAllListeners('request');
    }
  });

  test('forced rich: the Thesis runs molten iron once it is on screen', async ({ page }) => {
    await page.goto('/?tier=rich', { waitUntil: 'networkidle' });
    await page.locator('section.thesis').scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy(0, 200));
    await expect(page.locator('section.thesis')).toHaveAttribute('data-gl', '', { timeout: 15000 });
  });

  test('no WebGL: the SVG ring stays and nothing breaks', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error narrowing the overloads is not the point here
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        return /webgl/.test(type) ? null : get.call(this, type, ...rest);
      };
    });
    await page.goto('/?tier=rich', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await expect(page.locator('section.ig')).not.toHaveAttribute('data-gl', '');
    await expect(page.locator('.ig-svg')).toHaveCSS('opacity', '1');
    expect(errors).toEqual([]);
  });
});
