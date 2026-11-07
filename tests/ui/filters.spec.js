// Search and filters (M4), the status filter options (part of M6) and the fact that
// cards and chart ignore filters (AC-2.3). Clock fixed to 07.11.2026.
import { test, expect } from '@playwright/test';

const FIXED_NOW = new Date('2026-11-07T10:00:00+02:00');
const STATUSES = ['חדש', 'נוצר קשר', 'במעקב', 'נסגר בהצלחה', 'נסגר ללא עסקה'];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('/');
  await expect(rows(page)).toHaveCount(30);
});

function rows(page) { return page.locator('[data-testid="leads-table"] tbody tr'); }
const rowIds = (page) => rows(page).evaluateAll((trs) => trs.map((tr) => tr.dataset.id));
const count = (page) => page.getByTestId('results-count');
const colValues = (page, col) => page.locator(`[data-testid="leads-table"] tbody td[data-col="${col}"]`).allTextContents();

async function snapshotSummary(page) {
  return {
    cards: await page.locator('.card-value').allTextContents(),
    chart: await page.getByTestId('bar-count').allTextContents(),
    chartLabel: await page.getByTestId('source-chart').getAttribute('aria-label'),
  };
}

test('AC-4.3 initial state: counter "מוצגים 30 מתוך 30 לידים", all fields on default', async ({ page }) => {
  await expect(count(page)).toHaveText('מוצגים 30 מתוך 30 לידים');
  await expect(page.getByTestId('filter-query')).toHaveValue('');
  for (const id of ['filter-status', 'filter-source', 'filter-rep']) await expect(page.getByTestId(id)).toHaveValue('');
  await expect(page.getByTestId('empty-state')).toBeHidden();
});

test('AC-4.1 search by part of the name, with spaces at the edges', async ({ page }) => {
  await page.getByTestId('filter-query').fill('  מור  ');
  expect(await rowIds(page)).toEqual(['L-009', 'L-028']);
  await expect(count(page)).toHaveText('מוצגים 2 מתוך 30 לידים');
  for (const name of await colValues(page, 'name')) expect(name).toContain('מור');
});

test('AC-4.2 status filter alone', async ({ page }) => {
  await page.getByTestId('filter-status').selectOption('במעקב');
  await expect(rows(page)).toHaveCount(7);
  for (const s of await colValues(page, 'status')) expect(s).toBe('במעקב');
  await expect(count(page)).toHaveText('מוצגים 7 מתוך 30 לידים');
});

test('AC-4.2 source filter alone', async ({ page }) => {
  await page.getByTestId('filter-source').selectOption('Google');
  await expect(rows(page)).toHaveCount(8);
  for (const s of await colValues(page, 'source')) expect(s).toBe('Google');
});

test('AC-4.2 rep filter alone', async ({ page }) => {
  await page.getByTestId('filter-rep').selectOption('נועה ברק');
  await expect(rows(page)).toHaveCount(8);
  for (const r of await colValues(page, 'rep')) expect(r).toBe('נועה ברק');
});

test('AC-4.2 all conditions together: status + source + rep + search', async ({ page }) => {
  await page.getByTestId('filter-status').selectOption('במעקב');
  await page.getByTestId('filter-source').selectOption('Facebook');
  await expect(rows(page)).toHaveCount(3);
  await page.getByTestId('filter-rep').selectOption('מאיה גל');
  await page.getByTestId('filter-query').fill('ק');
  expect(await rowIds(page)).toEqual(['L-015']);
  await expect(count(page)).toHaveText('מוצגים 1 מתוך 30 לידים');
});

test('AC-4.2 filtered table keeps the default priority order', async ({ page }) => {
  const allIds = await rowIds(page);
  await page.getByTestId('filter-source').selectOption('Facebook');
  const filtered = await rowIds(page);
  expect(filtered).toHaveLength(10);
  expect(filtered).toEqual(allIds.filter((id) => filtered.includes(id)));
});

test('AC-4.3 reset returns all leads, the default order and default values', async ({ page }) => {
  const original = await rowIds(page);
  await page.getByTestId('filter-query').fill('א');
  await page.getByTestId('filter-status').selectOption('חדש');
  await page.getByTestId('filter-source').selectOption('Google');
  await page.getByTestId('filter-rep').selectOption('איתי שמש');
  await page.getByTestId('filters-reset').click();
  expect(await rowIds(page)).toEqual(original);
  await expect(count(page)).toHaveText('מוצגים 30 מתוך 30 לידים');
  await expect(page.getByTestId('filter-query')).toHaveValue('');
  for (const id of ['filter-status', 'filter-source', 'filter-rep']) await expect(page.getByTestId(id)).toHaveValue('');
  await expect(page.getByTestId('filter-query')).toBeFocused();
});

test('AC-4.4 no results: clear message, reset button, no empty table', async ({ page }) => {
  await page.getByTestId('filter-query').fill('zzz');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(page.getByTestId('empty-state')).toContainText('לא נמצאו לידים שמתאימים לחיפוש');
  await expect(page.getByTestId('table-wrap')).toBeHidden();
  await expect(count(page)).toHaveText('מוצגים 0 מתוך 30 לידים');
  await page.getByTestId('empty-reset').click();
  await expect(rows(page)).toHaveCount(30);
  await expect(page.getByTestId('empty-state')).toBeHidden();
  await expect(page.getByTestId('table-wrap')).toBeVisible();
  await expect(page.getByTestId('filter-query')).toHaveValue('');
  await expect(page.getByTestId('filter-query')).toBeFocused();
});

