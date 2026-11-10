import { expect, test } from '@playwright/test';
import { test as worldTest } from './gl';

// The other pages and moving between them. The home page paints one world (lib/world): see tests/world.spec.ts.

test('venture pages: the metal monolith still (or the ingot still), and the share image is the casting', async ({ page }) => {
  for (const slug of ['verge', 'trellis']) {
    await page.goto(`/ventures/${slug}?tier=light`, { waitUntil: 'networkidle' });
    // the home page's monolith, rendered by our own world, as a transparent still; the old ingot still where none exists
    const img = page.locator('.vx-visual .vm-img, .vx-visual .ing-still').first();
    await expect(img).toHaveAttribute('src', new RegExp(`/film/(monoliths|ingots)/[a-z-]+-1200\\.webp$`));
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
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

test('/work leads with the live client site: a real link, and its film plays with the scroll', async ({ page, request }) => {
  await page.goto('/work', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toHaveText(/Out of the\s*crucible/);
  const plate = page.locator('article.wk-plate').first();
  await expect(plate.locator('h3')).toHaveText('Norma Custom Carpentry');
  await expect(plate.getByRole('link', { name: /Visit the site/ })).toHaveAttribute('href', 'https://normacustomcarpentry.com');
  await expect(plate.locator('.wk-url')).toHaveText('normacustomcarpentry.com');

  // Every screenshot is lazy, sized, and served at widths that exist.
  const imgs = await plate.locator('img').evaluateAll((els) =>
    (els as HTMLImageElement[]).map((el) => ({ lazy: el.loading, sized: !!el.getAttribute('width') && !!el.getAttribute('height'), urls: [el.getAttribute('src')!, ...el.srcset.split(',').map((s) => s.trim().split(' ')[0])].filter(Boolean) })),
  );
  expect(imgs.length).toBeGreaterThan(2);
  for (const img of imgs) expect(img.lazy === 'lazy' && img.sized, JSON.stringify(img)).toBe(true);
  for (const url of new Set(imgs.flatMap((i) => i.urls))) expect((await request.get(url)).status(), url).toBe(200);

  // Halfway through the film the middle moment is the one on screen, in the phone frame and in the caption.
  const film = plate.locator('.wk-film');
  const n = await film.locator('.wk-phone .wk-mo').count();
  expect(n).toBeGreaterThanOrEqual(3);
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(innerWidth >= 1024 ? '.wk-stack' : '.wk-reel')!;
    const r = el.getBoundingClientRect();
    scrollTo(0, r.top + scrollY + (r.height - innerHeight) / 2);
  });
  const mid = (n - 1) / 2;
  // A moment wipes up from the bottom of the screen: how much of its top is still clipped away, in percent.
  const clipped = (k: number) =>
    film.locator('.wk-phone .wk-mo').nth(k).evaluate((el) => parseFloat(/inset\(([\d.]+)%/.exec(getComputedStyle(el).clipPath)?.[1] ?? 'NaN'));
  const opacity = (k: number) => film.locator('.wk-moment').nth(k).evaluate((el) => Number(getComputedStyle(el).opacity));
  await expect.poll(() => clipped(mid)).toBe(0);
  expect(await clipped(mid + 1)).toBe(100);
  await expect.poll(() => opacity(mid)).toBe(1);
  expect(await opacity(0)).toBe(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow, 'horizontal scroll').toBeLessThanOrEqual(0);
});

test('/work without motion: the client site is still there, top of the page plus its other moments as stills', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/work', { waitUntil: 'networkidle' });
  const film = page.locator('.wk-film').first();
  await film.scrollIntoViewIfNeeded();
  const n = await film.locator('.wk-moment').count();
  await expect(film.locator('.wk-browser .wk-mo:visible')).toHaveCount(1);
  await expect(film.locator('.wk-thumb:visible')).toHaveCount(n - 1);
  await expect(film.locator('.wk-moment:visible p')).toHaveCount(n - 1);
  await ctx.close();
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

// The two tests below start on the home page and give it input, which starts its world (lib/world): under software GL
// it queues frames for seconds, so they run in a browser of their own (tests/gl.ts) and get the slow budget.
worldTest('moving to /sites pours the next page in, then gets out of the way', async ({ page }) => {
  test.slow();
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

worldTest('going Back while the next page is still pouring in never leaves the sheet behind', async ({ page }) => {
  test.slow();
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
