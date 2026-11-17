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

test('the Verge teaser and the home page card both link to /verge; the other cards keep their links', async ({ page }) => {
  await page.goto('/ventures/verge', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'See the preview' })).toHaveAttribute('href', '/verge');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const card = (name: string) => page.locator('a.wv-link').filter({ has: page.locator('.wv-name', { hasText: name }) });
  await expect(card('Verge')).toHaveAttribute('href', '/verge');
  await expect(card('Crucible Sites')).toHaveAttribute('href', '/sites');
  await expect(card('Trellis')).toHaveAttribute('href', '/ventures/trellis');
});

test('/verge is Verge’s own landing page, in its own words, with the waitlist where sign-up will be', async ({ page, request }) => {
  await page.goto('/verge', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle('Verge');
  await expect(page.locator('h1')).toHaveText('What to train today, and why');
  // Verge's own type, from its own font file.
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).fontFamily)).toMatch(/schibsted/i);

  // Its own header: Sign in and Create account, both to the waitlist, and nothing of Crucible's.
  const header = page.locator('header').first();
  await expect(header.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '#waitlist');
  // Create account and See how it decides are hidden on a phone, as in Verge.
  await expect(header.locator('a', { hasText: 'Create account' })).toHaveAttribute('href', '#waitlist');
  await expect(page.getByText('A Crucible venture')).toHaveCount(0);
  await expect(page.locator('a', { hasText: 'See how it decides' })).toHaveAttribute('href', '#decides');
  await expect(page.locator('#decides')).toHaveCount(1);

  const form = page.locator('form[name="verge-waitlist"]');
  await expect(form).toHaveCount(1);
  await expect(form.locator('input[name="email"]')).toHaveAttribute('required', '');
  await expect(form.locator('input[name="_gotcha"]')).toHaveCount(1);
  await expect(form.locator('input[name="form"]')).toHaveValue('verge-waitlist');
  expect(await form.locator('select[name="sport"] option').allTextContents()).toEqual(['Choose one', 'Running', 'Cycling', 'Triathlon', 'Cross-country skiing', 'Cyclocross', 'Other']);
  expect(await form.locator('select[name="wears"] option').allTextContents()).toEqual(['Choose one', 'Garmin', 'Apple Watch', 'Coros', 'Polar', 'Oura', 'Whoop', 'Other', 'None']);
  await expect(form.getByLabel('I’d like to be considered for the private beta.')).toHaveAttribute('type', 'checkbox');
  // The button comes after the optional fields, then the line about email.
  const order = await form.evaluate((f) =>
    ['input[name="email"]', 'select[name="sport"]', 'select[name="wears"]', 'input[name="beta"]', 'button[type="submit"]'].map((sel) => f.querySelector(sel)!.getBoundingClientRect().top),
  );
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await expect(form.getByText('We’ll only email you about Verge.')).toBeVisible();

  // The closing section, in Verge's words, with the one added line.
  const start = page.locator('section[aria-labelledby="start-title"]');
  await expect(start.locator('h2')).toHaveText('Start with the training you already have');
  await expect(start).toContainText('The more people sign up, the sooner it opens, because every email shows there are athletes waiting to use it.');
  await expect(start.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '#waitlist');
  await expect(page.getByText('Data from a service whose terms do not allow AI use, such as Strava')).toBeVisible();

  // The footer: Sign in to the waitlist, and who makes Verge, linking to Crucible's home.
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '#waitlist');
  await expect(footer.getByRole('link', { name: 'Crucible' })).toHaveAttribute('href', '/');
  await expect(footer).not.toContainText('never sold');

  // No prices, no device names in what Verge claims, no em dashes.
  const main = await page.locator('main').innerText();
  expect(main).not.toMatch(/\$\d/);
  expect(main).not.toMatch(/From Garmin/);
  expect(await page.locator('body').innerText()).not.toMatch(/—/);
  const urls = await page.evaluate(() => [...document.images].flatMap((img) => [img.getAttribute('src')!, ...img.srcset.split(',').map((s) => s.trim().split(' ')[0])]));
  for (const url of new Set(urls.filter((u) => u && u.startsWith('/')))) expect((await request.get(url)).status(), url).toBe(200);
});

