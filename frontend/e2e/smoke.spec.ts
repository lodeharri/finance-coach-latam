import { expect, test } from '@playwright/test';

/**
 * Smoke spec — proves the deploy pipeline serves a 200 from the Pages URL.
 *
 * PR1 ships this empty test (with `test.skip` when no BASE_URL is provided)
 * so CI sees a green e2e baseline. PR5 adds the real auth happy-path spec.
 */
test.describe('smoke', () => {
  test('placeholder — real specs land in PR5', async ({ page }) => {
    test.skip(!process.env.VITE_BASE_URL, 'Set VITE_BASE_URL to run e2e against a live deploy.');
    await page.goto('/');
    await expect(page).toHaveTitle(/Finance Coach LATAM/);
  });
});
