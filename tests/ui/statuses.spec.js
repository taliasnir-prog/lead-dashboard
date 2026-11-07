// AC-6.1 in full: the status is shown as text in every row, the filter has "הכל" + the 5 statuses,
// and the add and edit forms have exactly the 5 statuses. Found in the final review: the table part
// was only checked on a few rows.
import { test, expect } from '@playwright/test';

const STATUSES = ['חדש', 'נוצר קשר', 'במעקב', 'נסגר בהצלחה', 'נסגר ללא עסקה'];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+02:00'));
  await page.goto('./');
  await expect(page.locator('[data-testid="leads-table"] tbody tr')).toHaveCount(30);
});

test('AC-6.1 every one of the 30 rows shows its status as visible text matching the data', async ({ page }) => {
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('leadDashboard.v1')).leads);
  const expected = Object.fromEntries(stored.map((l) => [l.id, l.status]));
  const shown = await page.locator('[data-testid="leads-table"] tbody tr').evaluateAll((trs) => trs.map((tr) => {
    const badge = tr.querySelector('td[data-col="status"] .badge');
    return { id: tr.dataset.id, text: badge?.textContent.trim() ?? '', visible: Boolean(badge?.checkVisibility()) };
  }));
  expect(shown).toHaveLength(30);
  for (const { id, text, visible } of shown) {
    expect(visible, id).toBe(true);
    expect(STATUSES, id).toContain(text);
    expect(text, id).toBe(expected[id]);
  }
  // All 5 statuses appear in the demo data, so every badge style is covered.
  expect(new Set(shown.map((s) => s.text))).toEqual(new Set(STATUSES));
});

test('AC-6.1 status filter: "הכל" first, then exactly the 5 statuses', async ({ page }) => {
  const options = await page.getByTestId('filter-status').locator('option').evaluateAll((os) => os.map((o) => [o.value, o.textContent]));
  expect(options).toEqual([['', 'הכל'], ...STATUSES.map((s) => [s, s])]);
});

test('AC-6.1 add form: exactly the 5 statuses, no "הכל", default "חדש"', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  const options = await page.getByTestId('field-status').locator('option').evaluateAll((os) => os.map((o) => [o.value, o.textContent]));
  expect(options).toEqual(STATUSES.map((s) => [s, s]));
  await expect(page.getByTestId('field-status')).toHaveValue('חדש');
});

test('AC-6.1 edit form: exactly the 5 statuses for an open and for a closed lead', async ({ page }) => {
  for (const id of ['L-009', 'L-022', 'L-027']) {
    await page.locator(`[data-testid="details-button"][data-id="${id}"]`).click();
    const options = await page.getByTestId('field-status').locator('option').evaluateAll((os) => os.map((o) => [o.value, o.textContent]));
    expect(options, id).toEqual(STATUSES.map((s) => [s, s]));
    await page.keyboard.press('Escape');
  }
});
