// Pure validation shared by demo data (AC-1.2) and, later, localStorage loading (AC-10.5).
// Storage itself is not implemented yet; these tests cover only the pure validator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, validateStoredData, validateField } from '../../js/logic.js';
import { makeLead } from './helpers.js';

const twoValid = () => [makeLead({ id: 'L-001' }), makeLead({ id: 'L-002' })];

test('AC-1.2 validation: a valid lead passes', () => {
  const result = validateLead(makeLead());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('AC-1.2 validation: optional fields may be empty, filled values must be valid', () => {
  assert.equal(validateLead(makeLead({ phone: '', email: '', notes: '', followUpDate: null, value: 0 })).valid, true);
  assert.equal(validateLead(makeLead({ phone: '050-0000000', email: 'a@example.com' })).valid, true);
});

test('AC-1.2 validation: field rules from SPEC section 6', () => {
  const rejected = [
    ['id', 'abc'], ['id', 'L-1'], ['id', 'L-0001'],
    ['name', 'א'], ['name', 'א'.repeat(51)], ['name', '   '], ['name', 5],
    ['phone', '123'], ['phone', '05000000000'], ['phone', '050 0000000'],
    ['email', 'abc'], ['email', 'a@b'], ['email', 'a b@example.com'],
    ['source', 'TikTok'], ['rep', 'דני'], ['status', 'בטיפול'], ['interest', 'מאוד'],
    ['value', -100], ['value', '5000'], ['value', 1.5], ['value', 10_000_001], ['value', null],
    ['followUpDate', '07/11/2026'], ['followUpDate', '2026-13-01'], ['followUpDate', '2026-02-30'], ['followUpDate', ''],
    ['notes', 'א'.repeat(501)], ['notes', null],
    ['createdAt', null], ['createdAt', '2026-02-30'],
  ];
  for (const [field, value] of rejected) {
    assert.notEqual(validateField(field, value), null, `${field}=${JSON.stringify(value)} should be rejected`);
  }
  const accepted = [
    ['name', 'אב'], ['name', 'א'.repeat(50)], ['name', '  ליד בדיקה  '],
    ['phone', '0500000000'], ['phone', '050-000-0000'], ['phone', '030000000'],
    ['value', 0], ['value', 10_000_000],
    ['notes', 'א'.repeat(500)], ['followUpDate', '2028-02-29'],
  ];
  for (const [field, value] of accepted) {
    assert.equal(validateField(field, value), null, `${field}=${JSON.stringify(value)} should be accepted`);
  }
});

test('AC-10.5 validation (logic only): a valid stored value with 2 leads is accepted', () => {
  const result = validateStoredData({ version: 1, leads: twoValid() });
  assert.equal(result.valid, true, result.errors.join('\n'));
});

// TEST_PLAN.md, "ערכים שבדיקת המבנה חייבת לדחות" (12 items)
const withLead = (overrides) => ({ version: 1, leads: [makeLead({ id: 'L-001' }), makeLead({ id: 'L-002', ...overrides })] });
const withoutName = () => {
  const lead = makeLead({ id: 'L-002' });
  delete lead.name;
  return { version: 1, leads: [makeLead({ id: 'L-001' }), lead] };
};

const MUST_REJECT = [
  ['1. array instead of object', []],
  ['2. version 2', { version: 2, leads: twoValid() }],
  ['3. no leads', { version: 1, leads: [] }],
  ['4. leads is a string', { version: 1, leads: 'abc' }],
  ['5. lead without name', withoutName()],
  ['6. lead with an extra field', withLead({ extra: 1 })],
  ['7a. unknown status', withLead({ status: 'בטיפול' })],
  ['7b. unknown source', withLead({ source: 'TikTok' })],
  ['7c. unknown rep', withLead({ rep: 'דני' })],
  ['7d. unknown interest', withLead({ interest: 'מאוד' })],
  ['8a. negative value', withLead({ value: -100 })],
  ['8b. value as string', withLead({ value: '5000' })],
  ['8c. fractional value', withLead({ value: 1.5 })],
  ['9a. date in DD/MM/YYYY', withLead({ followUpDate: '07/11/2026' })],
  ['9b. month 13', withLead({ followUpDate: '2026-13-01' })],
  ['10a. bad id', withLead({ id: 'abc' })],
  ['10b. duplicate id', { version: 1, leads: [makeLead({ id: 'L-001' }), makeLead({ id: 'L-001' })] }],
  ['11. notes of 501 characters', withLead({ notes: 'א'.repeat(501) })],
  ['12. lead is null', { version: 1, leads: [makeLead({ id: 'L-001' }), null] }],
  ['extra: null value', null],
  ['extra: missing version', { leads: twoValid() }],
  ['extra: more than 500 leads', {
    version: 1,
    leads: Array.from({ length: 501 }, (_, i) => makeLead({ id: `L-${String(i % 1000).padStart(3, '0')}` })),
  }],
];

for (const [label, value] of MUST_REJECT) {
  test(`AC-10.5 validation (logic only): rejects ${label}`, () => {
    const result = validateStoredData(value);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });
}

test('AC-10.5 validation (logic only): one bad lead rejects the whole value (no partial fix)', () => {
  const leads = twoValid();
  leads[1].status = 'בטיפול';
  const result = validateStoredData({ version: 1, leads });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
});
