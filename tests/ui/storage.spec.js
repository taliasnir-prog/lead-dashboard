// Local saving and reset (M10): AC-10.1 to AC-10.7, the reset confirmation dialog,
// and storage failures. Every test starts with an empty localStorage (new browser context).
import { test, expect } from '@playwright/test';

const KEY = 'leadDashboard.v1';
const DAY1 = new Date('2026-11-07T10:00:00+02:00');

function rows(page) { return page.locator('[data-testid="leads-table"] tbody tr'); }
const row = (page, id) => page.locator(`[data-testid="leads-table"] tbody tr[data-id="${id}"]`);
const cell = (page, id, col) => row(page, id).locator(`td[data-col="${col}"]`);
const field = (page, name) => page.getByTestId(`field-${name}`);
const count = (page) => page.getByTestId('results-count');
const rowIds = (page) => rows(page).evaluateAll((trs) => trs.map((tr) => tr.dataset.id));
const readStored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

/** Opens the page; `init` runs before any page script (used to break storage). */
async function open(page, { init, now = DAY1 } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.clock.setFixedTime(now);
  await page.goto('/');
  await expect(rows(page)).not.toHaveCount(0);
  return errors;
}

async function editLead(page, id, changes) {
  await page.locator(`[data-testid="details-button"][data-id="${id}"]`).click();
  for (const [name, value] of Object.entries(changes)) {
    if (name === 'status' || name === 'interest' || name === 'rep') await field(page, name).selectOption(value);
    else await field(page, name).fill(value);
  }
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('lead-dialog')).toBeHidden();
}

async function addLead(page, name = 'ליד בדיקה', source = 'הפניה') {
  await page.getByTestId('add-lead-button').click();
  await field(page, 'name').fill(name);
  await field(page, 'source').selectOption(source);
  await field(page, 'rep').selectOption('נועה ברק');
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('lead-dialog')).toBeHidden();
}

async function summary(page) {
  return {
    cards: await page.locator('.card-value').allTextContents(),
    chart: await page.getByTestId('bar-count').allTextContents(),
  };
}

// ---------- AC-10.1, AC-10.2 save and reload ----------

test('AC-10.1 first load saves the demo data under leadDashboard.v1 as { version: 1, leads }', async ({ page }) => {
  await open(page);
  const stored = await readStored(page);
  expect(stored.version).toBe(1);
  expect(stored.leads).toHaveLength(30);
  expect(Object.keys(stored.leads[0]).sort()).toEqual(
    ['createdAt', 'email', 'followUpDate', 'id', 'interest', 'name', 'notes', 'phone', 'rep', 'source', 'status', 'value'],
  );
  await expect(page.getByTestId('storage-unavailable')).toBeHidden();
  await expect(page.getByTestId('storage-invalid')).toBeHidden();
});

test('AC-10.1 an edit is kept after reload', async ({ page }) => {
  await open(page);
  await editLead(page, 'L-009', { status: 'במעקב', notes: 'בדיקת הערה', followUpDate: '2026-11-06' });
  await expect(page.getByTestId('flash')).toHaveText('השינויים בליד L-009 נשמרו.');
  await page.reload();
  await expect(cell(page, 'L-009', 'status')).toHaveText('במעקב');
  await expect(cell(page, 'L-009', 'followUp')).toHaveText('06/11/2026באיחור');
  await page.locator('[data-testid="details-button"][data-id="L-009"]').click();
  await expect(field(page, 'notes')).toHaveValue('בדיקת הערה');
});

test('AC-10.2 an added lead is kept after reload and the next add does not reuse its id', async ({ page }) => {
  await open(page);
  await addLead(page, 'ליד לפני רענון');
  await expect(page.getByTestId('flash')).toHaveText('הליד L-031 נוסף ונשמר.');
  await page.reload();
  await expect(rows(page)).toHaveCount(31);
  await expect(count(page)).toHaveText('מוצגים 31 מתוך 31 לידים');
  await expect(cell(page, 'L-031', 'name').locator('.name-text')).toHaveText('ליד לפני רענון');
  await addLead(page, 'ליד אחרי רענון');
  await expect(cell(page, 'L-032', 'name').locator('.name-text')).toHaveText('ליד אחרי רענון');
  const ids = await rowIds(page);
  expect(ids).toHaveLength(32);
  expect(new Set(ids).size).toBe(32);
  expect((await readStored(page)).leads.map((l) => l.id).slice(-2)).toEqual(['L-031', 'L-032']);
});

