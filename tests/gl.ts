import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

// Software GL (CI, cloud sessions) draws the home page's world at seconds a frame, and a test that steps, scrolls or
// wheels the world asks for frames much faster than that. The queue lives in the browser's GPU process, which every
// test in a Playwright worker shares, and it outlives the page: the NEXT test then times out just opening its context
// ("Test timeout of 30000ms exceeded while setting up context"). Tests that drive the world use this `test` instead:
// each one gets a browser of its own, closed with the test, so its queued frames go with it and the wait for that
// close counts against the test that queued them (its own fixture budget, not the 30 s of the test that comes next).
export const test = base.extend({
  context: [
    async (
      { playwright, browserName, launchOptions, contextOptions, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent, baseURL },
      use,
    ) => {
      const browser = await playwright[browserName].launch(launchOptions);
      const context = await browser.newContext({ ...contextOptions, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent, baseURL });
      await use(context);
      await browser.close();
    },
    { scope: 'test', timeout: 120_000 },
  ],
});
