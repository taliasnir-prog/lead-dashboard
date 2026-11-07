import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMetrics, countBySource, sortLeads, formatCurrency, formatDate, isOpen, priorityScore, addDays,
} from '../../js/logic.js';
import { createDemoLeads } from '../../js/demo-data.js';
import { TODAY, makeLead } from './helpers.js';

const inDays = (n) => addDays(TODAY, n);

// ---------- AC-2.1 metrics ----------

test('AC-2.1 metrics: demo data gives 30 / 7 / 5 / 60,000', () => {
  assert.deepEqual(computeMetrics(createDemoLeads(TODAY)), { total: 30, newCount: 7, wonCount: 5, wonValue: 60000 });
});

test('AC-2.1 metrics: only "נסגר בהצלחה" counts toward won count and value', () => {
  const leads = [
    makeLead({ id: 'L-001', status: 'נסגר בהצלחה', value: 1000 }),
    makeLead({ id: 'L-002', status: 'נסגר ללא עסקה', value: 9999 }),
    makeLead({ id: 'L-003', status: 'במעקב', value: 5000 }),
    makeLead({ id: 'L-004', status: 'חדש', value: 7000 }),
  ];
  assert.deepEqual(computeMetrics(leads), { total: 4, newCount: 1, wonCount: 1, wonValue: 1000 });
});

test('AC-2.1 metrics: won lead with value 0 counts as a deal and adds 0', () => {
  const leads = [makeLead({ id: 'L-001', status: 'נסגר בהצלחה', value: 0 })];
  assert.deepEqual(computeMetrics(leads), { total: 1, newCount: 0, wonCount: 1, wonValue: 0 });
});

test('AC-2.1 metrics: empty list gives zeros', () => {
  assert.deepEqual(computeMetrics([]), { total: 0, newCount: 0, wonCount: 0, wonValue: 0 });
});

test('AC-2.1 metrics: status change is reflected (basis for AC-2.2)', () => {
  const leads = createDemoLeads(TODAY);
  const target = leads.find((l) => l.status === 'במעקב');
  const before = computeMetrics(leads);
  target.status = 'נסגר בהצלחה';
  const after = computeMetrics(leads);
  assert.equal(after.wonCount, before.wonCount + 1);
  assert.equal(after.wonValue, before.wonValue + target.value);
});

// ---------- AC-9.1 counts by source ----------

test('AC-9.1 chart counts: demo data gives Facebook 10, Google 8, אתר 7, הפניה 5 (sum 30)', () => {
  const counts = countBySource(createDemoLeads(TODAY));
  assert.deepEqual(counts, [
    { source: 'Facebook', count: 10 }, { source: 'Google', count: 8 },
    { source: 'אתר', count: 7 }, { source: 'הפניה', count: 5 },
  ]);
  assert.equal(counts.reduce((s, c) => s + c.count, 0), 30);
});

test('AC-9.1 chart counts: sources with no leads appear with 0, and closed leads are counted', () => {
  const leads = [
    makeLead({ id: 'L-001', source: 'Google', status: 'נסגר ללא עסקה' }),
    makeLead({ id: 'L-002', source: 'Google' }),
  ];
  assert.deepEqual(countBySource(leads), [
    { source: 'Facebook', count: 0 }, { source: 'Google', count: 2 },
    { source: 'אתר', count: 0 }, { source: 'הפניה', count: 0 },
  ]);
});

// ---------- AC-3.2 default order ----------

test('AC-3.2 order: higher score first', () => {
  const low = makeLead({ id: 'L-001', interest: 'נמוכה', followUpDate: inDays(10) }); // 1
  const high = makeLead({ id: 'L-002', interest: 'גבוהה', followUpDate: inDays(-1) }); // 6
  assert.deepEqual(sortLeads([low, high], TODAY).map((l) => l.id), ['L-002', 'L-001']);
});

