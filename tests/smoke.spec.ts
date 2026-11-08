import { expect, test, type Page } from '@playwright/test';

const pages = [
  { path: '/', h1: /Intelligence, alloyed/ },
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

test('no horizontal scroll anywhere down the page, once every effect canvas has been created', async ({ page }) => {
  for (const { path } of pages) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 700) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - document.documentElement.clientWidth);
    expect(overflow, `${path} horizontal scroll after scrolling through`).toBeLessThanOrEqual(0);
  }
});

test('no "LLC" anywhere and no payment details', async ({ page }) => {
  for (const { path } of pages) {
    await page.goto(path);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/\bLLC\b|venmo|incorporated/i);
  }
});

test('quote form: package card preselects the package, and the request is written for the visitor', async ({ page }) => {
  let body = '';
  await page.route('https://formspree.io/**', async (route) => {
    body = route.request().postData() ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/sites?ref=card', { waitUntil: 'networkidle' });
  // "Get a quote" on Alloy jumps to the form with Alloy selected.
  await page.locator('#pricing article').filter({ hasText: 'Alloy' }).getByRole('link', { name: 'Get a quote' }).click();
  const form = page.locator('#start form');
  await expect(form.locator('input[name=package][value^="Alloy"]')).toBeChecked();
  await expect(form.locator('input[name=_gotcha]')).toHaveCount(1);
  const configured = (await form.getAttribute('action'))?.includes('formspree.io');
  // One question at a time: Enter or Next moves on once the answer is there.
  const next = form.getByRole('button', { name: /^(Next|Skip|Review)/ });
  await next.click();
  await expect(form.locator('.qf-msg', { hasText: 'We need a name to reply to' })).toBeVisible();
  await expect(form.locator('input[name=name]')).toHaveAttribute('aria-invalid', 'true');
  await form.locator('input[name=name]').fill('Test Person');
  await form.locator('input[name=name]').press('Enter');
  await form.locator('input[name=business]').fill('Test Co');
  await form.locator('input[name=business]').press('Enter');
  await form.locator('input[name=email]').fill('test@example.com');
  await next.click();
  await next.click(); // no website yet: Skip
  await form.getByText('Redesign').click();
  await next.click();
  await expect(form.locator('input[name=package][value^="Alloy"]')).toBeChecked();
  await next.click();
  await form.locator('textarea[name=message]').fill('Hello');
  await next.click();
  await expect(form.getByText('Does this look right?')).toBeVisible();
  await form.locator('button[type=submit]').click();
  if (configured) {
    await expect(page.getByText('Got it', { exact: true })).toBeVisible();
    expect(body).toContain('card');
    return;
  }
  // No Formspree: the email is composed and offered via mail app, Gmail, Outlook or copy.
  await expect(page.getByText('Send it your way', { exact: true })).toBeVisible();
  const mailto = await page.getByRole('link', { name: 'Mail app' }).getAttribute('href');
  expect(mailto).toMatch(/^mailto:jacob@crucibleinnovation\.com\?subject=/);
  const decoded = decodeURIComponent(mailto!);
  expect(decoded).toContain('Quote request: Alloy · Test Co');
  expect(decoded).toContain('Looking for: Redesign');
  expect(decoded).toContain('ref: card');
  expect(await page.getByRole('link', { name: 'Gmail' }).getAttribute('href')).toContain('mail.google.com');
  expect(await page.getByRole('link', { name: 'Outlook' }).getAttribute('href')).toContain('outlook.live.com');
});

test('quote form without JavaScript: every question shows and the form opens a mail app', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/sites');
  const form = page.locator('#start form');
  await form.scrollIntoViewIfNeeded();
  for (const name of ['name', 'business', 'email', 'phone', 'website', 'message']) await expect(form.locator(`[name=${name}]`)).toBeVisible();
  await expect(form.getByText('Redesign')).toBeVisible();
  await expect(form.getByText('Alloy')).toBeVisible();
  await expect(form.locator('button[type=submit]')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Next' })).toBeHidden();
  expect(await form.getAttribute('action')).toMatch(/^mailto:|formspree\.io/);
  await ctx.close();
});

test('on /sites the logo goes to Crucible and "sites" goes to Crucible Sites', async ({ page }) => {
  await page.goto('/sites');
  await expect(page.getByRole('link', { name: 'Crucible home' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'Crucible Sites home' })).toHaveAttribute('href', '/sites');
});

test('404 page', async ({ page }) => {
  const res = await page.goto('/this-does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByText(/survive/)).toBeVisible();
});
