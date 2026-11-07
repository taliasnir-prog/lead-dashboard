// AC-G.1: on a small screen the table scrolls inside its container and the name column stays
// fixed. Every header and every cell must be fully readable at some scroll position, without
// being covered by the fixed name column. Temporary clipping during the scroll is fine.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+02:00'));
  await page.goto('./');
  await expect(page.locator('[data-testid="leads-table"] tbody tr')).toHaveCount(30);
});

test('AC-G.1 small screen: every header and cell is fully readable at some scroll position', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('mobile'), 'mobile only');

  const result = await page.getByTestId('table-wrap').evaluate((wrap) => {
    const cells = [...wrap.querySelectorAll('th, td')];
    const isName = (c) => c.dataset.col === 'name';
    const label = (c) => `${c.closest('tr').dataset.id ?? 'header'}:${c.dataset.col ?? c.cellIndex}`;
    const seen = new Set();
    const tol = 1;
    const maxScroll = wrap.scrollWidth - wrap.clientWidth;

    // Content of a cell must also fit inside the cell (no clipped text inside a cell).
    const clippedInside = cells.filter((c) => c.scrollWidth > c.clientWidth + tol).map(label);

    // RTL in Chromium: scrollLeft goes from 0 (start) to -maxScroll (end).
    const positions = [];
    for (let s = 0; s <= maxScroll; s += 8) positions.push(-s);
    positions.push(-maxScroll);

    for (const pos of positions) {
      wrap.scrollLeft = pos;
      const view = wrap.getBoundingClientRect();
      const left = view.left + wrap.clientLeft;
      const right = left + wrap.clientWidth;
      for (const cell of cells) {
        const key = label(cell);
        if (seen.has(key)) continue;
        const r = cell.getBoundingClientRect();
        if (r.left < left - tol || r.right > right + tol) continue;
        if (!isName(cell)) {
          const nameCell = cell.parentElement.querySelector('[data-col="name"]');
          const n = nameCell.getBoundingClientRect();
          const overlap = Math.min(r.right, n.right) - Math.max(r.left, n.left);
          if (overlap > tol) continue;
        }
        seen.add(key);
      }
    }
    wrap.scrollLeft = 0;
    const unreachable = cells.map(label).filter((k) => !seen.has(k));
    return { total: cells.length, unreachable, clippedInside, maxScroll };
  });

  expect(result.maxScroll).toBeGreaterThan(0);
  expect(result.total).toBe(31 * 9);
  expect(result.clippedInside).toEqual([]);
  expect(result.unreachable).toEqual([]);
});

test('AC-G.1 small screen: the name column stays visible while scrolling to the end', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('mobile'), 'mobile only');
  const wrap = page.getByTestId('table-wrap');
  await wrap.evaluate((w) => { w.scrollLeft = -(w.scrollWidth - w.clientWidth); });
  const wrapBox = await wrap.boundingBox();
  const nameBox = await page.locator('tbody tr[data-id="L-001"] td[data-col="name"]').boundingBox();
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(wrapBox.x + wrapBox.width + 1);
  expect(nameBox.x).toBeGreaterThanOrEqual(wrapBox.x - 1);
  const prio = await page.locator('tbody tr[data-id="L-001"] td[data-col="priority"]').boundingBox();
  expect(prio.x).toBeGreaterThanOrEqual(wrapBox.x - 1);
});