test('AC-10.1 follow-up dates are kept after reload and not recalculated on a later day', async ({ page }) => {
  await open(page);
  await expect(cell(page, 'L-001', 'followUp')).toHaveText('05/11/2026באיחור');
  await expect(cell(page, 'L-002', 'followUp')).toHaveText('07/11/2026'); // today: not overdue
  const before = (await readStored(page)).leads.map((l) => l.followUpDate);

  await page.clock.setFixedTime(new Date('2026-11-20T10:00:00+02:00'));
  await page.reload();
  await expect(cell(page, 'L-001', 'followUp')).toHaveText('05/11/2026באיחור');
  await expect(cell(page, 'L-002', 'followUp')).toHaveText('07/11/2026באיחור'); // same date, now overdue
  expect((await readStored(page)).leads.map((l) => l.followUpDate)).toEqual(before);
});

// ---------- AC-10.3 reset ----------

test('AC-10.3 reset dialog: focus starts on "ביטול"; Cancel keeps data, filters and search', async ({ page }) => {
  await open(page);
  await editLead(page, 'L-009', { status: 'במעקב' });
  await page.getByTestId('filter-status').selectOption('במעקב');
  await page.getByTestId('filter-query').fill('מ');
  const idsBefore = await rowIds(page);
  const storedBefore = await readStored(page);

  await page.getByTestId('reset-button').click();
  await expect(page.getByTestId('reset-dialog')).toBeVisible();
  await expect(page.getByTestId('reset-cancel')).toBeFocused();
  await page.getByTestId('reset-cancel').click();

  await expect(page.getByTestId('reset-dialog')).toBeHidden();
  await expect(page.getByTestId('reset-button')).toBeFocused();
  expect(await rowIds(page)).toEqual(idsBefore);
  await expect(page.getByTestId('filter-status')).toHaveValue('במעקב');
  await expect(page.getByTestId('filter-query')).toHaveValue('מ');
  expect(await readStored(page)).toEqual(storedBefore);
});

test('AC-10.3 reset dialog: Esc keeps data, filters and search', async ({ page }) => {
  await open(page);
  await addLead(page);
  await page.getByTestId('filter-source').selectOption('הפניה');
  await page.getByTestId('reset-button').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('reset-dialog')).toBeHidden();
  await expect(page.getByTestId('reset-button')).toBeFocused();
  await expect(page.getByTestId('filter-source')).toHaveValue('הפניה');
  await expect(count(page)).toHaveText('מוצגים 6 מתוך 31 לידים');
  expect((await readStored(page)).leads).toHaveLength(31);
});

test('AC-10.3 confirm: 30 demo leads, filters cleared, everything updated, and the same after reload', async ({ page }) => {
  await open(page);
  const original = await summary(page);
  await addLead(page);
  await editLead(page, 'L-015', { status: 'נסגר בהצלחה' });
  await page.getByTestId('filter-status').selectOption('נסגר בהצלחה');
  await page.getByTestId('filter-query').fill('ק');
  expect(await summary(page)).not.toEqual(original);

  await page.getByTestId('reset-button').click();
  await page.getByTestId('reset-confirm').click();
  await expect(page.getByTestId('reset-dialog')).toBeHidden();
  await expect(page.getByTestId('reset-button')).toBeFocused();
  await expect(rows(page)).toHaveCount(30);
  await expect(count(page)).toHaveText('מוצגים 30 מתוך 30 לידים');
  await expect(page.getByTestId('filter-query')).toHaveValue('');
  for (const id of ['filter-status', 'filter-source', 'filter-rep']) await expect(page.getByTestId(id)).toHaveValue('');
  expect(await summary(page)).toEqual(original);
  expect(original.cards).toEqual(['30', '7', '5', '60,000 ₪']);
  await expect(cell(page, 'L-015', 'status')).toHaveText('במעקב');
  await expect(row(page, 'L-031')).toHaveCount(0);
  await expect(page.getByTestId('flash')).toHaveText('נתוני הדמה שוחזרו: 30 לידים.');

  await page.reload();
  await expect(rows(page)).toHaveCount(30);
  await expect(row(page, 'L-031')).toHaveCount(0);
  await expect(cell(page, 'L-015', 'status')).toHaveText('במעקב');
  expect((await readStored(page)).leads).toHaveLength(30);
});

test('AC-10.3 reset recreates dates from the local day of the reset', async ({ page }) => {
  await open(page);
  await page.clock.setFixedTime(new Date('2026-11-20T10:00:00+02:00'));
  await page.reload();
  await expect(cell(page, 'L-002', 'followUp')).toHaveText('07/11/2026באיחור'); // saved date
  await page.getByTestId('reset-button').click();
  await page.getByTestId('reset-confirm').click();
  await expect(cell(page, 'L-002', 'followUp')).toHaveText('20/11/2026'); // today again
  await expect(cell(page, 'L-001', 'followUp')).toHaveText('18/11/2026באיחור');
});

