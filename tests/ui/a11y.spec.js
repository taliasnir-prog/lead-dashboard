// Visible focus and colour contrast (SPEC section 4, WCAG 2.2 AA thresholds), checked in the
// main states of the page on every engine and size. This is an automated approximation:
// it computes contrast from CSS colours and does not replace a manual review or a screen reader test.
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T10:00:00+02:00'));
  await page.goto('./');
  await expect(page.locator('[data-testid="leads-table"] tbody tr')).toHaveCount(30);
});

// Runs in the page. Returns problems as readable strings.
function auditInPage({ mode }) {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const ch = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const blend = (top, under) => ({
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
    a: 1,
  });
  /** Background behind an element: composite of its and its ancestors' backgrounds. */
  const bgOf = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
      if (n.tagName === 'DIALOG') break;
    }
    let result = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i -= 1) result = blend(layers[i], result);
    return result;
  };
  const openDialog = document.querySelector('dialog[open]');
  const inScope = (el) => el.checkVisibility() && (!openDialog || openDialog.contains(el));
  const name = (el) => `${el.tagName.toLowerCase()}${el.dataset.testid ? `[${el.dataset.testid}]` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''} "${(el.textContent || el.value || '').trim().slice(0, 24)}"`;
  const problems = [];

  if (mode === 'contrast') {
    const all = [...document.body.querySelectorAll('*')].filter(inScope);
    for (const el of all) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      const r = ratio(fg.a < 1 ? blend(fg, bg) : fg, bg);
      if (r < need) problems.push(`text ${name(el)} ${r.toFixed(2)} < ${need}`);
    }
    // Non-text contrast: the border of form fields must stand out from what is around them (3:1).
    for (const el of all.filter((e) => e.matches('input, select, textarea'))) {
      const border = parse(getComputedStyle(el).borderTopColor);
      const around = bgOf(el.parentElement);
      const r = ratio(border, around);
      if (r < 3) problems.push(`border ${name(el)} ${r.toFixed(2)} < 3`);
    }
    // Placeholder text (where the engine reports ::placeholder styles).
    for (const el of all.filter((e) => e.matches('input[placeholder]'))) {
      const ph = parse(getComputedStyle(el, '::placeholder').color);
      if (!ph) continue;
      const r = ratio(ph, bgOf(el));
      if (r < 4.5) problems.push(`placeholder ${name(el)} ${r.toFixed(2)} < 4.5`);
    }
  }
  return problems;
}

/**
 * Moves through the page (or the open dialog) with the real Tab key and checks the focus indicator
 * of every element reached. Also checks that every focusable element in scope was reached.
 */
async function focusProblems(page) {
  const expected = await page.evaluate(() => {
    const openDialog = document.querySelector('dialog[open]');
    return [...document.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.checkVisibility() && !el.disabled && (!openDialog || openDialog.contains(el))).length;
  });
  const seen = new Map();
  for (let i = 0; i < expected + 3; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      if (!el.dataset.auditKey) el.dataset.auditKey = String(Math.random());
      const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).map(Number); return { r: p[0], g: p[1], b: p[2] }; };
      const lum = ({ r, g, b }) => { const ch = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const bgOf = (n0) => { for (let n = n0; n; n = n.parentElement) { const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[\s,/]+/).map(Number); if (p.length < 4 || p[3] === 1) return { r: p[0], g: p[1], b: p[2] }; } } return { r: 255, g: 255, b: 255 }; };
      const cs = getComputedStyle(el);
      const label = `${el.tagName.toLowerCase()}[${el.dataset.testid ?? el.id ?? ''}]`;
      let problem = null;
      if (!el.matches(':focus-visible')) problem = `${label}: no :focus-visible`;
      else if (cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) < 2) problem = `${label}: outline ${cs.outlineStyle} ${cs.outlineWidth}`;
      else {
        const color = parse(cs.outlineColor);
        const r = color ? ratio(color, bgOf(el.parentElement)) : 99;
        if (r < 3) problem = `${label}: outline contrast ${r.toFixed(2)} < 3`;
      }
      return { key: el.dataset.auditKey, problem };
    });
    if (info && !seen.has(info.key)) seen.set(info.key, info.problem);
  }
  return { expected, count: seen.size, problems: [...seen.values()].filter(Boolean) };
}

