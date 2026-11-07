// Lead details, edit and add (M5), form statuses (M6), and their effect on metrics,
// chart, overdue and priority (AC-2.2, AC-8.3). In-memory only. Clock fixed to 07.11.2026.
import { test, expect } from '@playwright/test';

const STATUSES = ['חדש', 'נוצר קשר', 'במעקב', 'נסגר בהצלחה', 'נסגר ללא עסקה'];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+02:00'));
  await page.goto('/');
  await expect(rows(page)).toHaveCount(30);
});

function rows(page) { return page.locator('[data-testid="leads-table"] tbody tr'); }
const row = (page, id) => page.locator(`[data-testid="leads-table"] tbody tr[data-id="${id}"]`);
const cell = (page, id, col) => row(page, id).locator(`td[data-col="${col}"]`);
const detailsBtn = (page, id) => page.locator(`[data-testid="details-button"][data-id="${id}"]`);
const dialog = (page) => page.getByTestId('lead-dialog');
const field = (page, name) => page.getByTestId(`field-${name}`);
const error = (page, name) => page.getByTestId(`error-${name}`);
const count = (page) => page.getByTestId('results-count');
const activeInDialog = (page) => page.evaluate(() => document.querySelector('[data-testid="lead-dialog"]').contains(document.activeElement));
const activeTestId = (page) => page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName);
const barCount = (page, source) => page.locator(`.bar-row[data-source="${source}"] [data-testid="bar-count"]`);

async function openDetails(page, id) {
  await detailsBtn(page, id).click();
  await expect(dialog(page)).toBeVisible();
}

async function fillValidAdd(page, { name = 'ליד בדיקה', source = 'הפניה', rep = 'נועה ברק' } = {}) {
  await field(page, 'name').fill(name);
  await field(page, 'source').selectOption(source);
  await field(page, 'rep').selectOption(rep);
}

// ---------- AC-5.1 open and view ----------

test('AC-5.1 details button sits in the name cell with an accessible name; still 9 columns', async ({ page }) => {
  await expect(page.locator('[data-testid="leads-table"] thead th')).toHaveCount(9);
  await expect(cell(page, 'L-009', 'name').getByRole('button', { name: 'פרטים של מורן זילבר' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^פרטים של / })).toHaveCount(30);
});

test('AC-5.1 mouse: details show all 12 fields, read-only ones as text', async ({ page }) => {
  await openDetails(page, 'L-009');
  await expect(page.getByTestId('dialog-title')).toHaveText('פרטי ליד L-009');
  const ro = page.getByTestId('readonly-details');
  await expect(ro.locator('[data-ro="id"]')).toHaveText('L-009');
  await expect(ro.locator('[data-ro="name"]')).toHaveText('מורן זילבר');
  await expect(ro.locator('[data-ro="phone"]')).toHaveText('לא צוין');
  await expect(ro.locator('[data-ro="email"]')).toHaveText('lead009@example.com');
  await expect(ro.locator('[data-ro="source"]')).toHaveText('אתר');
  await expect(ro.locator('[data-ro="value"]')).toHaveText('5,000 ₪');
  await expect(ro.locator('[data-ro="createdAt"]')).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);
  await expect(field(page, 'status')).toHaveValue('נוצר קשר');
  await expect(field(page, 'interest')).toHaveValue('בינונית');
  await expect(field(page, 'rep')).toHaveValue('נועה ברק');
  await expect(field(page, 'followUpDate')).toHaveValue('2026-11-17');
  await expect(field(page, 'notes')).toHaveValue('');
  // Fields that are not editable are not shown as inputs in edit mode.
  for (const name of ['name', 'phone', 'email', 'source', 'value']) await expect(field(page, name)).toBeHidden();
});

test('AC-5.1 keyboard: Tab to "פרטים", Enter opens, focus stays inside, Esc closes and returns focus', async ({ page }) => {
  await page.getByTestId('table-wrap').focus();
  await page.keyboard.press('Tab');
  await expect(detailsBtn(page, 'L-001')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await expect(field(page, 'status')).toBeFocused();
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press('Tab');
    expect(await activeInDialog(page)).toBe(true);
  }
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await activeInDialog(page)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(detailsBtn(page, 'L-001')).toBeFocused();
});

test('AC-5.1 focus wraps from the last button to the first field and back', async ({ page }) => {
  await openDetails(page, 'L-009');
  await page.getByTestId('dialog-cancel').focus();
  await page.keyboard.press('Tab');
  await expect(field(page, 'status')).toBeFocused(); // first visible field in edit mode
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('dialog-cancel')).toBeFocused();
});

