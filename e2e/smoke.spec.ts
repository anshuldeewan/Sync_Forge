import { test, expect } from '@playwright/test';

test('Minimal smoke test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SyncForge/i);
});
