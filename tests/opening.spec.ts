import { expect, test } from '@playwright/test';
import { RING } from '../lib/splitRing';

// The home opening (components/Ignition.tsx) and the runtime tiers (lib/tier.ts).

const readVar = (el: Element, name: string) => Number(getComputedStyle(el).getPropertyValue(name).trim() || 'NaN');

test('every visit gets the full version; only reduced motion gets the light one', async ({ page, browser }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'rich');
  // No probing for a fast device or connection: the 3D logo takes over as soon as the pour is done.
  await expect(page.locator('section.ig')).toHaveAttribute('data-3d', '', { timeout: 20000 });

  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const calm = await ctx.newPage();
  await calm.goto('/', { waitUntil: 'networkidle' });
  await expect(calm.locator('html')).toHaveAttribute('data-tier', 'light');
  await ctx.close();
});

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

test('the intro pours the mark in 3D (rich): the headline is held for the first 3D frame, then the flat ring steps aside', async ({ page }) => {
  await page.goto('/?tier=rich', { waitUntil: 'load' });
  const scene = page.locator('section.ig');
  await expect(scene).toHaveAttribute('data-3d', '', { timeout: 20_000 });
  // The headline and the metal start on the same frame: html[data-go] is set when the first 3D frame has drawn.
  await expect(page.locator('html')).toHaveAttribute('data-go', '', { timeout: 5000 });
  await expect(page.locator('.ig-pour')).toHaveCount(0);
  await expect.poll(() => page.locator('.ig-svg').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.01);
  await expect(page.locator('h1')).toBeVisible();
});

test('the light tier has no pour: the flat ring and the headline are simply there', async ({ page }) => {
  await page.goto('/?tier=light');
  await expect(page.locator('.ig-pour')).toHaveCount(0);
  await expect(page.locator('section.ig')).not.toHaveAttribute('data-3d', '');
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
  await expect(page.getByRole('heading', { name: 'Neither, alone' })).toBeVisible();
});

test('reduced motion: no pinning, every part finished and visible', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'light');
  const h = (await page.locator('section.ig').boundingBox())!.height;
  expect(h).toBeLessThan(800 * 2);
  await expect(page.locator('h1')).toBeVisible();
  for (const name of ['Not the person', 'Not the model']) await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Neither, alone' })).toBeVisible();
  // "alloyed." has finished cooling: the hot copy over it is gone. No pour: the ring is simply there.
  expect(await page.locator('.ig-cool').evaluate((el) => getComputedStyle(el, '::after').opacity)).toBe('0');
  await expect(page.locator('.ig-pour')).toHaveCount(0);
  expect(await page.locator('.ig-svg').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await ctx.close();
});

test('without JavaScript the opening is static and complete', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText(/Intelligence, alloyed/);
  await expect(page.getByRole('link', { name: /See Crucible Sites/ }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Neither, alone' })).toBeVisible();
  await expect(page.locator('.ig-svg')).toBeVisible();
  expect((await page.locator('section.ig').boundingBox())!.height).toBeLessThan(page.viewportSize()!.height * 2.5);
  await ctx.close();
});

test('ingot canvases exist only near the viewport and are released when far, and never with reduced motion', async ({ page, browser }) => {
  // The 3D ingots (components/IngotScene.tsx) replaced the CSS heat loops: the same intent, work only while on screen.
  const live = () => page.locator('#ventures .ing[data-on]').count();
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'rich');
  expect(await live()).toBe(0); // the ventures are far below the opening
  await page.locator('#ventures').scrollIntoViewIfNeeded();
  await page.locator('#ventures').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 200));
  await expect.poll(live, { timeout: 40000 }).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(live, { timeout: 20000 }).toBe(0);

  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const calm = await ctx.newPage();
  await calm.goto('/', { waitUntil: 'networkidle' });
  await calm.locator('#ventures').scrollIntoViewIfNeeded();
  await calm.waitForTimeout(1500);
  expect(await calm.locator('.ing[data-on]').count()).toBe(0);
  // The stills hold the layout instead.
  const still = calm.locator('#ventures .ing-still').first();
  await still.scrollIntoViewIfNeeded();
  expect(await still.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await ctx.close();
});

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