// ---------- AC-5.6 cancel ----------

for (const how of ['button', 'Escape']) {
  test(`AC-5.6 changing every field then ${how} leaves the lead unchanged`, async ({ page }) => {
    const before = await row(page, 'L-009').innerText();
    await openDetails(page, 'L-009');
    await field(page, 'status').selectOption('נסגר בהצלחה');
    await field(page, 'interest').selectOption('גבוהה');
    await field(page, 'rep').selectOption('עומר טל');
    await field(page, 'followUpDate').fill('2026-11-01');
    await field(page, 'notes').fill('לא אמור להישמר');
    if (how === 'button') await page.getByTestId('dialog-cancel').click();
    else await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    expect(await row(page, 'L-009').innerText()).toBe(before);
    await expect(page.getByTestId('metric-won')).toHaveText('5');
    await expect(detailsBtn(page, 'L-009')).toBeFocused();
    await expect(page.getByTestId('flash')).toBeHidden();
    await openDetails(page, 'L-009');
    await expect(field(page, 'status')).toHaveValue('נוצר קשר');
    await expect(field(page, 'notes')).toHaveValue('');
    await expect(field(page, 'followUpDate')).toHaveValue('2026-11-17');
  });
}

// ---------- AC-5.5 edit ----------

test('AC-5.5 edit updates the row, overdue and priority at once; notes show on reopen', async ({ page }) => {
  await expect(cell(page, 'L-009', 'priority')).toHaveText('נמוכה(2)');
  await openDetails(page, 'L-009');
  await field(page, 'status').selectOption('במעקב');
  await field(page, 'interest').selectOption('גבוהה');
  await field(page, 'rep').selectOption('עומר טל');
  await field(page, 'followUpDate').fill('2026-11-06');
  await field(page, 'notes').fill('בדיקת הערה');
  await page.getByTestId('dialog-save').click();
  await expect(dialog(page)).toBeHidden();
  await expect(cell(page, 'L-009', 'status')).toHaveText('במעקב');
  await expect(cell(page, 'L-009', 'interest')).toHaveText('גבוהה');
  await expect(cell(page, 'L-009', 'rep')).toHaveText('עומר טל');
  await expect(cell(page, 'L-009', 'followUp')).toHaveText('06/11/2026באיחור');
  await expect(row(page, 'L-009')).toHaveClass(/is-overdue/);
  await expect(cell(page, 'L-009', 'priority')).toHaveText('גבוהה(6)');
  await expect(page.getByTestId('flash')).toHaveText('השינויים בליד L-009 נשמרו.');
  await expect(detailsBtn(page, 'L-009')).toBeFocused();
  await openDetails(page, 'L-009');
  await expect(field(page, 'notes')).toHaveValue('בדיקת הערה');
});

test('AC-5.5 clearing the follow-up date shows "לא נקבע" and recalculates priority', async ({ page }) => {
  await openDetails(page, 'L-009'); // medium, +10 days, contacted: 2
  await field(page, 'followUpDate').fill('');
  await page.getByTestId('dialog-save').click();
  await expect(cell(page, 'L-009', 'followUp')).toHaveText('לא נקבע');
  await expect(cell(page, 'L-009', 'priority')).toHaveText('בינונית(3)');
});

test('AC-2.2 closing a lead as won updates cards at once; chart unchanged', async ({ page }) => {
  const chartBefore = await page.getByTestId('bar-count').allTextContents();
  await openDetails(page, 'L-015'); // במעקב, 10,000
  await field(page, 'status').selectOption('נסגר בהצלחה');
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('metric-won')).toHaveText('6');
  await expect(page.getByTestId('metric-won-value')).toHaveText('70,000 ₪');
  await expect(page.getByTestId('metric-total')).toHaveText('30');
  expect(await page.getByTestId('bar-count').allTextContents()).toEqual(chartBefore);
  await expect(cell(page, 'L-015', 'priority')).toHaveText('לא בתעדוף');
  const ids = await rows(page).evaluateAll((trs) => trs.map((tr) => tr.dataset.id));
  expect(ids.indexOf('L-015')).toBeGreaterThanOrEqual(20); // moved to the closed section
});

test('AC-8.3 changing the follow-up date to yesterday changes low to high', async ({ page }) => {
  await expect(cell(page, 'L-015', 'priority')).toHaveText('נמוכה(2)');
  await openDetails(page, 'L-015');
  await field(page, 'followUpDate').fill('2026-11-06');
  await page.getByTestId('dialog-save').click();
  await expect(cell(page, 'L-015', 'priority')).toHaveText('גבוהה(5)');
  await expect(cell(page, 'L-015', 'followUp')).toContainText('באיחור');
});

