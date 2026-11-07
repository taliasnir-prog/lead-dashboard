// Set the zone before any Date is created in this file.
process.env.TZ = 'Asia/Jerusalem';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLocalDateString, isValidDateString, addDays, daysBetween } from '../../js/logic.js';

test('AC-7.2 local date: 00:30 on 07.11.2026 in Asia/Jerusalem is 2026-11-07, not the UTC date', () => {
  const justAfterMidnight = new Date(2026, 10, 7, 0, 30);
  assert.equal(toLocalDateString(justAfterMidnight), '2026-11-07');
  // Proves the time zone is active and that the naive UTC approach would be wrong.
  assert.equal(justAfterMidnight.toISOString().slice(0, 10), '2026-11-06');
});

test('AC-7.2 local date: 00:15 on 01.01.2027 is 2027-01-01 (year boundary)', () => {
  const newYear = new Date(2027, 0, 1, 0, 15);
  assert.equal(toLocalDateString(newYear), '2027-01-01');
  assert.equal(newYear.toISOString().slice(0, 10), '2026-12-31');
});

test('AC-7.2 local date: 00:30 in summer time (DST) is still the local date', () => {
  const summer = new Date(2026, 6, 15, 0, 30);
  assert.equal(toLocalDateString(summer), '2026-07-15');
});

test('AC-7.2 dates: addDays across month, year and leap-year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(addDays('2026-11-07', 10), '2026-11-17');
  assert.equal(addDays('2026-11-07', 0), '2026-11-07');
});

test('AC-7.2 dates: daysBetween across month/year boundaries and DST changes', () => {
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(daysBetween('2027-01-02', '2026-12-30'), -3);
  assert.equal(daysBetween('2026-10-31', '2026-11-01'), 1);
  // Israel summer time starts 27.03.2026 and ends 25.10.2026.
  assert.equal(daysBetween('2026-03-26', '2026-03-28'), 2);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(daysBetween('2026-11-07', '2026-11-07'), 0);
});

test('AC-7.2 dates: isValidDateString accepts real dates only', () => {
  for (const ok of ['2026-11-07', '2028-02-29', '2026-12-31']) assert.ok(isValidDateString(ok), ok);
  for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '07/11/2026', '2026-1-7', '', null, 20261107]) {
    assert.ok(!isValidDateString(bad), String(bad));
  }
});