test('AC-10.3 reset dialog with the keyboard: open, focus stays inside, confirm with Enter', async ({ page }) => {
  await open(page);
  await addLead(page);
  await page.getByTestId('reset-button').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reset-cancel')).toBeFocused();
  const inside = () => page.evaluate(() => document.querySelector('[data-testid="reset-dialog"]').contains(document.activeElement));
  for (let i = 0; i < 6; i += 1) { await page.keyboard.press('Tab'); expect(await inside()).toBe(true); }
  for (let i = 0; i < 6; i += 1) { await page.keyboard.press('Shift+Tab'); expect(await inside()).toBe(true); }
  await page.getByTestId('reset-cancel').focus();
  await page.keyboard.press('Tab'); // wraps to "איפוס"
  await expect(page.getByTestId('reset-confirm')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reset-dialog')).toBeHidden();
  await expect(rows(page)).toHaveCount(30);
  await expect(page.getByTestId('reset-button')).toBeFocused();
});

test('AC-10.3 reset dialog: Space on "ביטול" closes without changes', async ({ page }) => {
  await open(page);
  await addLead(page);
  await page.getByTestId('reset-button').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('reset-cancel')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('reset-dialog')).toBeHidden();
  await expect(rows(page)).toHaveCount(31);
});

// ---------- AC-10.4, AC-10.5 invalid stored data ----------

test('AC-10.4 broken JSON: demo data, clear notice, stored value replaced', async ({ page }) => {
  await open(page);
  await page.evaluate((k) => localStorage.setItem(k, '{not json'), KEY);
  await page.reload();
  await expect(rows(page)).toHaveCount(30);
  await expect(page.getByTestId('storage-invalid')).toBeVisible();
  await expect(page.getByTestId('storage-invalid')).toHaveText('הנתונים השמורים לא היו תקינים, ולכן נטענו נתוני הדמה.');
  await expect(page.getByTestId('storage-unavailable')).toBeHidden();
  expect((await readStored(page)).leads).toHaveLength(30);
  await page.reload();
  await expect(page.getByTestId('storage-invalid')).toBeHidden(); // replaced, so fine next time
});

test('AC-10.5 one lead with a bad value rejects the whole stored value', async ({ page }) => {
  await open(page);
  await page.evaluate((k) => {
    const data = JSON.parse(localStorage.getItem(k));
    data.leads = data.leads.slice(0, 3);
    data.leads[1].status = 'בטיפול';
    localStorage.setItem(k, JSON.stringify(data));
  }, KEY);
  await page.reload();
  await expect(rows(page)).toHaveCount(30);
  await expect(page.getByTestId('storage-invalid')).toBeVisible();
  const stored = await readStored(page);
  expect(stored.leads).toHaveLength(30);
  expect(stored.leads.every((l) => l.status !== 'בטיפול')).toBe(true);
});

test('AC-10.5 a structurally valid smaller value is loaded as is (no notice)', async ({ page }) => {
  await open(page);
  await page.evaluate((k) => {
    const data = JSON.parse(localStorage.getItem(k));
    data.leads = data.leads.slice(0, 2);
    localStorage.setItem(k, JSON.stringify(data));
  }, KEY);
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await expect(count(page)).toHaveText('מוצגים 2 מתוך 2 לידים');
  await expect(page.getByTestId('storage-invalid')).toBeHidden();
});

// ---------- AC-10.6 storage failures ----------

const BREAKERS = {
  'getItem throws': () => {
    Storage.prototype.getItem = function getItem() { throw new Error('blocked read'); };
  },
  'setItem throws': () => {
    Storage.prototype.setItem = function setItem() { throw new Error('QuotaExceededError'); };
  },
  'reading window.localStorage throws': () => {
    const thrower = { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } };
    try { Object.defineProperty(window, 'localStorage', thrower); } catch { /* fall through */ }
    try { Object.defineProperty(Window.prototype, 'localStorage', thrower); } catch { /* ignore */ }
  },
};