test('AC-5.5 edit that removes the lead from the active filter: message, focus, filters kept', async ({ page }) => {
  await page.getByTestId('filter-status').selectOption('נוצר קשר');
  await page.getByTestId('filter-query').fill('מ');
  const before = await rows(page).count();
  await openDetails(page, 'L-009');
  await field(page, 'status').selectOption('במעקב');
  await page.getByTestId('dialog-save').click();
  await expect(row(page, 'L-009')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(before - 1);
  await expect(count(page)).toHaveText(`מוצגים ${before - 1} מתוך 30 לידים`);
  await expect(page.getByTestId('flash')).toContainText('השינויים בליד L-009 נשמרו');
  await expect(page.getByTestId('flash')).toContainText('לא מוצג כרגע');
  await expect(page.getByTestId('flash')).toBeFocused();
  await expect(page.getByTestId('filter-status')).toHaveValue('נוצר קשר');
  await expect(page.getByTestId('filter-query')).toHaveValue('מ');
});

test('AC-5.5 edit validation: notes of 501 characters are rejected with a linked error', async ({ page }) => {
  await openDetails(page, 'L-009');
  await field(page, 'notes').fill('א'.repeat(501));
  await page.getByTestId('dialog-save').click();
  await expect(dialog(page)).toBeVisible();
  await expect(error(page, 'notes')).toHaveText('הערות עד 500 תווים');
  await expect(field(page, 'notes')).toHaveAttribute('aria-invalid', 'true');
  await expect(field(page, 'notes')).toBeFocused();
  await page.keyboard.press('Escape');
  await openDetails(page, 'L-009');
  await expect(field(page, 'notes')).toHaveValue('');
});

// ---------- AC-5.2, AC-5.3 add validation ----------

test('AC-5.2 add without required fields: Hebrew errors linked to fields, focus on first, nothing added', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId('dialog-title')).toHaveText('ליד חדש');
  await expect(field(page, 'name')).toBeFocused();
  await page.getByTestId('dialog-save').click();
  await expect(dialog(page)).toBeVisible();
  await expect(error(page, 'name')).toHaveText('שם חובה');
  await expect(error(page, 'source')).toHaveText('יש לבחור מקור');
  await expect(error(page, 'rep')).toHaveText('יש לבחור נציג');
  await expect(field(page, 'name')).toBeFocused();
  for (const name of ['name', 'source', 'rep']) {
    await expect(field(page, name)).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await field(page, name).getAttribute('aria-describedby');
    expect(describedBy.split(' ')).toContain(`e-${name}`);
  }
  await expect(error(page, 'email')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(rows(page)).toHaveCount(30);
  await expect(page.getByTestId('metric-total')).toHaveText('30');
  await expect(page.getByTestId('add-lead-button')).toBeFocused();
});

test('AC-5.3 add: invalid values get errors, focus goes to the first in screen order, then a fix saves', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  await fillValidAdd(page);
  await field(page, 'phone').fill('123');
  await field(page, 'email').fill('abc');
  await field(page, 'value').fill('-5');
  await field(page, 'notes').fill('א'.repeat(501));
  await page.getByTestId('dialog-save').click();
  await expect(error(page, 'phone')).toHaveText('טלפון צריך להכיל 9 או 10 ספרות');
  await expect(error(page, 'email')).toHaveText('כתובת דוא״ל לא תקינה');
  await expect(error(page, 'value')).toContainText('מספר שלם');
  await expect(error(page, 'notes')).toHaveText('הערות עד 500 תווים');
  await expect(error(page, 'name')).toBeHidden();
  await expect(field(page, 'phone')).toBeFocused();

  await field(page, 'value').fill('1.5');
  await page.getByTestId('dialog-save').click();
  await expect(error(page, 'value')).toContainText('מספר שלם');

  await field(page, 'phone').fill('');
  await field(page, 'email').fill('test@example.com');
  await field(page, 'value').fill('10000000');
  await field(page, 'notes').fill('א'.repeat(500));
  await page.getByTestId('dialog-save').click();
  await expect(dialog(page)).toBeHidden();
  await expect(cell(page, 'L-031', 'value')).toHaveText('10,000,000 ₪');
});

