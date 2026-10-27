import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the static export in out/ (run `npm run build` first).
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // PW_CHROMIUM_PATH: use an already-installed Chromium (e.g. cloud sessions whose browser is newer than the pinned Playwright).
  use: { baseURL: 'http://localhost:4173', launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined } },
  webServer: { command: 'npx serve out -l 4173 --no-clipboard', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