test('AC-3.2 order: same score -> earlier follow-up first, missing date after dated leads', () => {
  // all score 3: medium(2) + follow-up 1 point (no date, or 1-3 days)
  const noDate = makeLead({ id: 'L-001', followUpDate: null });
  const inThree = makeLead({ id: 'L-002', followUpDate: inDays(3) });
  const inOne = makeLead({ id: 'L-003', followUpDate: inDays(1) });
  const sorted = sortLeads([noDate, inThree, inOne], TODAY);
  assert.deepEqual(sorted.map((l) => priorityScore(l, TODAY)), [3, 3, 3]);
  assert.deepEqual(sorted.map((l) => l.id), ['L-003', 'L-002', 'L-001']);
});

test('AC-3.2 order: same score and date -> by id', () => {
  const b = makeLead({ id: 'L-010', followUpDate: inDays(2) });
  const a = makeLead({ id: 'L-002', followUpDate: inDays(2) });
  assert.deepEqual(sortLeads([b, a], TODAY).map((l) => l.id), ['L-002', 'L-010']);
});

test('AC-3.2 order: two leads without date and same score -> by id', () => {
  const b = makeLead({ id: 'L-020', followUpDate: null });
  const a = makeLead({ id: 'L-005', followUpDate: null });
  assert.deepEqual(sortLeads([b, a], TODAY).map((l) => l.id), ['L-005', 'L-020']);
});

test('AC-3.2 order: closed leads after all open ones, by id, even with high interest and past date', () => {
  const closed2 = makeLead({ id: 'L-002', status: 'נסגר בהצלחה', interest: 'גבוהה', followUpDate: inDays(-9) });
  const closed1 = makeLead({ id: 'L-001', status: 'נסגר ללא עסקה', interest: 'גבוהה', followUpDate: null });
  const lowOpen = makeLead({ id: 'L-099', interest: 'נמוכה', followUpDate: inDays(30) }); // score 1
  assert.deepEqual(sortLeads([closed2, lowOpen, closed1], TODAY).map((l) => l.id), ['L-099', 'L-001', 'L-002']);
});

test('AC-3.2 order: demo data -> scores never increase among open leads, closed at the end', () => {
  const sorted = sortLeads(createDemoLeads(TODAY), TODAY);
  const open = sorted.filter(isOpen);
  assert.equal(open.length, 21);
  assert.deepEqual(sorted.slice(0, 21), open);
  const scores = open.map((l) => priorityScore(l, TODAY));
  for (let i = 1; i < scores.length; i += 1) assert.ok(scores[i] <= scores[i - 1], `index ${i}`);
  assert.equal(sorted[0].id, 'L-001'); // the only score-7 lead
  assert.deepEqual(sorted.slice(21).map((l) => l.id), ['L-022', 'L-023', 'L-024', 'L-025', 'L-026', 'L-027', 'L-028', 'L-029', 'L-030']);
});

test('AC-3.2 order: does not mutate the input array', () => {
  const leads = createDemoLeads(TODAY);
  const ids = leads.map((l) => l.id);
  sortLeads(leads, TODAY);
  assert.deepEqual(leads.map((l) => l.id), ids);
});

// ---------- AC-3.1 display formats ----------

test('AC-3.1 format: currency with thousands separator and ₪', () => {
  assert.equal(formatCurrency(12000), '12,000 ₪');
  assert.equal(formatCurrency(60000), '60,000 ₪');
  assert.equal(formatCurrency(0), '0 ₪');
  assert.equal(formatCurrency(950), '950 ₪');
  assert.equal(formatCurrency(10000000), '10,000,000 ₪');
});

test('AC-3.1 format: date DD/MM/YYYY and missing date', () => {
  assert.equal(formatDate('2026-11-07'), '07/11/2026');
  assert.equal(formatDate('2027-01-01'), '01/01/2027');
  assert.equal(formatDate(null), 'לא נקבע');
});
