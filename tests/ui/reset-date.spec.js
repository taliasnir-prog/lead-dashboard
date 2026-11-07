// Issue #5: a reset in a page left open past midnight uses the local day of the reset (AC-10.9).
import { test, expect } from '@playwright/test';

const cell = (page, id, col) => page.locator(`[data-testid="leads-table"] tbody tr[data-id="${id}"] td[data-col="${col}"]`);

test('AC-10.9 reset after midnight without reload creates dates from the new local day', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T23:50:00+02:00'));
  await page.goto('./');
  await expect(cell(page, 'L-002', 'followUp')).toHaveText('07/11/2026'); // offset 0 = today
  await expect(cell(page, 'L-001', 'followUp')).toHaveText('05/11/2026באיחור');

  // The page stays open; the local day changes.
  await page.clock.setFixedTime(new Date('2026-11-08T00:10:00+02:00'));
  await page.getByTestId('reset-button').click();
  await page.getByTestId('reset-confirm').click();

  await expect(cell(page, 'L-002', 'followUp')).toHaveText('08/11/2026');
  await expect(cell(page, 'L-001', 'followUp')).toHaveText('06/11/2026באיחור');
  await expect(cell(page, 'L-009', 'followUp')).toHaveText('18/11/2026'); // +10 days
  // Priority and overdue also use the new day: L-002 (today) is not overdue.
  await expect(cell(page, 'L-002', 'followUp')).not.toContainText('באיחור');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('leadDashboard.v1')).leads.find((l) => l.id === 'L-002').followUpDate);
  expect(stored).toBe('2026-11-08');

  // A lead added after the reset gets the new day as its creation date.
  await page.getByTestId('add-lead-button').click();
  await page.getByTestId('field-name').fill('ליד אחרי חצות');
  await page.getByTestId('field-source').selectOption('הפניה');
  await page.getByTestId('field-rep').selectOption('נועה ברק');
  await page.getByTestId('dialog-save').click();
  const created = await page.evaluate(() => JSON.parse(localStorage.getItem('leadDashboard.v1')).leads.find((l) => l.id === 'L-031').createdAt);
  expect(created).toBe('2026-11-08');
});

test('AC-10.9 reset on the same day keeps the same dates', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+02:00'));
  await page.goto('./');
  await page.getByTestId('reset-button').click();
  await page.getByTestId('reset-confirm').click();
  await expect(cell(page, 'L-002', 'followUp')).toHaveText('07/11/2026');
});
