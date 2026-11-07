import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPriority, priorityScore, priorityLevel, followUpPoints, addDays,
} from '../../js/logic.js';
import { TODAY, makeLead } from './helpers.js';

const inDays = (n) => addDays(TODAY, n);

// TEST_PLAN.md, M8 examples table: [interest, followUpDate, status, score, level]
const EXAMPLES = [
  ['גבוהה', inDays(-1), 'במעקב', 6, 'גבוהה'],
  ['גבוהה', inDays(2), 'חדש', 5, 'גבוהה'],
  ['בינונית', inDays(0), 'נוצר קשר', 4, 'בינונית'],
  ['נמוכה', null, 'חדש', 3, 'בינונית'],
  ['בינונית', inDays(10), 'במעקב', 2, 'נמוכה'],
  ['נמוכה', inDays(10), 'במעקב', 1, 'נמוכה'],
  ['גבוהה', inDays(-1), 'חדש', 7, 'גבוהה'],
  ['נמוכה', inDays(3), 'נוצר קשר', 2, 'נמוכה'],
  ['נמוכה', inDays(4), 'חדש', 2, 'נמוכה'],
];

for (const [interest, followUpDate, status, score, level] of EXAMPLES) {
  test(`AC-8.1 priority example: ${interest}, ${followUpDate ?? 'no date'}, ${status} -> ${score} ${level}`, () => {
    assert.deepEqual(getPriority(makeLead({ interest, followUpDate, status }), TODAY), { score, level });
  });
}

test('AC-8.1 priority component: interest points 3/2/1', () => {
  const base = { status: 'במעקב', followUpDate: inDays(10) }; // follow-up 0, bonus 0
  assert.equal(priorityScore(makeLead({ ...base, interest: 'גבוהה' }), TODAY), 3);
  assert.equal(priorityScore(makeLead({ ...base, interest: 'בינונית' }), TODAY), 2);
  assert.equal(priorityScore(makeLead({ ...base, interest: 'נמוכה' }), TODAY), 1);
});

test('AC-8.1 priority component: follow-up points by distance', () => {
  assert.equal(followUpPoints(inDays(-30), TODAY), 3);
  assert.equal(followUpPoints(inDays(-1), TODAY), 3);
  assert.equal(followUpPoints(inDays(0), TODAY), 2);
  assert.equal(followUpPoints(null, TODAY), 1);
  assert.equal(followUpPoints(inDays(1), TODAY), 1);
  assert.equal(followUpPoints(inDays(3), TODAY), 1);
  assert.equal(followUpPoints(inDays(4), TODAY), 0);
  assert.equal(followUpPoints(inDays(60), TODAY), 0);
});

test('AC-8.1 priority component: follow-up points across month and year boundaries', () => {
  assert.equal(followUpPoints('2027-01-02', '2026-12-30'), 1); // 3 days
  assert.equal(followUpPoints('2027-01-03', '2026-12-30'), 0); // 4 days
  assert.equal(followUpPoints('2026-12-31', '2027-01-01'), 3); // yesterday, previous year
  assert.equal(followUpPoints('2026-12-01', '2026-11-30'), 1); // tomorrow, next month
});

test('AC-8.1 priority component: +1 bonus only for status "חדש"', () => {
  const base = { interest: 'בינונית', followUpDate: inDays(10) };
  assert.equal(priorityScore(makeLead({ ...base, status: 'חדש' }), TODAY), 3);
  assert.equal(priorityScore(makeLead({ ...base, status: 'נוצר קשר' }), TODAY), 2);
  assert.equal(priorityScore(makeLead({ ...base, status: 'במעקב' }), TODAY), 2);
});

test('AC-8.1 priority levels: boundaries 1-2 low, 3-4 medium, 5-7 high', () => {
  assert.equal(priorityLevel(1), 'נמוכה');
  assert.equal(priorityLevel(2), 'נמוכה');
  assert.equal(priorityLevel(3), 'בינונית');
  assert.equal(priorityLevel(4), 'בינונית');
  assert.equal(priorityLevel(5), 'גבוהה');
  assert.equal(priorityLevel(7), 'גבוהה');
});

test('AC-8.1 priority: score always within 1..7 for every open combination', () => {
  const dates = [null, inDays(-5), inDays(0), inDays(1), inDays(3), inDays(4), inDays(30)];
  for (const interest of ['נמוכה', 'בינונית', 'גבוהה']) {
    for (const status of ['חדש', 'נוצר קשר', 'במעקב']) {
      for (const followUpDate of dates) {
        const s = priorityScore(makeLead({ interest, status, followUpDate }), TODAY);
        assert.ok(s >= 1 && s <= 7, `${interest}/${status}/${followUpDate}: ${s}`);
      }
    }
  }
});

test('AC-8.2 priority: closed leads get "לא בתעדוף" and no score', () => {
  for (const status of ['נסגר בהצלחה', 'נסגר ללא עסקה']) {
    const lead = makeLead({ status, interest: 'גבוהה', followUpDate: inDays(-3) });
    assert.deepEqual(getPriority(lead, TODAY), { score: null, level: 'לא בתעדוף' });
  }
});

test('AC-8.1 priority: recalculated from status, interest and follow-up only (rep and notes do not matter)', () => {
  const before = makeLead({ status: 'נוצר קשר', interest: 'בינונית', followUpDate: inDays(10) });
  assert.equal(priorityScore(before, TODAY), 2);
  assert.equal(priorityScore({ ...before, rep: 'עומר טל', notes: 'הערה' }, TODAY), 2);
  assert.equal(priorityScore({ ...before, interest: 'גבוהה' }, TODAY), 3);
  assert.equal(priorityScore({ ...before, followUpDate: inDays(-1) }, TODAY), 5);
  assert.equal(priorityScore({ ...before, status: 'נסגר בהצלחה' }, TODAY), null);
});
