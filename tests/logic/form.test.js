import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLeadForm, nextLeadId, createLead, applyEdit, validateLead, filterLeads, EDIT_FIELDS,
} from '../../js/logic.js';
import { createDemoLeads } from '../../js/demo-data.js';
import { TODAY, makeLead } from './helpers.js';

const validAdd = (overrides = {}) => ({
  name: 'ליד בדיקה', phone: '', email: '', source: 'הפניה', rep: 'נועה ברק',
  status: 'חדש', interest: 'בינונית', value: '', followUpDate: '', notes: '', ...overrides,
});

// ---------- AC-5.3 add form ----------

test('AC-5.3 add: valid name with all optional fields empty is accepted', () => {
  const r = validateLeadForm(validAdd(), 'add');
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.deepEqual(r.values, {
    name: 'ליד בדיקה', phone: '', email: '', source: 'הפניה', rep: 'נועה ברק',
    status: 'חדש', interest: 'בינונית', value: 0, followUpDate: null, notes: '',
  });
});

const REJECT = [
  ['name', 'א'], ['name', 'א'.repeat(51)], ['name', ''], ['name', '    '],
  ['email', 'abc'], ['email', 'a@b'],
  ['phone', '123'], ['phone', '12345678901'], ['phone', 'abc'],
  ['value', '-5'], ['value', '1.5'], ['value', '10000001'], ['value', '12,000'], ['value', 'abc'],
  ['notes', 'א'.repeat(501)],
  ['followUpDate', '2026-02-30'], ['followUpDate', '07/11/2026'],
  ['source', ''], ['rep', ''], ['status', ''], ['interest', ''], ['status', 'הכל'],
];
for (const [field, value] of REJECT) {
  test(`AC-5.3 add: rejects ${field}=${JSON.stringify(value).slice(0, 30)}`, () => {
    const r = validateLeadForm(validAdd({ [field]: value }), 'add');
    assert.equal(r.valid, false);
    assert.ok(r.errors[field], `no error for ${field}`);
    assert.equal(r.firstInvalid, field);
    assert.deepEqual(Object.keys(r.errors), [field]);
  });
}

test('AC-5.3 add: edge values that must be accepted', () => {
  const ok = [
    { name: 'אב' }, { name: 'א'.repeat(50) }, { name: '  ליד בדיקה  ' },
    { value: '0' }, { value: '10000000' }, { value: ' 12000 ' },
    { notes: 'א'.repeat(500) }, { email: 'test@example.com' }, { followUpDate: '2028-02-29' },
  ];
  for (const o of ok) assert.equal(validateLeadForm(validAdd(o), 'add').valid, true, JSON.stringify(o));
});

test('AC-5.3 add: spaces at the edges are trimmed in every text field', () => {
  const r = validateLeadForm(validAdd({ name: '  רון  ', email: ' a@example.com ', notes: '  הערה  ', value: ' 500 ' }), 'add');
  assert.equal(r.values.name, 'רון');
  assert.equal(r.values.email, 'a@example.com');
  assert.equal(r.values.notes, 'הערה');
  assert.equal(r.values.value, 500);
});

test('AC-5.3 add: errors are in Hebrew and the first invalid field follows screen order', () => {
  const r = validateLeadForm(validAdd({ name: '', email: 'abc', value: '-5' }), 'add');
  assert.deepEqual(Object.keys(r.errors).sort(), ['email', 'name', 'value']);
  assert.equal(r.firstInvalid, 'name');
  for (const msg of Object.values(r.errors)) assert.match(msg, /[֐-׿]/);
});

// ---------- AC-5.4 new id and new lead ----------

test('AC-5.4 nextLeadId: highest id + 1 on the demo data', () => {
  assert.equal(nextLeadId(createDemoLeads(TODAY)), 'L-031');
});

test('AC-5.4 nextLeadId: uses the highest id of all leads, not of a filtered list', () => {
  const leads = createDemoLeads(TODAY);
  const filtered = filterLeads(leads, { query: '', status: 'חדש', source: '', rep: '' }); // max L-007
  assert.equal(nextLeadId(filtered), 'L-008');
  assert.equal(nextLeadId(leads), 'L-031');
});

test('AC-5.4 nextLeadId: gaps and order do not matter', () => {
  assert.equal(nextLeadId([makeLead({ id: 'L-007' }), makeLead({ id: 'L-002' })]), 'L-008');
  assert.equal(nextLeadId([]), 'L-001');
});

test('AC-5.4 two consecutive adds get L-031 then L-032', () => {
  let leads = createDemoLeads(TODAY);
  const values = validateLeadForm(validAdd(), 'add').values;
  const first = createLead(values, leads, TODAY);
  leads = [...leads, first];
  const second = createLead(values, leads, TODAY);
  assert.equal(first.id, 'L-031');
  assert.equal(second.id, 'L-032');
});

test('AC-5.4 createLead builds a full valid lead with createdAt = today', () => {
  const values = validateLeadForm(validAdd({ email: 'x@example.com', value: '7000', followUpDate: '2026-11-20' }), 'add').values;
  const lead = createLead(values, createDemoLeads(TODAY), TODAY);
  assert.equal(lead.createdAt, TODAY);
  assert.equal(lead.value, 7000);
  const v = validateLead(lead);
  assert.equal(v.valid, true, JSON.stringify(v.errors));
});

// ---------- AC-5.5 edit ----------

test('AC-5.5 edit: only the 5 editable fields are read', () => {
  const r = validateLeadForm({
    status: 'במעקב', interest: 'גבוהה', rep: 'עומר טל', followUpDate: '2026-11-06', notes: 'בדיקת הערה',
    name: 'x', value: '-5', email: 'abc',
  }, 'edit');
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.deepEqual(Object.keys(r.values).sort(), [...EDIT_FIELDS].sort());
});

test('AC-5.5 edit: invalid notes, date and empty lists are rejected', () => {
  const base = { status: 'במעקב', interest: 'גבוהה', rep: 'עומר טל', followUpDate: '', notes: '' };
  assert.equal(validateLeadForm({ ...base, notes: 'א'.repeat(501) }, 'edit').firstInvalid, 'notes');
  assert.equal(validateLeadForm({ ...base, followUpDate: '2026-13-01' }, 'edit').firstInvalid, 'followUpDate');
  assert.equal(validateLeadForm({ ...base, status: '' }, 'edit').firstInvalid, 'status');
  assert.equal(validateLeadForm({ ...base, followUpDate: '' }, 'edit').values.followUpDate, null);
});

test('AC-5.5 applyEdit changes only editable fields and does not mutate the original', () => {
  const lead = makeLead({ id: 'L-009', name: 'מורן', value: 5000 });
  const copy = { ...lead };
  const next = applyEdit(lead, { status: 'במעקב', interest: 'גבוהה', rep: 'עומר טל', followUpDate: '2026-11-06', notes: 'הערה', name: 'אחר', value: 1 });
  assert.deepEqual(lead, copy);
  assert.equal(next.name, 'מורן');
  assert.equal(next.value, 5000);
  assert.equal(next.status, 'במעקב');
  assert.equal(next.notes, 'הערה');
  assert.notEqual(next, lead);
});