test('/verge shows Verge’s Today screen in a phone, and nothing in it does anything', async ({ page }) => {
  await page.goto('/verge', { waitUntil: 'networkidle' });
  const phone = page.locator('.vg-phone');
  await expect(phone).toHaveCount(1);
  await expect(phone).toContainText('Easy run today. Your intervals moved to Tuesday.');
  await expect(phone.locator('xpath=following-sibling::figcaption')).toHaveText('Early design. The app will change before launch.');
  // The screen is a phone's width (390 px) where there's room, and narrows with the column where there isn't.
  const room = (await page.evaluate(() => innerWidth)) - 32 - 16;
  expect(Math.round((await page.locator('.vg-screen').boundingBox())!.width)).toBe(Math.min(390, room));
  // Inert: no buttons or fields, and every link goes to the waitlist without being a stop in the tab order.
  await expect(phone.locator('button, input, select, textarea, form')).toHaveCount(0);
  for (const a of await phone.locator('a').all()) {
    await expect(a).toHaveAttribute('href', '#waitlist');
    await expect(a).toHaveAttribute('tabindex', '-1');
  }
  // One heading outline for the page: the screen's headings are text.
  await expect(phone.locator('h1, h2, h3, h4')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveCount(1);
  // No device names in it.
  expect(await phone.innerText()).not.toMatch(/Garmin|Polar|Coros|Wahoo|Oura|Whoop|Apple/);
});

test('/verge loads only Verge: no Crucible CSS, font, liquid or floating text, and Verge’s own ring', async ({ page }) => {
  await page.goto('/verge', { waitUntil: 'networkidle' });
  expect(await page.locator('link[rel="stylesheet"]').count()).toBe(1);
  expect(await page.locator('link[rel="preload"][as="font"]').count()).toBe(1);
  expect(await page.locator('link[rel="preload"][as="font"]').getAttribute('href')).not.toMatch(/archivo/i);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => ((window as unknown as { __float?: { list(): unknown[] } }).__float?.list() ?? []).length)).toBe(0);
  // Rubber-banding on an iPhone shows the body's ground, Spruce: the root has no background of its own.
  expect(await page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor])).toEqual(['rgba(0, 0, 0, 0)', 'rgb(15, 59, 46)']);
  // The readiness markers move once (Verge's transform), never twice.
  for (const el of await page.locator('[class*="translate-"]').all()) expect(await el.evaluate((e) => getComputedStyle(e).translate)).toBe('none');
  // The focus ring on the light ground is Verge's dark ink, square.
  const signIn = page.locator('footer').getByRole('link', { name: 'Sign in' });
  await page.keyboard.press('Tab');
  await signIn.focus();
  const ring = await signIn.evaluate((el) => {
    const s = getComputedStyle(el);
    return { visible: el.matches(':focus-visible'), color: s.outlineColor, width: s.outlineWidth, radius: s.borderRadius };
  });
  expect(ring).toEqual({ visible: true, color: 'rgb(13, 42, 33)', width: '2px', radius: '0px' });
});

