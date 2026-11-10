import { expect, test, type Page } from '@playwright/test';
import { test as worldTest } from './gl';

// The home page: one world (lib/world) behind static, readable HTML, on a seamless scroll loop.
// The deep checks (frame walks, touch, contrast, perf) live in lab/qa (npm run qa:deep); these are the contract.

type W = { state(): { progress: number; y: number; looping: boolean; place: { name: string } }; go(p: number): void; hold(): void; step(ms: number): void; resume(): void };
const world = (page: Page) => page.evaluate(() => !!(window as unknown as { __world?: W }).__world);
async function start(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'load' });
  // software GL starts the world only on real first use: keep giving input until it is up (an input that lands before
  // React hydrates WorldMount's listeners is lost)
  let i = 0;
  await expect
    .poll(async () => {
      i++;
      await page.mouse.move(200 + (i % 7) * 9, 300 + (i % 3) * 7).catch(() => {});
      return world(page);
    }, { timeout: 30_000 })
    .toBe(true);
}
const state = (page: Page) => page.evaluate(() => (window as unknown as { __world: W }).__world.state());

test('the headline and nav paint without waiting for WebGL', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toHaveText(/Intelligence, alloyed/, { timeout: 4000 });
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('nav').first()).toBeVisible();
});

// The tests that drive the world run in a browser of their own (tests/gl.ts), so the frames they queue under software
// GL cannot hold up the next test.
worldTest('the world starts: one fixed canvas behind the page, on the one clock, no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await start(page);
  const c = await page.evaluate(() => {
    const el = document.querySelector('canvas.world') as HTMLCanvasElement | null;
    if (!el) return null;
    const s = getComputedStyle(el);
    return { pos: s.position, z: s.zIndex, ev: s.pointerEvents };
  });
  expect(c).toMatchObject({ pos: 'fixed', z: '-1', ev: 'none' });
  const names = await page.evaluate(() => (window as unknown as { __clock: { renderers(): { name: string }[] } }).__clock.renderers().map((r) => r.name));
  expect(names).toContain('world');
  // the page's own background (the artifact frame paints white otherwise)
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(255, 255, 255)');
  expect(errors).toEqual([]);
});

worldTest('the loop: scrolling past the bottom with the wheel or keys comes back to the top, and progress runs on', async ({ page, isMobile }) => {
  test.skip(isMobile, 'wheel and keyboard');
  test.setTimeout(150_000); // software GL handles one wheel tick per drawn frame: draw at the cheapest step
  await start(page, '/?q=8');
  expect((await state(page)).looping).toBe(true);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await page.evaluate((y) => scrollTo(0, y), max - 1200);
  await page.waitForTimeout(400);
  // wheel down until it wraps (software GL draws slowly, so wheel for distance, not a tick count)
  let wrapped = false;
  for (let i = 0; i < 120 && !wrapped; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(40);
    wrapped = (await page.evaluate(() => scrollY)) < max / 2;
  }
  expect(wrapped, 'the wheel wraps past the bottom').toBe(true);
  await expect.poll(async () => (await state(page)).place.name).toMatch(/hero|together/);
  // PageDown/Space wrap too
  await page.evaluate((y) => scrollTo(0, y), max - 600);
  await page.waitForTimeout(500);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  for (let i = 0; i < 6 && (await page.evaluate(() => scrollY)) > max / 2; i++) {
    await page.keyboard.press('PageDown');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __world: W }).__world.state().y), { timeout: 15_000 }).not.toBe(-1);
    await page.waitForTimeout(1500);
  }
  expect(await page.evaluate(() => scrollY)).toBeLessThan(max / 2);
});

test('reduced motion: a still world, no loop, the page simply ends', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await expect(page.locator('html')).not.toHaveAttribute('data-loop', '');
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await page.evaluate(() => scrollTo(0, 1e9));
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(max - 2);
  await ctx.close();
});

test('without JavaScript every word is readable and the loop copy is not shown', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-place="loop"]')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await ctx.close();
});

test("Jacob's line is on the page once, and the take-apart beats are gone", async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const text = await page.evaluate(() => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let s = '';
    for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement?.closest('script,style,[aria-hidden="true"]')) s += n.textContent + ' ';
    return s.replace(/\s+/g, ' ');
  });
  expect(text.match(/comes together earlier/g)?.length).toBe(1);
  expect(text).not.toMatch(/Not the person|Not the model|Neither, alone/);
  expect(text).not.toMatch(/\bLLC\b|venmo|incorporated/i);
  expect(text).not.toMatch(/\bfound\w*\b[^.]{0,80}\b(Tesla|SpaceX)\b/i);
});