test('every page ends on a dark footer, and no page has a bone one', async ({ page }) => {
  for (const path of ['/', '/sites', '/ventures', '/ventures/verge', '/work']) {
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

test('no alloy beat and bone portraits on / and /sites', async ({ page }) => {
  for (const path of ['/', '/sites']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.alloy, [class*="AlloyBeat"], [data-alloy]')).toHaveCount(0);
    const portraits = page.locator('img[alt^="ASCII portrait"]');
    const n = await portraits.count();
    if (path === '/') expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) expect(await portraits.nth(i).getAttribute('src')).toMatch(/bone/);
    // Straight on the page, not on a bone card.
    await expect(page.locator('img[alt^="ASCII portrait"]').locator('xpath=ancestor::*[contains(@class,"bg-bone")]')).toHaveCount(0);
  }
});

test('reduced motion shows the static SVG logo and the ingot stills, with no canvases drawing', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await expect(page.locator('section.ig')).not.toHaveAttribute('data-3d', '');
  await expect(page.locator('section.ig .ig-svg')).toBeVisible();
  // The ring's 14 squares stay upright in the rendered logo: no transforms, and each one's on-screen box is exactly one
  // square (RING.px of the 64 units; a rotated square's box is larger).
  const cells = page.locator('.ig-svg rect');
  await expect(cells).toHaveCount(14);
  expect(await page.locator('.ig-svg [transform]').count()).toBe(0);
  const unit = ((await page.locator('.ig-svg').boundingBox())?.width ?? 0) / 64;
  expect(unit).toBeGreaterThan(0);
  for (let i = 0; i < 14; i++) {
    const b = (await cells.nth(i).boundingBox())!;
    expect(Math.abs(b.width - RING.px * unit), `cell ${i} width`).toBeLessThan(0.5);
    expect(Math.abs(b.height - RING.px * unit), `cell ${i} height`).toBeLessThan(0.5);
  }
  await expect(page.locator('.ig-svg .ig-human path')).toHaveCount(2);
  await expect(page.locator('.ig-3d')).toHaveCount(0);
  expect(await page.locator('.ing[data-on]').count()).toBe(0);
  expect(await page.locator('.ing-still').count()).toBeGreaterThan(0);
  await ctx.close();
});

test('ventures: the live one has set and links to /sites; the next ones glow in their moulds and have their own pages', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const panels = page.locator('#ventures .vf-panel');
  await expect(panels).toHaveCount(3);
  await expect(page.locator('#ventures [data-hot]')).toHaveCount(2);
  await expect(page.locator('#ventures').getByRole('link', { name: 'See Crucible Sites' })).toHaveAttribute('href', '/sites');
  for (const v of ['verge', 'trellis']) await expect(page.locator(`#ventures a.vf-link[href="/ventures/${v}"]`)).toHaveCount(1);
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

test.describe('rich tier', () => {
  // Every visit is rich anyway; these force it so they read plainly.
  test('forced rich: the transparent 3D logo takes over from the SVG once the pour is done and tells the story', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/?tier=rich', { waitUntil: 'networkidle' });
    const scene = page.locator('section.ig');
    await expect(scene).toHaveAttribute('data-3d', '', { timeout: 20000 });
    const opacity = (sel: string) => page.locator(sel).evaluate((el) => Number(getComputedStyle(el).opacity));
    await expect.poll(() => opacity('.ig-svg')).toBeLessThan(0.01);
    await expect.poll(() => opacity('.ig-3d')).toBeGreaterThan(0.99);
    // The canvas is transparent where there is no logo (no box) and draws the logo where there is.
    const probe = () =>
      // The canvas belongs to the scene worker (OffscreenCanvas), so read it back through a 2D canvas.
      page.locator('.ig-3d').evaluate((c: HTMLCanvasElement) => {
        const copy = document.createElement('canvas');
        copy.width = c.width;
        copy.height = c.height;
        const g = copy.getContext('2d')!;
        g.drawImage(c, 0, 0);
        return { corner: g.getImageData(1, 1, 1, 1).data[3], w: c.width, h: c.height };
      });
    expect((await probe()).corner, 'canvas corner is transparent').toBe(0);
    const box = (await scene.boundingBox())!;
    const vh = page.viewportSize()!.height;
    await page.evaluate((y) => scrollTo(0, y), (box.height - vh) * 0.3);
    await page.waitForTimeout(800);
    expect(await opacity('.ig-3d')).toBeGreaterThan(0.99);
    await page.evaluate((y) => scrollTo(0, y), box.height - vh);
    await page.waitForTimeout(800);
    expect(await opacity('.ig-3d')).toBeGreaterThan(0.99);
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

  test('forced rich: the Thesis lights its WebGL flames once it is on screen', async ({ page }) => {
    await page.goto('/?tier=rich', { waitUntil: 'networkidle' });
    await page.locator('section.thesis').scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy(0, 200));
    await expect(page.locator('section.thesis')).toHaveAttribute('data-gl', '', { timeout: 15000 });
  });

  test('light tier: the Thesis shows the static version and no film frames are downloaded', async ({ page }) => {
    const frames: string[] = [];
    page.on('request', (r) => /\/film\/(iron|ring)\/\d+\//.test(r.url()) && frames.push(r.url()));
    await page.goto('/?tier=light', { waitUntil: 'networkidle' });
    await page.locator('section.thesis').scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy(0, 400));
    await expect(page.locator('section.thesis')).not.toHaveAttribute('data-gl', '');
    await page.waitForTimeout(1000);
    expect(frames).toEqual([]);
  });

  test('no WebGL: the SVG ring stays and nothing breaks', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      // No OffscreenCanvas worker path either, so the main-thread fallback runs and finds no GL.
      // @ts-expect-error not part of the point
      HTMLCanvasElement.prototype.transferControlToOffscreen = undefined;
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
