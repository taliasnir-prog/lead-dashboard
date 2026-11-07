// Read-only dashboard view (M1, M2, M3, M7, M8, M9 and the cross-cutting G criteria).
// The browser clock is fixed to 07.11.2026 (Asia/Jerusalem, see playwright.config.js).
import { test, expect } from '@playwright/test';

const FIXED_NOW = new Date('2026-11-07T10:00:00+02:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('/');
  await expect(page.locator('[data-testid="leads-table"] tbody tr')).toHaveCount(30);
});

const rows = (page) => page.locator('[data-testid="leads-table"] tbody tr');
const row = (page, id) => page.locator(`[data-testid="leads-table"] tbody tr[data-id="${id}"]`);
const cell = (page, id, col) => row(page, id).locator(`td[data-col="${col}"]`);

test('AC-1.1 first load shows 30 leads with unique ids', async ({ page }) => {
  const ids = await rows(page).evaluateAll((trs) => trs.map((tr) => tr.dataset.id));
  expect(ids).toHaveLength(30);
  expect(new Set(ids).size).toBe(30);
});

test('AC-1.4 demo-data notice is visible at the top', async ({ page }) => {
  const banner = page.getByTestId('demo-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('נתוני דמה');
  await expect(banner).toContainText('פיקטיביים');
  const box = await banner.boundingBox();
  expect(box.y).toBeLessThan(250);
});

test('AC-2.1 summary cards: 30, 7, 5 and 60,000 ₪', async ({ page }) => {
  await expect(page.getByTestId('metric-total')).toHaveText('30');
  await expect(page.getByTestId('metric-new')).toHaveText('7');
  await expect(page.getByTestId('metric-won')).toHaveText('5');
  await expect(page.getByTestId('metric-won-value')).toHaveText('60,000 ₪');
  await expect(page.getByText('המדדים מחושבים על כלל הלידים ואינם מושפעים מהסינון')).toBeVisible();
});

test('AC-3.1 table has the 9 columns in order, value and date formats', async ({ page }) => {
  const headers = await page.locator('[data-testid="leads-table"] thead th').allTextContents();
  expect(headers.map((h) => h.trim())).toEqual([
    'מזהה', 'שם', 'מקור', 'נציג', 'סטטוס', 'רמת עניין', 'שווי צפוי', 'מעקב הבא', 'עדיפות',
  ]);
  await expect(cell(page, 'L-022', 'value')).toHaveText('12,000 ₪');
  await expect(cell(page, 'L-001', 'followUp')).toContainText('05/11/2026');
  await expect(cell(page, 'L-003', 'followUp')).toHaveText('לא נקבע');
  await expect(cell(page, 'L-003', 'status')).toHaveText('חדש');
});

test('AC-3.2 default order: highest priority first, closed leads last', async ({ page }) => {
  const ids = await rows(page).evaluateAll((trs) => trs.map((tr) => tr.dataset.id));
  expect(ids[0]).toBe('L-001');
  expect(ids.slice(21)).toEqual(['L-022', 'L-023', 'L-024', 'L-025', 'L-026', 'L-027', 'L-028', 'L-029', 'L-030']);
});

test('AC-7.3 overdue leads show "באיחור"; today, no date and closed leads do not', async ({ page }) => {
  const overdueIds = await page.locator('tr:has([data-testid="overdue-tag"])')
    .evaluateAll((trs) => trs.map((tr) => tr.dataset.id).sort());
  expect(overdueIds).toEqual(['L-001', 'L-008', 'L-010', 'L-016', 'L-017']);
  await expect(cell(page, 'L-001', 'followUp')).toContainText('באיחור');
  await expect(row(page, 'L-001')).toHaveClass(/is-overdue/);
  await expect(cell(page, 'L-002', 'followUp')).toHaveText('07/11/2026'); // today: no tag
  await expect(cell(page, 'L-003', 'followUp')).not.toContainText('באיחור'); // no date
  await expect(cell(page, 'L-022', 'followUp')).not.toContainText('באיחור'); // closed, past date
  await expect(row(page, 'L-022')).not.toHaveClass(/is-overdue/);
});

test('AC-8 priority shown as text: level and score, closed leads "לא בתעדוף"', async ({ page }) => {
  await expect(cell(page, 'L-001', 'priority')).toHaveText('גבוהה(7)');
  await expect(cell(page, 'L-015', 'priority')).toHaveText('נמוכה(2)');
  await expect(cell(page, 'L-003', 'priority')).toHaveText('בינונית(3)');
  await expect(cell(page, 'L-022', 'priority')).toHaveText('לא בתעדוף');
});

test('AC-8.4 priority explanation opens and closes with the keyboard', async ({ page }) => {
  const button = page.getByTestId('priority-help-button');
  const panel = page.getByTestId('priority-help');
  await expect(panel).toBeHidden();

  let reached = false;
  for (let i = 0; i < 10 && !reached; i += 1) {
    await page.keyboard.press('Tab');
    reached = await button.evaluate((b) => document.activeElement === b);
  }
  expect(reached).toBe(true);

  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('רמת העניין');
  await expect(panel).toContainText('באיחור 3, היום 2');
  await expect(panel).toContainText('5 ומעלה גבוהה, 3 עד 4 בינונית, עד 2 נמוכה');
  await expect(panel).toContainText('לידים סגורים לא בתעדוף');

  await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
});

test('AC-9.1 chart shows each source with a visible name and count', async ({ page }) => {
  const expected = { Facebook: '10', Google: '8', 'אתר': '7', 'הפניה': '5' };
  for (const [source, count] of Object.entries(expected)) {
    const bar = page.locator(`[data-testid="source-chart"] .bar-row[data-source="${source}"]`);
    await expect(bar.locator('.bar-label')).toHaveText(source);
    await expect(bar.locator('.bar-label')).toBeVisible();
    await expect(bar.getByTestId('bar-count')).toHaveText(count);
    await expect(bar.getByTestId('bar-count')).toBeVisible();
  }
  const total = await page.getByTestId('bar-count').evaluateAll((els) => els.reduce((s, e) => s + Number(e.textContent), 0));
  expect(total).toBe(30);
});

test('AC-9.2 chart has a text description', async ({ page }) => {
  const label = await page.getByTestId('source-chart').getAttribute('aria-label');
  for (const part of ['Facebook 10', 'Google 8', 'אתר 7', 'הפניה 5']) expect(label).toContain(part);
});

test('AC-G.1 small screen: no horizontal page scroll, table scrolls inside its container', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('mobile'), 'mobile only');
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(375);
  for (const id of ['metric-total', 'metric-new', 'metric-won', 'metric-won-value', 'priority-help-button']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  const wrap = page.getByTestId('table-wrap');
  const overflow = await wrap.evaluate((w) => w.scrollWidth > w.clientWidth);
  expect(overflow).toBe(true);
  const wrapBox = await wrap.boundingBox();
  expect(wrapBox.x).toBeGreaterThanOrEqual(0);
  expect(wrapBox.x + wrapBox.width).toBeLessThanOrEqual(375);
});

