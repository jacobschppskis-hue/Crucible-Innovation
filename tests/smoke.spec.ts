import { expect, test, type Page } from '@playwright/test';

const pages = [
  { path: '/', h1: /Exceptional people/ },
  { path: '/sites', h1: /actually looks good/ },
];

async function loadClean(page: Page, path: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const res = await page.goto(path, { waitUntil: 'networkidle' });
  return { res, errors };
}

for (const { path, h1 } of pages) {
  test(`${path} renders cleanly`, async ({ page }) => {
    const { res, errors } = await loadClean(page, path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(h1);
    expect(errors, 'console errors').toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, 'horizontal scroll').toBeLessThanOrEqual(0);
  });

  test(`${path} is readable without JavaScript`, async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    for (const el of await page.locator('[data-reveal]').all()) await expect(el).toHaveCSS('opacity', '1');
    await ctx.close();
  });
}

test('no "LLC" anywhere and no payment details', async ({ page }) => {
  for (const { path } of pages) {
    await page.goto(path);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/\bLLC\b|venmo|incorporated/i);
  }
});

test('the gradient accent paints every glyph (nothing clipped)', async ({ page }) => {
  await page.goto('/sites', { waitUntil: 'networkidle' });
  // Each molten word's padded box must reach past its glyphs: compare the box to the word's ink via a Range.
  const clipped = await page.locator('h1 .molten').evaluateAll((els) =>
    els.filter((el) => {
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const ink = range.getBoundingClientRect();
      const em = parseFloat(getComputedStyle(el).fontSize);
      return box.bottom < ink.bottom + 0.15 * em || box.left > ink.left - 0.1 * em;
    }).length,
  );
  expect(clipped).toBe(0);
});

test('quote form submits with the ?ref= tag', async ({ page }) => {
  let body = '';
  await page.route('https://formspree.io/**', async (route) => {
    body = route.request().postData() ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/sites?ref=card', { waitUntil: 'networkidle' });
  const form = page.locator('#start form');
  await expect(form.locator('input[name=_gotcha]')).toHaveCount(1);
  // The form only posts when a Formspree ID was set at build time; otherwise it shows the email fallback.
  const configured = (await form.getAttribute('action'))?.includes('formspree.io');
  await form.locator('input[name=name]').fill('Test Person');
  await form.locator('input[name=business]').fill('Test Co');
  await form.locator('input[name=email]').fill('test@example.com');
  await form.getByText('Redesign').click();
  await form.getByText('Not sure yet').click();
  await form.locator('textarea[name=message]').fill('Hello');
  await form.locator('button[type=submit]').click();
  if (configured) {
    await expect(page.getByText('Got it.')).toBeVisible();
    expect(body).toContain('card');
  } else {
    await expect(form.getByRole('alert')).toContainText('didn’t send');
  }
});

test('404 page', async ({ page }) => {
  const res = await page.goto('/this-does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByText(/survive/)).toBeVisible();
});
