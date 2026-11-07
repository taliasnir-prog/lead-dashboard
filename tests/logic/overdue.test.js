import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOverdue, OPEN_STATUSES } from '../../js/logic.js';
import { TODAY, makeLead } from './helpers.js';

test('AC-7.1 overdue: open lead dated yesterday is overdue', () => {
  for (const status of OPEN_STATUSES) {
    assert.equal(isOverdue(makeLead({ status, followUpDate: '2026-11-06' }), TODAY), true, status);
  }
});

test('AC-7.1 overdue: follow-up today is not overdue', () => {
  assert.equal(isOverdue(makeLead({ followUpDate: '2026-11-07' }), TODAY), false);
});

test('AC-7.1 overdue: follow-up tomorrow is not overdue', () => {
  assert.equal(isOverdue(makeLead({ followUpDate: '2026-11-08' }), TODAY), false);
});

test('AC-7.1 overdue: lead without a follow-up date is not overdue', () => {
  assert.equal(isOverdue(makeLead({ followUpDate: null }), TODAY), false);
});

test('AC-7.1 overdue: closed leads with a past date are never overdue', () => {
  for (const status of ['נסגר בהצלחה', 'נסגר ללא עסקה']) {
    assert.equal(isOverdue(makeLead({ status, followUpDate: '2026-11-01' }), TODAY), false, status);
  }
});

test('AC-7.1 overdue: month and year boundaries', () => {
  assert.equal(isOverdue(makeLead({ followUpDate: '2026-10-31' }), '2026-11-01'), true);
  assert.equal(isOverdue(makeLead({ followUpDate: '2026-11-01' }), '2026-11-01'), false);
  assert.equal(isOverdue(makeLead({ followUpDate: '2026-12-31' }), '2027-01-01'), true);
  assert.equal(isOverdue(makeLead({ followUpDate: '2027-01-01' }), '2026-12-31'), false);
});