test('AC-G.1 small screen: card values are not clipped', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('mobile'), 'mobile only');
  const clipped = await page.locator('.card-value, .card-label').evaluateAll((els) =>
    els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  expect(clipped).toEqual([]);
});

test('AC-G.2 desktop: the four cards are on one row', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('desktop'), 'desktop only');
  const tops = await page.locator('.card').evaluateAll((cards) => cards.map((c) => Math.round(c.getBoundingClientRect().top)));
  expect(tops).toHaveLength(4);
  expect(new Set(tops).size).toBe(1);
});

test('AC-G.3 (partial) Hebrew RTL page; ids, amounts and dates isolated with bdi', async ({ page }) => {
  // Email direction is checked only when the details dialog and form exist (later stage).
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(cell(page, 'L-022', 'id').locator('bdi')).toHaveText('L-022');
  await expect(cell(page, 'L-022', 'value').locator('bdi')).toHaveText('12,000 ₪');
  await expect(cell(page, 'L-001', 'followUp').locator('bdi')).toHaveText('05/11/2026');
  await expect(page.getByTestId('metric-won-value').locator('bdi')).toHaveText('60,000 ₪');
});

test('AC-G.4 (partial) keyboard reaches every interactive element on the current page', async ({ page }) => {
  // Filters and form fields do not exist yet; they are checked when built.
  const reachable = new Set();
  for (let i = 0; i < 15; i += 1) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement?.dataset?.testid ?? null);
    if (id) reachable.add(id);
  }
  expect(reachable).toContain('priority-help-button');
  expect(reachable).toContain('table-wrap');
  const unlabeled = await page.locator('input, select, textarea').evaluateAll((fields) =>
    fields.filter((f) => !(f.labels && f.labels.length) && !f.getAttribute('aria-label')).length);
  expect(unlabeled).toBe(0);
});

test('AC-G.5 no console errors and no failed requests', async ({ page }) => {
  const errors = [];
  const failed = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => { if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`); });
  page.on('requestfailed', (req) => failed.push(`failed ${req.url()}`));
  await page.reload();
  await expect(rows(page)).toHaveCount(30);
  await page.getByTestId('priority-help-button').click();
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