test('AC-5.3 add: name of 1 character and of 51 characters rejected, 2 accepted', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  await fillValidAdd(page, { name: 'א' });
  await page.getByTestId('dialog-save').click();
  await expect(error(page, 'name')).toHaveText('שם צריך להכיל 2 עד 50 תווים');
  await field(page, 'name').fill('א'.repeat(51));
  await page.getByTestId('dialog-save').click();
  await expect(error(page, 'name')).toHaveText('שם צריך להכיל 2 עד 50 תווים');
  await field(page, 'name').fill('  אב  ');
  await page.getByTestId('dialog-save').click();
  await expect(dialog(page)).toBeHidden();
  await expect(cell(page, 'L-031', 'name').locator('.name-text')).toHaveText('אב');
});

// ---------- AC-5.4 add ----------

test('AC-5.4 add a valid lead: L-031, table, cards, chart and counter update', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  await fillValidAdd(page);
  await page.getByTestId('dialog-save').click();
  await expect(dialog(page)).toBeHidden();
  await expect(row(page, 'L-031')).toHaveCount(1);
  await expect(cell(page, 'L-031', 'status')).toHaveText('חדש');
  await expect(cell(page, 'L-031', 'value')).toHaveText('0 ₪');
  await expect(cell(page, 'L-031', 'followUp')).toHaveText('לא נקבע');
  await expect(cell(page, 'L-031', 'priority')).toHaveText('בינונית(4)'); // medium 2 + no date 1 + new 1
  await expect(page.getByTestId('metric-total')).toHaveText('31');
  await expect(page.getByTestId('metric-new')).toHaveText('8');
  await expect(barCount(page, 'הפניה')).toHaveText('6');
  await expect(count(page)).toHaveText('מוצגים 31 מתוך 31 לידים');
  await expect(page.getByTestId('flash')).toHaveText('הליד L-031 נוסף ונשמר.');
  await expect(detailsBtn(page, 'L-031')).toBeFocused();
});

test('AC-5.4 two consecutive adds get L-031 and L-032; counter 32', async ({ page }) => {
  for (const name of ['ליד ראשון', 'ליד שני']) {
    await page.getByTestId('add-lead-button').click();
    await fillValidAdd(page, { name });
    await page.getByTestId('dialog-save').click();
    await expect(dialog(page)).toBeHidden();
  }
  await expect(cell(page, 'L-031', 'name').locator('.name-text')).toHaveText('ליד ראשון');
  await expect(cell(page, 'L-032', 'name').locator('.name-text')).toHaveText('ליד שני');
  await expect(count(page)).toHaveText('מוצגים 32 מתוך 32 לידים');
  await expect(page.getByTestId('metric-total')).toHaveText('32');
});

test('AC-5.4 add while filtered: id from all leads, hidden lead explained, dynamic counter', async ({ page }) => {
  await page.getByTestId('filter-source').selectOption('Google');
  await expect(count(page)).toHaveText('מוצגים 8 מתוך 30 לידים');
  await page.getByTestId('add-lead-button').click();
  await fillValidAdd(page, { source: 'הפניה' });
  await page.getByTestId('dialog-save').click();
  await expect(row(page, 'L-031')).toHaveCount(0);
  await expect(count(page)).toHaveText('מוצגים 8 מתוך 31 לידים');
  await expect(page.getByTestId('flash')).toContainText('הליד L-031 נוסף');
  await expect(page.getByTestId('flash')).toContainText('לא מוצג כרגע');
  await expect(page.getByTestId('flash')).toBeFocused();
  await expect(page.getByTestId('filter-source')).toHaveValue('Google');

  await page.getByTestId('add-lead-button').click();
  await fillValidAdd(page, { source: 'Google', name: 'ליד גוגל' });
  await page.getByTestId('dialog-save').click();
  await expect(row(page, 'L-032')).toHaveCount(1);
  await expect(count(page)).toHaveText('מוצגים 9 מתוך 32 לידים');
  await expect(page.getByTestId('flash')).toHaveText('הליד L-032 נוסף ונשמר.');
});

test('AC-5.4 keyboard only: open with Enter, type, save with Enter; cancel with Space', async ({ page }) => {
  await page.getByTestId('add-lead-button').focus();
  await page.keyboard.press('Enter');
  await expect(field(page, 'name')).toBeFocused();
  await page.keyboard.type('ליד מקלדת');
  await field(page, 'source').focus();
  await page.keyboard.press('End'); // הפניה
  await field(page, 'rep').focus();
  await page.keyboard.press('End'); // עומר טל
  await page.getByTestId('dialog-save').focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  await expect(cell(page, 'L-031', 'source')).toHaveText('הפניה');
  await expect(cell(page, 'L-031', 'rep')).toHaveText('עומר טל');

  await page.getByTestId('add-lead-button').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('לא יישמר');
  await page.getByTestId('dialog-cancel').focus();
  await page.keyboard.press('Space');
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByTestId('metric-total')).toHaveText('31');
  await expect(page.getByTestId('add-lead-button')).toBeFocused();
});

