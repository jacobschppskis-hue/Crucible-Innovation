import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the static export in out/ (run `npm run build` first).
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Scroll scenes ease toward the scroll position (lib/scroll.ts) and GPU-less runners draw a few frames a second.
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: {
      // An already-installed Chromium (e.g. cloud sessions whose browser is newer than the pinned Playwright).
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      // Headless Chromium only has WebGL through SwiftShader; the rich-tier tests need it.
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    },
  },
  webServer: { command: 'npx serve out -l 4173 --no-clipboard', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
