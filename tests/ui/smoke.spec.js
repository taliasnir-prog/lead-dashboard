// Infrastructure smoke test only: confirms the static server, Chromium and
// both viewports work. Real UI tests (AC-x.y) are added with each feature.
import { test, expect } from '@playwright/test';

test('infra: page loads over the static server, Hebrew RTL, no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));

  const response = await page.goto('/');
  expect(response.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('infra: viewport matches the project size', async ({ page }, testInfo) => {
  await page.goto('/');
  const width = await page.evaluate(() => window.innerWidth);
  expect(width).toBe(testInfo.project.name === 'mobile' ? 375 : 1280);
});