test('AC-5.4 Enter inside a text field submits the form', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  await fillValidAdd(page);
  await field(page, 'name').focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  await expect(row(page, 'L-031')).toHaveCount(1);
});

// ---------- AC-6.1 form statuses ----------

test('AC-6.1 add and edit forms list exactly the 5 statuses, no "הכל"', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  expect(await field(page, 'status').locator('option').allTextContents()).toEqual(STATUSES);
  await page.keyboard.press('Escape');
  await openDetails(page, 'L-022');
  expect(await field(page, 'status').locator('option').allTextContents()).toEqual(STATUSES);
  await expect(page.locator('[data-testid="filter-status"] option')).toHaveCount(6);
});

// ---------- AC-G.3, AC-G.4 in the form and dialog ----------

test('AC-G.3 email is left-to-right in the form field and in the details dialog', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  await expect(field(page, 'email')).toHaveAttribute('dir', 'ltr');
  expect(await field(page, 'email').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
  expect(await field(page, 'phone').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
  await page.keyboard.press('Escape');
  await openDetails(page, 'L-009');
  const email = page.locator('[data-ro="email"] bdi');
  await expect(email).toHaveText('lead009@example.com');
  const ok = await email.evaluate((e) => e.tagName === 'BDI' || e.getAttribute('dir') === 'ltr' || getComputedStyle(e).direction === 'ltr');
  expect(ok).toBe(true);
});

test('AC-G.4 every form field has a visible label; required fields are marked', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  const labels = await dialog(page).locator('input, select, textarea').evaluateAll((fields) =>
    fields.filter((f) => f.getClientRects().length > 0).map((f) => [f.name, [...f.labels].map((l) => l.textContent.trim())]));
  expect(Object.fromEntries(labels)).toEqual({
    name: ['שם *'], phone: ['טלפון'], email: ['דוא״ל'], source: ['מקור *'], rep: ['נציג *'],
    status: ['סטטוס *'], interest: ['רמת עניין *'], value: ['שווי עסקה צפוי (₪)'],
    followUpDate: ['תאריך מעקב'], notes: ['הערות'],
  });
  for (const name of ['name', 'source', 'rep', 'status', 'interest']) {
    await expect(field(page, name)).toHaveAttribute('aria-required', 'true');
  }
  const unlabeled = await page.locator('input, select, textarea').evaluateAll((all) =>
    all.filter((f) => !(f.labels && f.labels.length) && !f.getAttribute('aria-label')).map((f) => f.name || f.id));
  expect(unlabeled).toEqual([]);
});

// ---------- Small screen and desktop layout of the dialog ----------

test('AC-G.1 small screen: dialog fits, scrolls inside, action buttons always reachable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile only');
  await page.getByTestId('add-lead-button').click();
  const box = await dialog(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(667);
  const body = dialog(page).locator('.dialog-body');
  expect(await body.evaluate((b) => b.scrollHeight > b.clientHeight)).toBe(true);
  for (const id of ['dialog-save', 'dialog-cancel']) {
    const b = await page.getByTestId(id).boundingBox();
    expect(b.y + b.height).toBeLessThanOrEqual(667);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  await field(page, 'notes').scrollIntoViewIfNeeded();
  await expect(field(page, 'notes')).toBeInViewport();
  await expect(page.getByTestId('dialog-save')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('AC-G.1 small screen: edit dialog with errors still shows the action buttons', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile only');
  await openDetails(page, 'L-009');
  await field(page, 'notes').fill('א'.repeat(501));
  await page.getByTestId('dialog-save').click();
  await expect(error(page, 'notes')).toBeInViewport();
  await expect(page.getByTestId('dialog-save')).toBeInViewport();
  await expect(page.getByTestId('dialog-cancel')).toBeInViewport();
});

test('AC-G.2 desktop: dialog is centered and fully visible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop only');
  await page.getByTestId('add-lead-button').click();
  const box = await dialog(page).boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(800);
  expect(Math.abs((box.x + box.width / 2) - 640)).toBeLessThanOrEqual(2);
});
