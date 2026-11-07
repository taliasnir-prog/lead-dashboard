// Infrastructure smoke test only: confirms the static server, Chromium and
// both viewports work. Real UI tests (AC-x.y) are added with each feature.
import { test, expect } from '@playwright/test';

test('infra: page loads over the static server, Hebrew RTL, no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));

  const response = await page.goto('./');
  expect(response.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('infra: viewport matches the project size', async ({ page }, testInfo) => {
  await page.goto('./');
  const width = await page.evaluate(() => window.innerWidth);
  expect(width).toBe(testInfo.project.name.endsWith('mobile') ? 375 : 1280);
});

test('infra: the page stays under the base path and loads every file from it', async ({ page, baseURL }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('./');
  await expect(page.locator('[data-testid="leads-table"] tbody tr')).not.toHaveCount(0);
  const base = new URL(baseURL);
  expect(new URL(page.url()).pathname).toBe(base.pathname);
  expect(base.pathname).toBe('/lead-dashboard/');
  const outside = requests.filter((u) => new URL(u).origin === base.origin && !new URL(u).pathname.startsWith(base.pathname));
  expect(outside).toEqual([]);
});

test('infra: the local server serves nothing at the domain root, like GitHub Pages for this repo', async ({ request, baseURL }) => {
  test.skip(Boolean(process.env.BASE_URL), 'local server only');
  const root = await request.get(new URL('/', baseURL).href);
  expect(root.status()).toBe(404);
  const blocked = await request.get(new URL('node_modules/', baseURL).href);
  expect(blocked.status()).toBe(404);
});