for (const [label, init] of Object.entries(BREAKERS)) {
  test(`AC-10.6 ${label}: page works in memory, clear notice, no crash, honest messages`, async ({ page }) => {
    const errors = await open(page, { init });
    if (label.startsWith('reading')) {
      expect(await page.evaluate(() => { try { void window.localStorage; return 'no throw'; } catch { return 'throws'; } })).toBe('throws');
    }
    await expect(rows(page)).toHaveCount(30);
    await expect(page.getByTestId('storage-unavailable')).toBeVisible();
    await expect(page.getByTestId('storage-unavailable')).toHaveText('לא ניתן לשמור בדפדפן הזה. השינויים לא יישמרו לאחר רענון.');
    await expect(page.getByTestId('storage-invalid')).toBeHidden();

    await editLead(page, 'L-015', { status: 'נסגר בהצלחה' });
    await expect(cell(page, 'L-015', 'status')).toHaveText('נסגר בהצלחה');
    await expect(page.getByTestId('metric-won')).toHaveText('6');
    await expect(page.getByTestId('flash')).toHaveText('השינויים בליד L-015 עודכנו, אבל לא נשמרו בדפדפן ויימחקו ברענון.');
    await expect(page.getByTestId('flash')).not.toContainText('נשמרו.');

    await addLead(page);
    await expect(row(page, 'L-031')).toHaveCount(1);
    await expect(page.getByTestId('flash')).toHaveText('הליד L-031 נוסף, אבל לא נשמר בדפדפן ויימחק ברענון.');

    await page.getByTestId('reset-button').click();
    await page.getByTestId('reset-confirm').click();
    await expect(rows(page)).toHaveCount(30);
    await expect(page.getByTestId('flash')).toHaveText('נתוני הדמה שוחזרו: 30 לידים, אבל לא נשמרו בדפדפן.');
    expect(errors).toEqual([]);
  });
}

test('AC-10.6 getItem fails: existing stored data is never overwritten', async ({ page }) => {
  await open(page);
  await editLead(page, 'L-009', { notes: 'מידע שצריך להישמר' });
  const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
  await page.addInitScript(() => {
    const realGet = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(...args) {
      if (!window.__allowRead) throw new Error('blocked read');
      return realGet.apply(this, args);
    };
  });
  await page.reload();
  await expect(page.getByTestId('storage-unavailable')).toBeVisible();
  await editLead(page, 'L-001', { notes: 'עריכה בזיכרון בלבד' });
  const after = await page.evaluate((k) => { window.__allowRead = true; return localStorage.getItem(k); }, KEY);
  expect(after).toBe(before);
});

test('AC-10.6 saving starts failing later: the edit stays on screen, warning shown, no false "נשמרו"', async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByTestId('storage-unavailable')).toBeHidden();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
  await editLead(page, 'L-009', { status: 'במעקב' });
  await expect(cell(page, 'L-009', 'status')).toHaveText('במעקב');
  await expect(page.getByTestId('flash')).toHaveText('השינויים בליד L-009 עודכנו, אבל לא נשמרו בדפדפן ויימחקו ברענון.');
  await expect(page.getByTestId('storage-unavailable')).toBeVisible();
  expect(errors).toEqual([]);
});

// ---------- AC-10.7 and layout ----------

test('AC-10.7 the local-only explanation is visible next to the reset button', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('storage-note')).toBeVisible();
  await expect(page.getByTestId('storage-note')).toHaveText('השינויים נשמרים רק בדפדפן הזה ואינם מסתנכרנים בין מכשירים או משתמשים.');
  const note = await page.getByTestId('storage-note').boundingBox();
  const button = await page.getByTestId('reset-button').boundingBox();
  expect(Math.abs(button.y - note.y)).toBeLessThan(120);
});

test('AC-G.4 reset dialog is labelled and described for screen readers', async ({ page }) => {
  await open(page);
  await page.getByTestId('reset-button').click();
  const dialog = page.getByRole('dialog', { name: 'איפוס לנתוני הדמה' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-describedby', 'reset-desc');
  await expect(page.locator('#reset-desc')).toContainText('יימחקו');
});

test('AC-G.1 small screen: reset dialog and notices fit, no horizontal page scroll', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('mobile'), 'mobile only');
  await open(page, { init: BREAKERS['setItem throws'] });
  await expect(page.getByTestId('storage-unavailable')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const reset = await page.getByTestId('reset-button').boundingBox();
  expect(reset.height).toBeGreaterThanOrEqual(44);
  expect(reset.x + reset.width).toBeLessThanOrEqual(375);
  await page.getByTestId('reset-button').click();
  const box = await page.getByTestId('reset-dialog').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(box.y + box.height).toBeLessThanOrEqual(667);
  for (const id of ['reset-confirm', 'reset-cancel']) {
    const b = await page.getByTestId(id).boundingBox();
    expect(b.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId(id)).toBeInViewport();
  }
});
