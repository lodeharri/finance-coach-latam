import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — e2e against the deployed Pages preview URL or local dev.
 *
 * PR1 ships only the skeleton + a passing empty test so CI baseline is green.
 * Real specs (auth happy path, admin 403) land in PR5.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.VITE_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
