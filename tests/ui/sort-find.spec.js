// SPEC 1.5: the "מיון" selector (AC-3.2 to AC-3.4), the message and "הצג ליד" after adding a lead
// (AC-5.8, AC-5.9, AC-10.6) and the sort going back to the default (AC-10.10). Clock fixed to 07.11.2026.
import { test, expect } from '@playwright/test';
import { sortLeads, sortLeadsByRecent, filterLeads } from '../../js/logic.js';
import { createDemoLeads } from '../../js/demo-data.js';

const TODAY = '2026-11-07';
const DEMO = createDemoLeads(TODAY);
const ids = (leads) => leads.map((l) => l.id);
const PRIORITY_IDS = ids(sortLeads(DEMO, TODAY));
const RECENT_IDS = ids(sortLeadsByRecent(DEMO));

async function open(page, { init } = {}) {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+02:00'));
  if (init) await page.addInitScript(init);
  await page.goto('./');
  await expect(rows(page)).toHaveCount(30);
}

function rows(page) { return page.locator('[data-testid="leads-table"] tbody tr'); }
const row = (page, id) => page.locator(`[data-testid="leads-table"] tbody tr[data-id="${id}"]`);
const nameBtn = (page, id) => page.locator(`[data-testid="details-button"][data-id="${id}"]`);
const rowIds = (page) => rows(page).evaluateAll((rs) => rs.map((r) => r.dataset.id));
const sortSelect = (page) => page.getByTestId('sort-mode');
const sortStatus = (page) => page.getByTestId('sort-status');
const count = (page) => page.getByTestId('results-count');
const flash = (page) => page.getByTestId('flash');
const showLead = (page) => page.getByTestId('show-lead');

/** Cards and chart as text, to check they do not change. */
const overview = (page) => page.evaluate(() => ({
  cards: ['metric-total', 'metric-new', 'metric-won', 'metric-won-value']
    .map((id) => document.querySelector(`[data-testid="${id}"]`).textContent),
  chart: [...document.querySelectorAll('[data-testid="bar-count"]')].map((n) => n.textContent),
}));

const filterValues = (page) => page.evaluate(() => ['filter-query', 'filter-status', 'filter-source', 'filter-rep']
  .map((id) => document.querySelector(`[data-testid="${id}"]`).value));

async function addLead(page, { name = 'ליד בדיקה', source = 'הפניה', followUpDate } = {}) {
  await page.getByTestId('add-lead-button').click();
  await page.getByTestId('field-name').fill(name);
  await page.getByTestId('field-source').selectOption(source);
  await page.getByTestId('field-rep').selectOption('נועה ברק');
  if (followUpDate) await page.getByTestId('field-followUpDate').fill(followUpDate);
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('lead-dialog')).toBeHidden();
}

// A Google lead and part of its name, so search and filter together leave some rows.
const GOOGLE_LEAD = DEMO.find((l) => l.source === 'Google');
const GOOGLE_QUERY = GOOGLE_LEAD.name.split(' ')[0];

// ---------- AC-3.2 / AC-3.3 sort selector ----------

test('AC-3.2 default sort: "לפי עדיפות" is selected, shown next to the counter, and the order is unchanged', async ({ page }) => {
  await open(page);
  await expect(page.getByLabel('מיון')).toHaveValue('priority');
  expect(await sortSelect(page).locator('option').allTextContents()).toEqual(['לפי עדיפות', 'נוספו לאחרונה']);
  await expect(sortStatus(page)).toHaveText('מיון: לפי עדיפות');
  await expect(count(page)).toHaveText('מוצגים 30 מתוך 30 לידים');
  expect(await rowIds(page)).toEqual(PRIORITY_IDS);
});

