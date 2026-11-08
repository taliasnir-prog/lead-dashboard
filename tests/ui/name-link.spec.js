// Issue #9 / SPEC 1.4: the lead name opens the details. Touch activation, focus return
// and long names (up to 50 characters) that stay readable without breaking the table scroll.
import { test, expect } from '@playwright/test';

const KEY = 'leadDashboard.v1';
const LONG = 'שם ארוך מאוד לבדיקה של קריאות בטבלה ובגלילה אחת'; // 47 characters
const LONGEST = 'א'.repeat(50); // one 50-character word, the worst case for wrapping

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+02:00'));
  await page.goto('./');
  await expect(page.locator('[data-testid="leads-table"] tbody tr')).toHaveCount(30);
});

const nameButton = (page, id) => page.locator(`[data-testid="details-button"][data-id="${id}"]`);

test('AC-5.1 touch: tapping the name opens the details; closing returns focus to the name', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('mobile'), 'touch only on the small-screen projects');
  await nameButton(page, 'L-009').tap();
  await expect(page.getByTestId('lead-dialog')).toBeVisible();
  await page.getByTestId('dialog-cancel').tap();
  await expect(page.getByTestId('lead-dialog')).toBeHidden();
  await expect(nameButton(page, 'L-009')).toBeFocused();
});

test('AC-5.1 keyboard: Space on the name opens the details; Esc returns focus to the name', async ({ page }) => {
  await nameButton(page, 'L-015').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('lead-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nameButton(page, 'L-015')).toBeFocused();
});

test('AC-5.1 long names are fully readable and the name column stays narrow', async ({ page }, testInfo) => {
  await page.evaluate(({ k, names }) => {
    const data = JSON.parse(localStorage.getItem(k));
    data.leads[0].name = names[0];
    data.leads[1].name = names[1];
    localStorage.setItem(k, JSON.stringify(data));
  }, { k: KEY, names: [LONG, LONGEST] });
  await page.reload();
  for (const [id, text] of [['L-001', LONG], ['L-002', LONGEST]]) {
    const b = nameButton(page, id);
    await expect(b).toHaveText(text);
    const box = await b.evaluate((el) => ({ clipped: el.scrollWidth > el.clientWidth + 1, width: el.getBoundingClientRect().width }));
    expect(box.clipped, id).toBe(false);
    expect(box.width).toBeLessThanOrEqual(testInfo.project.name.endsWith('mobile') ? 6.5 * 16 + 1 : 16 * 16 + 1);
  }
});

test('AC-G.1 long names: every table cell is still readable at some scroll position (small screen)', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('mobile'), 'small screen only');
  await page.evaluate(({ k, names }) => {
    const data = JSON.parse(localStorage.getItem(k));
    data.leads[0].name = names[0];
    data.leads[1].name = names[1];
    localStorage.setItem(k, JSON.stringify(data));
  }, { k: KEY, names: [LONG, LONGEST] });
  await page.reload();
  const unreachable = await page.getByTestId('table-wrap').evaluate((wrap) => {
    const cells = [...wrap.querySelectorAll('th, td')];
    const key = (c) => `${c.closest('tr').dataset.id ?? 'header'}:${c.dataset.col ?? c.cellIndex}`;
    const seen = new Set();
    const max = wrap.scrollWidth - wrap.clientWidth;
    const positions = [];
    for (let s = 0; s <= max; s += 8) positions.push(-s);
    positions.push(-max);
    for (const pos of positions) {
      wrap.scrollLeft = pos;
      const v = wrap.getBoundingClientRect();
      const left = v.left + wrap.clientLeft;
      const right = left + wrap.clientWidth;
      for (const c of cells) {
        if (seen.has(key(c))) continue;
        const r = c.getBoundingClientRect();
        if (r.left < left - 1 || r.right > right + 1) continue;
        if (c.dataset.col !== 'name') {
          const n = c.parentElement.querySelector('[data-col="name"]').getBoundingClientRect();
          if (Math.min(r.right, n.right) - Math.max(r.left, n.left) > 1) continue;
        }
        seen.add(key(c));
      }
    }
    return cells.map(key).filter((k) => !seen.has(k));
  });
  expect(unreachable).toEqual([]);
});

test('AC-5.1 names are never split inside a word when the word fits (all 30 demo names)', async ({ page }) => {
  const split = await page.getByTestId('details-button').evaluateAll((buttons) => {
    const problems = [];
    for (const b of buttons) {
      const node = b.firstChild;
      const text = node.textContent;
      let i = 0;
      for (const word of text.split(' ')) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + word.length);
        const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
        if (lines.size > 1) problems.push(`${b.dataset.id}: "${word}" split over ${lines.size} lines`);
        i += word.length + 1;
      }
    }
    return problems;
  });
  expect(split).toEqual([]);
});