test('/verge has no sideways scroll on a 360 or a 390 phone, and the phone fits', async ({ browser }) => {
  for (const width of [360, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/verge', { waitUntil: 'networkidle' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width} sideways scroll`).toBeLessThanOrEqual(0);
    const box = (await page.locator('.vg-phone').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await ctx.close();
  }
});

test('the Verge waitlist checks the email in place, under the field', async ({ page }) => {
  await page.goto('/verge', { waitUntil: 'networkidle' });
  const form = page.locator('form[name="verge-waitlist"]');
  const email = form.locator('input[name="email"]');
  await form.getByRole('button', { name: 'Get early access' }).click();
  await expect(form.getByText('Add your email to get early access')).toBeVisible();
  await expect(email).toBeFocused();
  await email.fill('runner@');
  await form.getByRole('button', { name: 'Get early access' }).click();
  await expect(form.getByText('That email doesn’t look quite right')).toBeVisible();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAttribute('aria-describedby', 'waitlist-email-error');
  await email.fill('runner@example.com');
  await expect(form.getByText('That email doesn’t look quite right')).toHaveCount(0);
});

test('the Verge waitlist, with no form id, writes the request as an email: mail app, Gmail, Outlook or copied', async ({ page, context }) => {
  await page.goto('/verge', { waitUntil: 'networkidle' });
  const form = page.locator('form[name="verge-waitlist"]');
  test.skip(/formspree\.io/.test((await form.getAttribute('action')) ?? ''), 'Built with FORMSPREE_WAITLIST_ID: the form posts to Formspree instead.');
  await form.locator('input[name="email"]').fill('runner@example.com');
  await form.locator('select[name="sport"]').selectOption('Cross-country skiing');
  await form.locator('select[name="wears"]').selectOption('Coros');
  await form.getByLabel('I’d like to be considered for the private beta.').check();
  // Phones open the mail app straight away; that navigation is stopped here so the panel can be checked.
  await page.route('mailto:*', (route) => route.abort());
  await form.getByRole('button', { name: 'Get early access' }).click();

  const heading = page.getByRole('heading', { name: 'Send it from your email' });
  await expect(heading).toBeFocused();
  // On a computer it never says an app opened.
  await expect(page.locator('#waitlist')).not.toContainText(/opened\./);
  const mail = decodeURIComponent((await page.getByRole('link', { name: 'Mail app' }).getAttribute('href'))!);
  expect(mail).toMatch(/^mailto:[^?]+@crucibleinnovation\.com\?subject=Verge waitlist/);
  for (const line of ['Email: runner@example.com', 'Main sport: Cross-country skiing', 'Wears: Coros', 'Private beta: Yes']) expect(mail).toContain(line);
  expect(await page.getByRole('link', { name: 'Gmail' }).getAttribute('href')).toMatch(/^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=[^&]+&su=Verge%20waitlist&body=/);
  expect(await page.getByRole('link', { name: 'Outlook' }).getAttribute('href')).toMatch(/^https:\/\/outlook\.live\.com\/mail\/0\/deeplink\/compose\?to=[^&]+&subject=Verge%20waitlist&body=/);

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy message' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Subject: Verge waitlist');

  // Change my answers: back to the form, answers kept.
  await page.getByRole('button', { name: 'Change my answers' }).click();
  await expect(form).toBeVisible();
  await expect(form.locator('input[name="email"]')).toHaveValue('runner@example.com');
  await expect(form.locator('input[name="email"]')).toBeFocused();
  await expect(form.locator('select[name="wears"]')).toHaveValue('Coros');
  await expect(form.getByLabel('I’d like to be considered for the private beta.')).toBeChecked();
});

test('the Verge waitlist, with a form id, posts to Formspree and says so when the email is turned down', async ({ page }) => {
  await page.goto('/verge', { waitUntil: 'networkidle' });
  const form = page.locator('form[name="verge-waitlist"]');
  const action = (await form.getAttribute('action')) ?? '';
  test.skip(!/formspree\.io/.test(action), 'Built without FORMSPREE_WAITLIST_ID: sign-ups are emails.');
  let reply = { status: 422, body: { errors: [{ code: 'TYPE_EMAIL', field: 'email', message: 'should be an email' }] } };
  await page.route('https://formspree.io/**', (route) => route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) }));
  await form.locator('input[name="email"]').fill('runner@example.com');
  await form.getByRole('button', { name: 'Get early access' }).click();
  await expect(form.getByText('That email doesn’t look quite right')).toBeVisible();
  await expect(form.locator('input[name="email"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByRole('alert')).toHaveCount(0);
  reply = { status: 200, body: { ok: true } as never };
  await form.locator('input[name="email"]').fill('runner2@example.com');
  await form.getByRole('button', { name: 'Get early access' }).click();
  await expect(page.getByText('You’re on the list')).toBeVisible();
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

// It scrolls /work, which starts the page liquid: software GL queues frames here, so a browser of its own (tests/gl.ts).
worldTest('/work leads with the live client site: a real link, and its film plays with the scroll', async ({ page, request }) => {
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

test('no alloy beat; the founders\' posters on /, CRT portraits with faces on /sites', async ({ page }) => {
  for (const path of ['/', '/sites']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.alloy, [class*="AlloyBeat"], [data-alloy]')).toHaveCount(0);
    if (path === '/') {
      // each chapter opens on its founder's own poster, lazy and sized, both sizes there
      const posters = page.locator('.wch-poster img');
      await expect(posters).toHaveCount(2);
      for (const img of await posters.all()) {
        expect(await img.getAttribute('loading')).toBe('lazy');
        expect(Number(await img.getAttribute('width'))).toBeGreaterThan(0);
        for (const url of (await img.getAttribute('srcset'))!.split(',').map((x) => x.trim().split(' ')[0])) {
          expect((await page.request.get(url)).status(), url).toBe(200);
        }
      }
    }
    const portraits = page.locator('img[alt^="CRT "]');
    const n = await portraits.count();
    if (path === '/sites') expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      expect(await portraits.nth(i).getAttribute('src')).toMatch(/-crt\.webp/);
      expect(await portraits.nth(i).getAttribute('alt'), 'a face, not the "No signal" placeholder').toMatch(/^CRT portrait of /);
    }
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