test('AC-3.3 "נוספו לאחרונה": all 30 leads newest first, closed leads in place, label next to the counter', async ({ page }) => {
  await open(page);
  // Keyboard: the selector comes right after "איפוס מסננים".
  await page.getByTestId('filters-reset').focus();
  await page.keyboard.press('Tab');
  await expect(sortSelect(page)).toBeFocused();
  await sortSelect(page).selectOption('recent');
  await expect(sortStatus(page)).toHaveText('מיון: נוספו לאחרונה');
  await expect(count(page)).toHaveText('מוצגים 30 מתוך 30 לידים');
  expect(await rowIds(page)).toEqual(RECENT_IDS);
  // Closed leads are not moved to the end in this sort.
  const closedPositions = RECENT_IDS.map((id, i) => [id, i]).filter(([id]) => DEMO.find((l) => l.id === id).status.startsWith('נסגר'));
  expect(closedPositions.length).toBe(9);
  expect(closedPositions.some(([, i]) => i < 21)).toBe(true);
});

test('AC-3.3 "נוספו לאחרונה": two consecutive adds on the same day show L-032 first, then L-031', async ({ page }) => {
  await open(page);
  await sortSelect(page).selectOption('recent');
  await addLead(page, { name: 'ליד ראשון' });
  await addLead(page, { name: 'ליד שני' });
  expect((await rowIds(page)).slice(0, 3)).toEqual(['L-032', 'L-031', 'L-030']);
  await expect(sortSelect(page)).toHaveValue('recent');
});

// ---------- AC-3.4 sort with search and filters ----------

test('AC-3.4 search and filters work in both sorts; changing the sort keeps them and does not touch cards or chart', async ({ page }) => {
  await open(page);
  const before = await overview(page);
  const filters = { query: GOOGLE_QUERY, status: '', source: 'Google', rep: '' };
  const expectedPriority = ids(filterLeads(sortLeads(DEMO, TODAY), filters));
  const expectedRecent = ids(filterLeads(sortLeadsByRecent(DEMO), filters));
  expect(expectedPriority.length).toBeGreaterThan(0);

  // Filters first, then the sort.
  await page.getByTestId('filter-source').selectOption('Google');
  await page.getByTestId('filter-query').fill(GOOGLE_QUERY);
  expect(await rowIds(page)).toEqual(expectedPriority);
  await sortSelect(page).selectOption('recent');
  expect(await rowIds(page)).toEqual(expectedRecent);
  await expect(count(page)).toHaveText(`מוצגים ${expectedRecent.length} מתוך 30 לידים`);
  expect(await filterValues(page)).toEqual([GOOGLE_QUERY, '', 'Google', '']);
  expect(await overview(page)).toEqual(before);

  // The sort first, then the filters.
  await page.getByTestId('filters-reset').click();
  expect(await rowIds(page)).toEqual(RECENT_IDS);
  await page.getByTestId('filter-status').selectOption('במעקב');
  const followRecent = ids(filterLeads(sortLeadsByRecent(DEMO), { ...filters, query: '', source: '', status: 'במעקב' }));
  expect(await rowIds(page)).toEqual(followRecent);
  await expect(sortSelect(page)).toHaveValue('recent');
  await sortSelect(page).selectOption('priority');
  expect(await rowIds(page)).toEqual(ids(filterLeads(sortLeads(DEMO, TODAY), { query: '', source: '', rep: '', status: 'במעקב' })));
  await expect(page.getByTestId('filter-status')).toHaveValue('במעקב');
  expect(await overview(page)).toEqual(before);
});

// ---------- AC-5.8 message after adding ----------

test('AC-5.8 add while sorted and filtered: name and id in the message, focus on it, nothing else changes', async ({ page }) => {
  await open(page);
  await sortSelect(page).selectOption('recent');
  await page.getByTestId('filter-source').selectOption('Google');
  await page.getByTestId('filter-query').fill(GOOGLE_QUERY);
  const shownBefore = await rowIds(page);

  await addLead(page, { source: 'הפניה' });
  await expect(flash(page)).toHaveText(
    'הליד ליד בדיקה (L-031) נוסף ונשמר. הוא לא מוצג כרגע כי הוא לא מתאים לחיפוש או לסינון הפעילים.',
  );
  await expect(flash(page)).toBeFocused();
  await expect(showLead(page)).toBeVisible();
  await expect(showLead(page)).toHaveText('הצג ליד');
  await page.keyboard.press('Tab');
  await expect(showLead(page)).toBeFocused();

  await expect(sortSelect(page)).toHaveValue('recent');
  expect(await filterValues(page)).toEqual([GOOGLE_QUERY, '', 'Google', '']);
  expect(await rowIds(page)).toEqual(shownBefore);
  await expect(row(page, 'L-031')).toHaveCount(0);
  await expect(page.getByTestId('lead-dialog')).toBeHidden();
});

