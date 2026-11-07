// Issue #4: the 500-lead limit (AC-5.7) and saving all 500 leads (AC-10.8).
import { test, expect } from '@playwright/test';

const KEY = 'leadDashboard.v1';
const LIMIT = 'הגעתם למגבלה של 500 לידים. אי אפשר להוסיף ליד חדש, אבל אפשר להמשיך לערוך לידים קיימים.';

function rows(page) { return page.locator('[data-testid="leads-table"] tbody tr'); }
const count = (page) => page.getByTestId('results-count');

/** Replaces the stored leads with `n` valid leads (L-001..), then reloads. */
async function seed(page, n) {
  await page.evaluate(({ k, n: total }) => {
    const demo = JSON.parse(localStorage.getItem(k)).leads;
    const leads = Array.from({ length: total }, (_, i) => ({
      ...demo[i % demo.length], id: `L-${String(i + 1).padStart(3, '0')}`, name: `ליד מספר ${i + 1}`,
    }));
    localStorage.setItem(k, JSON.stringify({ version: 1, leads }));
  }, { k: KEY, n });
  await page.reload();
  await expect(count(page)).toHaveText(`מוצגים ${n} מתוך ${n} לידים`);
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(90_000); // 500 rows are slower to render in Firefox and WebKit
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+02:00'));
  await page.goto('/');
  await expect(rows(page)).toHaveCount(30);
});

test('AC-5.7 with 499 leads the 500th is added and saved; then adding is blocked with a message', async ({ page }) => {
  await seed(page, 499);
  await expect(page.getByTestId('add-lead-button')).toBeEnabled();
  await expect(page.getByTestId('add-limit')).toBeHidden();

  await page.getByTestId('add-lead-button').click();
  await page.getByTestId('field-name').fill('הליד החמש מאות');
  await page.getByTestId('field-source').selectOption('הפניה');
  await page.getByTestId('field-rep').selectOption('נועה ברק');
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('lead-dialog')).toBeHidden();
  await expect(page.getByTestId('flash')).toHaveText('הליד L-500 נוסף ונשמר.');
  await expect(count(page)).toHaveText('מוצגים 500 מתוך 500 לידים');

  await expect(page.getByTestId('add-lead-button')).toBeDisabled();
  await expect(page.getByTestId('add-limit')).toBeVisible();
  await expect(page.getByTestId('add-limit')).toHaveText(LIMIT);
  await expect(page.getByTestId('add-lead-button')).toHaveAttribute('aria-describedby', 'add-limit');
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).leads.length, KEY);
  expect(stored).toBe(500);
});

test('AC-5.7 at 500 leads: button disabled on load, a forced click opens nothing, editing still works', async ({ page }) => {
  await seed(page, 500);
  await expect(page.getByTestId('add-lead-button')).toBeDisabled();
  await expect(page.getByTestId('add-limit')).toHaveText(LIMIT);
  await page.getByTestId('add-lead-button').click({ force: true });
  await page.getByTestId('add-lead-button').dispatchEvent('click');
  await expect(page.getByTestId('lead-dialog')).toBeHidden();
  await expect(count(page)).toHaveText('מוצגים 500 מתוך 500 לידים');

  await page.locator('[data-testid="details-button"][data-id="L-250"]').click();
  await page.getByTestId('field-notes').fill('עריכה במגבלה');
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('flash')).toHaveText('השינויים בליד L-250 נשמרו.');
  const note = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).leads.find((l) => l.id === 'L-250').notes, KEY);
  expect(note).toBe('עריכה במגבלה');
});

test('AC-5.7 the add logic itself refuses a 501st lead, not only the disabled button', async ({ page }) => {
  await seed(page, 499);
  await page.getByTestId('add-lead-button').click();
  await page.getByTestId('field-name').fill('הליד החמש מאות');
  await page.getByTestId('field-source').selectOption('הפניה');
  await page.getByTestId('field-rep').selectOption('נועה ברק');
  await page.getByTestId('dialog-save').click(); // the 500th lead is allowed
  await expect(count(page)).toHaveText('מוצגים 500 מתוך 500 לידים');
  await expect(page.getByTestId('add-lead-button')).toBeDisabled();

  // Bypass the disabled button on purpose: reopen the add dialog from script, the way a stale
  // second tab or a future bug might, and try to save a 501st lead. The save logic must refuse it.
  await page.evaluate(() => document.querySelector('[data-testid="lead-dialog"]').showModal());
  await page.getByTestId('field-name').fill('ליד 501');
  await page.getByTestId('field-source').selectOption('הפניה');
  await page.getByTestId('field-rep').selectOption('נועה ברק');
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('form-error')).toHaveText(LIMIT);
  await expect(page.getByTestId('lead-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(count(page)).toHaveText('מוצגים 500 מתוך 500 לידים');
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).leads.length, KEY);
  expect(stored).toBe(500);
});

test('AC-10.8 all 500 leads are kept after reload, without the "invalid data" notice', async ({ page }) => {
  await seed(page, 500);
  await page.reload();
  await expect(count(page)).toHaveText('מוצגים 500 מתוך 500 לידים');
  await expect(page.getByTestId('storage-invalid')).toBeHidden();
  await expect(page.getByTestId('storage-rejected')).toBeHidden();
  await expect(page.locator('[data-testid="leads-table"] tbody tr[data-id="L-500"]')).toHaveCount(1);
});
