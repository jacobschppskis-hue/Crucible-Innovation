import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the static export in out/ (run `npm run build` first).
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'npx serve out -l 4173 --no-clipboard', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