test('AC-5.8 add that matches the view, default sort: message without "not shown", sort stays "לפי עדיפות"', async ({ page }) => {
  await open(page);
  await addLead(page, { name: 'ליד גלוי' });
  await expect(flash(page)).toHaveText('הליד ליד גלוי (L-031) נוסף ונשמר.');
  await expect(showLead(page)).toBeVisible();
  await expect(sortSelect(page)).toHaveValue('priority');
  await expect(sortStatus(page)).toHaveText('מיון: לפי עדיפות');
  expect(await rowIds(page)).toEqual(ids(sortLeads([...DEMO, { ...DEMO[0], id: 'L-031', status: 'חדש', interest: 'בינונית', followUpDate: null }], TODAY)));
});

test('AC-5.8 the "הצג ליד" button is not shown after editing', async ({ page }) => {
  await open(page);
  await nameBtn(page, 'L-009').click();
  await page.getByTestId('dialog-save').click();
  await expect(flash(page)).toHaveText('השינויים בליד L-009 נשמרו.');
  await expect(showLead(page)).toBeHidden();
});

// ---------- AC-5.9 "הצג ליד" ----------

test('AC-5.9 "הצג ליד" shows a filtered-out lead: filters cleared, sort kept, row in view, focus on the name, highlight about 3 s', async ({ page }) => {
  await open(page);
  await sortSelect(page).selectOption('recent');
  await page.getByTestId('filter-source').selectOption('Google');
  await page.getByTestId('filter-query').fill(GOOGLE_QUERY);
  await addLead(page, { source: 'הפניה' });
  await expect(row(page, 'L-031')).toHaveCount(0);

  await showLead(page).click();
  expect(await filterValues(page)).toEqual(['', '', '', '']);
  await expect(sortSelect(page)).toHaveValue('recent');
  await expect(sortStatus(page)).toHaveText('מיון: נוספו לאחרונה');
  await expect(count(page)).toHaveText('מוצגים 31 מתוך 31 לידים');
  expect((await rowIds(page))[0]).toBe('L-031');
  await expect(row(page, 'L-031')).toBeInViewport();
  await expect(nameBtn(page, 'L-031')).toBeFocused();
  await expect(row(page, 'L-031')).toHaveClass(/is-highlighted/);
  await expect(row(page, 'L-031').getByTestId('highlight-tag')).toHaveText('נוסף עכשיו');
  await expect(page.getByTestId('lead-dialog')).toBeHidden();
  // The lead is shown now, so "not shown" is gone; the saved state is still stated.
  await expect(flash(page)).toHaveText('הליד ליד בדיקה (L-031) נוסף ונשמר.');

  // About 3 seconds later the highlight ends, and focus stays on the name.
  const start = Date.now();
  await expect(row(page, 'L-031').getByTestId('highlight-tag')).toHaveCount(0, { timeout: 8000 });
  expect(Date.now() - start).toBeGreaterThan(1500);
  await expect(row(page, 'L-031')).not.toHaveClass(/is-highlighted/);
  await expect(nameBtn(page, 'L-031')).toBeFocused();
});

