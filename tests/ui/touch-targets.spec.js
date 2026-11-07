// SPEC section 4: on small screens every visible button is at least 44px high (and 44px wide),
// on the page and inside every dialog. Found in the final review: the "פרטים" button was 28px.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('mobile'), 'small screen only');
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+02:00'));
  await page.goto('/');
  await expect(page.locator('[data-testid="leads-table"] tbody tr')).toHaveCount(30);
});

/** Visible buttons under `root` that are smaller than 44x44. Checks every table row too. */
async function smallButtons(page, root = 'body') {
  return page.locator(root).evaluate((r) => [...r.querySelectorAll('button')]
    .filter((b) => b.checkVisibility() && !b.closest('dialog:not([open])'))
    .map((b) => ({ text: b.textContent.trim(), label: b.getAttribute('aria-label'), ...b.getBoundingClientRect().toJSON() }))
    .filter((b) => b.height < 44 || b.width < 44)
    .map((b) => `${b.label ?? b.text}: ${Math.round(b.width)}x${Math.round(b.height)}`));
}

test('AC-G.1 small screen: every button on the page is at least 44x44, including all 30 "פרטים" buttons', async ({ page }) => {
  await expect(page.getByTestId('details-button')).toHaveCount(30);
  expect(await smallButtons(page)).toEqual([]);
  const sizes = await page.getByTestId('details-button').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
});

test('AC-G.1 small screen: buttons in the empty state are at least 44x44', async ({ page }) => {
  await page.getByTestId('filter-query').fill('zzz');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  expect(await smallButtons(page)).toEqual([]);
});

test('AC-G.1 small screen: buttons in the add, edit and reset dialogs are at least 44x44', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  expect(await smallButtons(page, '[data-testid="lead-dialog"]')).toEqual([]);
  await page.keyboard.press('Escape');

  await page.locator('[data-testid="details-button"][data-id="L-009"]').click();
  expect(await smallButtons(page, '[data-testid="lead-dialog"]')).toEqual([]);
  await page.keyboard.press('Escape');

  await page.getByTestId('reset-button').click();
  expect(await smallButtons(page, '[data-testid="reset-dialog"]')).toEqual([]);
});