const contrast = (page) => page.evaluate(auditInPage, { mode: 'contrast' });

test('AC-G.4 visible focus: Tab reaches every focusable element on the page, each with a clear outline', async ({ page }) => {
  const { expected, count, problems } = await focusProblems(page);
  expect(expected).toBeGreaterThan(30);
  expect(count).toBe(expected);
  expect(problems).toEqual([]);
});

test('AC-G.4 visible focus: inside the add dialog and the reset dialog, opened with the keyboard', async ({ page }) => {
  await page.getByTestId('add-lead-button').focus();
  await page.keyboard.press('Enter');
  let r = await focusProblems(page);
  expect(r.expected).toBeGreaterThanOrEqual(12);
  expect(r.count).toBe(r.expected);
  expect(r.problems).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByTestId('reset-button').focus();
  await page.keyboard.press('Enter');
  r = await focusProblems(page);
  expect(r.expected).toBe(2);
  expect(r.count).toBe(2);
  expect(r.problems).toEqual([]);
});

test('AC-G.4 contrast: page, overdue rows, badges, chart and help text', async ({ page }) => {
  await page.getByTestId('priority-help-button').click();
  expect(await contrast(page)).toEqual([]);
});

test('AC-G.4 contrast: success message, empty state', async ({ page }) => {
  await page.locator('[data-testid="details-button"][data-id="L-009"]').click();
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('flash')).toBeVisible();
  expect(await contrast(page)).toEqual([]);
  await page.getByTestId('filter-query').fill('zzz');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  expect(await contrast(page)).toEqual([]);
});

test('AC-G.4 contrast and focus: message after adding with "הצג ליד", and the highlighted row (SPEC 1.5)', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  await page.getByTestId('field-name').fill('ליד ניגודיות');
  await page.getByTestId('field-source').selectOption('הפניה');
  await page.getByTestId('field-rep').selectOption('נועה ברק');
  await page.getByTestId('field-followUpDate').fill('2026-11-06'); // overdue: the tag sits on the overdue background
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('show-lead')).toBeVisible();
  expect(await contrast(page)).toEqual([]);
  // "הצג ליד" reached with the keyboard shows a clear focus outline on the message background.
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('show-lead')).toBeFocused();
  expect(await page.getByTestId('show-lead').evaluate((b) => b.matches(':focus-visible'))).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('highlight-tag')).toBeVisible();
  expect(await contrast(page)).toEqual([]);
});

test('AC-G.4 contrast: add dialog with validation errors, edit dialog, reset dialog', async ({ page }) => {
  await page.getByTestId('add-lead-button').click();
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('error-name')).toBeVisible();
  expect(await contrast(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="details-button"][data-id="L-001"]').click();
  expect(await contrast(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByTestId('reset-button').click();
  expect(await contrast(page)).toEqual([]);
});

test('AC-G.4 contrast: storage notices and the warning success message', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('leadDashboard.v1', '{not json'));
  await page.reload();
  await expect(page.getByTestId('storage-invalid')).toBeVisible();
  // Saving starts to fail: the "cannot save" notice and the yellow warning message appear.
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
  await page.locator('[data-testid="details-button"][data-id="L-009"]').click();
  await page.getByTestId('dialog-save').click();
  await expect(page.getByTestId('storage-unavailable')).toBeVisible();
  await expect(page.getByTestId('flash-box')).toHaveClass(/is-warning/); // SPEC 1.5: the box holds the text and "הצג ליד"
  expect(await contrast(page)).toEqual([]);
});