test('AC-5.9 keyboard, default sort: Enter on "הצג ליד" scrolls to a row lower in the list and focuses its name', async ({ page }) => {
  await open(page);
  await page.getByTestId('filter-source').selectOption('Google');
  await addLead(page, { source: 'הפניה' }); // score 4: not at the top of the priority order
  await expect(flash(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(showLead(page)).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(sortSelect(page)).toHaveValue('priority');
  await expect(page.getByTestId('filter-source')).toHaveValue('');
  const position = (await rowIds(page)).indexOf('L-031');
  expect(position).toBeGreaterThan(5);
  await expect(row(page, 'L-031')).toBeInViewport();
  await expect(nameBtn(page, 'L-031')).toBeFocused();
  await expect(row(page, 'L-031')).toHaveClass(/is-highlighted/);
  await expect(page.getByTestId('lead-dialog')).toBeHidden();
  if (test.info().project.name.endsWith('mobile')) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  }
});

test('AC-5.9 an overdue lead keeps its "באיחור" tag and overdue background while highlighted', async ({ page }) => {
  await open(page);
  await addLead(page, { name: 'ליד באיחור', followUpDate: '2026-11-06' });
  await showLead(page).click();
  const added = row(page, 'L-031');
  await expect(added).toHaveClass(/is-highlighted/);
  await expect(added).toHaveClass(/is-overdue/);
  await expect(added.getByTestId('overdue-tag')).toBeVisible();
  await expect(added.getByTestId('overdue-tag')).toHaveText('באיחור');
  const bg = (locator) => locator.locator('td[data-col="status"]').evaluate((td) => getComputedStyle(td).backgroundColor);
  const otherOverdue = page.locator('[data-testid="leads-table"] tbody tr.is-overdue:not(.is-highlighted)').first();
  expect(await bg(added)).toBe(await bg(otherOverdue));
});

// ---------- AC-10.6 saving fails ----------

test('AC-10.6 saving fails: the add message says so before and after "הצג ליד"', async ({ page }) => {
  await open(page, { init: () => { Storage.prototype.setItem = () => { throw new Error('quota'); }; } });
  await page.getByTestId('filter-source').selectOption('Google');
  await addLead(page, { source: 'הפניה' });
  await expect(flash(page)).toContainText('הליד ליד בדיקה (L-031) נוסף, אבל לא נשמר בדפדפן ויימחק ברענון.');
  await expect(page.getByTestId('flash-box')).toHaveClass(/is-warning/);
  await showLead(page).click();
  await expect(nameBtn(page, 'L-031')).toBeFocused();
  await expect(flash(page)).toHaveText('הליד ליד בדיקה (L-031) נוסף, אבל לא נשמר בדפדפן ויימחק ברענון.');
  await expect(page.getByTestId('flash-box')).toHaveClass(/is-warning/);
  await expect(page.getByTestId('storage-unavailable')).toBeVisible();
});

// ---------- AC-10.10 the sort is not kept ----------

test('AC-10.10 reload returns to "לפי עדיפות"', async ({ page }) => {
  await open(page);
  await sortSelect(page).selectOption('recent');
  expect(await rowIds(page)).toEqual(RECENT_IDS);
  await page.reload();
  await expect(rows(page)).toHaveCount(30);
  await expect(sortSelect(page)).toHaveValue('priority');
  await expect(sortStatus(page)).toHaveText('מיון: לפי עדיפות');
  expect(await rowIds(page)).toEqual(PRIORITY_IDS);
});

test('AC-10.10 reset to demo data returns to "לפי עדיפות"', async ({ page }) => {
  await open(page);
  await sortSelect(page).selectOption('recent');
  await page.getByTestId('reset-button').click();
  await page.getByTestId('reset-confirm').click();
  await expect(sortSelect(page)).toHaveValue('priority');
  await expect(sortStatus(page)).toHaveText('מיון: לפי עדיפות');
  expect(await rowIds(page)).toEqual(PRIORITY_IDS);
});

test('AC-10.10 cancelling the reset keeps the selected sort', async ({ page }) => {
  await open(page);
  await sortSelect(page).selectOption('recent');
  await page.getByTestId('reset-button').click();
  await page.getByTestId('reset-cancel').click();
  await expect(sortSelect(page)).toHaveValue('recent');
  expect(await rowIds(page)).toEqual(RECENT_IDS);
});

// ---------- AC-G.1 small screen ----------

test('AC-G.1 small screen: "הצג ליד" and the sort selector are at least 44px high, no sideways page scroll', async ({ page }) => {
  test.skip(!test.info().project.name.endsWith('mobile'), 'small screen only');
  await open(page);
  const sortBox = await sortSelect(page).boundingBox();
  expect(sortBox.height).toBeGreaterThanOrEqual(44);
  await addLead(page);
  const box = await showLead(page).boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