test('AC-4.4 no results from a list combination (not only from search)', async ({ page }) => {
  await page.getByTestId('filter-status').selectOption('נסגר בהצלחה');
  await page.getByTestId('filter-rep').selectOption('נועה ברק');
  await page.getByTestId('filter-source').selectOption('Facebook');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(count(page)).toHaveText('מוצגים 0 מתוך 30 לידים');
});

test('AC-2.3 cards and chart do not change when filtering or when nothing matches', async ({ page }) => {
  const before = await snapshotSummary(page);
  await page.getByTestId('filter-source').selectOption('Google');
  expect(await snapshotSummary(page)).toEqual(before);
  await page.getByTestId('filter-status').selectOption('חדש');
  await page.getByTestId('filter-query').fill('zzz');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  expect(await snapshotSummary(page)).toEqual(before);
  expect(before.cards).toEqual(['30', '7', '5', '60,000 ₪']);
});

test('AC-6.1 (filter part) status filter has "הכל" and the 5 statuses', async ({ page }) => {
  const options = await page.getByTestId('filter-status').locator('option').allTextContents();
  expect(options).toEqual(['הכל', ...STATUSES]);
  const sources = await page.getByTestId('filter-source').locator('option').allTextContents();
  expect(sources).toEqual(['הכל', 'Facebook', 'Google', 'אתר', 'הפניה']);
  const reps = await page.getByTestId('filter-rep').locator('option').allTextContents();
  expect(reps).toEqual(['הכל', 'נועה ברק', 'איתי שמש', 'מאיה גל', 'עומר טל']);
});

test('AC-G.4 (filters) every filter field has a visible label', async ({ page }) => {
  const expected = {
    'filter-query': 'חיפוש לפי שם', 'filter-status': 'סטטוס', 'filter-source': 'מקור', 'filter-rep': 'נציג',
  };
  for (const [id, text] of Object.entries(expected)) {
    const field = page.getByTestId(id);
    const labels = await field.evaluate((f) => [...f.labels].map((l) => l.textContent.trim()));
    expect(labels).toEqual([text]);
    await expect(page.getByLabel(text, { exact: true })).toBeVisible();
  }
});

test('AC-G.4 (filters) keyboard: Tab order reaches every filter, typing and reset work', async ({ page }) => {
  const order = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement?.dataset?.testid ?? null);
    if (id && !order.includes(id)) order.push(id);
  }
  const expectedOrder = ['priority-help-button', 'filter-query', 'filter-status', 'filter-source', 'filter-rep', 'filters-reset', 'table-wrap'];
  expect(order.filter((id) => expectedOrder.includes(id))).toEqual(expectedOrder);

  // Type a search from the keyboard.
  await page.getByTestId('filter-query').focus();
  await page.keyboard.type('מור');
  await expect(count(page)).toHaveText('מוצגים 2 מתוך 30 לידים');
  // Enter inside the search must not reload the page or clear the search.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('filter-query')).toHaveValue('מור');
  await expect(count(page)).toHaveText('מוצגים 2 מתוך 30 לידים');

  // Change a list from the keyboard.
  await page.getByTestId('filter-status').focus();
  await page.keyboard.press('End'); // last option: נסגר ללא עסקה
  await expect(page.getByTestId('filter-status')).toHaveValue('נסגר ללא עסקה');
  expect(await rowIds(page)).toEqual(['L-028']);

  // Reset from the keyboard.
  await page.getByTestId('filters-reset').focus();
  await page.keyboard.press('Enter');
  await expect(rows(page)).toHaveCount(30);
  await page.getByTestId('filter-query').fill('zzz');
  await page.getByTestId('empty-reset').focus();
  await page.keyboard.press('Space');
  await expect(rows(page)).toHaveCount(30);
});

test('AC-G.1 (filters) small screen: filters stacked, no page scroll, also in the empty state', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('mobile'), 'mobile only');
  const ids = ['filter-query', 'filter-status', 'filter-source', 'filter-rep', 'filters-reset'];
  const boxes = [];
  for (const id of ids) boxes.push(await page.getByTestId(id).boundingBox());
  for (let i = 1; i < boxes.length; i += 1) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
  for (const b of boxes) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(375);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByTestId('filter-query').fill('zzz');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const emptyReset = await page.getByTestId('empty-reset').boundingBox();
  expect(emptyReset.x + emptyReset.width).toBeLessThanOrEqual(375);
});

test('AC-G.2 (filters) desktop: all filters and the reset button on one row, each at least 44px high', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('desktop'), 'desktop only');
  // Heights may differ by engine (WebKit draws selects taller), so only a minimum is required.
  const boxes = [];
  for (const id of ['filter-query', 'filter-status', 'filter-source', 'filter-rep', 'filters-reset']) {
    boxes.push(await page.getByTestId(id).boundingBox());
  }
  for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(44);
  // One row: the fields are bottom-aligned and every pair overlaps vertically.
  const bottoms = boxes.map((b) => Math.round(b.y + b.height));
  expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(2);
  const top = Math.max(...boxes.map((b) => b.y));
  const bottom = Math.min(...boxes.map((b) => b.y + b.height));
  expect(bottom).toBeGreaterThan(top);
});
