// Issue #4: the 500-lead limit (AC-5.7) and validation before writing (AC-10.8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAddLead, addLead, validateLeadForm, nextLeadId, validateStoredData, MAX_LEADS, LIMIT_MESSAGE,
} from '../../js/logic.js';
import { saveLeads, loadLeads, STORAGE_KEY } from '../../js/storage.js';
import { createDemoLeads } from '../../js/demo-data.js';
import { TODAY } from './helpers.js';

/** `count` valid leads with ids L-001.. built from the demo data. */
function leadsOf(count) {
  const demo = createDemoLeads(TODAY);
  return Array.from({ length: count }, (_, i) => ({
    ...demo[i % demo.length],
    id: `L-${String(i + 1).padStart(3, '0')}`,
    name: `ליד ${i + 1}`,
  }));
}

const values = validateLeadForm({
  name: 'ליד בדיקה', phone: '', email: '', source: 'הפניה', rep: 'נועה ברק',
  status: 'חדש', interest: 'בינונית', value: '', followUpDate: '', notes: '',
}, 'add').values;

function fakeStorage(initial) {
  const data = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return {
    sets: 0,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem(k, v) { this.sets += 1; data.set(k, String(v)); },
    raw: () => data.get(STORAGE_KEY),
  };
}

test('AC-5.7 the limit is 500 leads', () => {
  assert.equal(MAX_LEADS, 500);
  assert.match(LIMIT_MESSAGE, /500/);
});

test('AC-5.7 with 499 leads the 500th can be added and gets L-500', () => {
  const leads = leadsOf(499);
  assert.equal(canAddLead(leads), true);
  const r = addLead(leads, values, TODAY);
  assert.equal(r.ok, true);
  assert.equal(r.lead.id, 'L-500');
  assert.equal(r.leads.length, 500);
  assert.equal(leads.length, 499); // input not changed
  assert.equal(validateStoredData({ version: 1, leads: r.leads }).valid, true);
});

test('AC-5.7 with 500 leads the 501st is blocked in the logic, list unchanged', () => {
  const leads = leadsOf(500);
  assert.equal(canAddLead(leads), false);
  const r = addLead(leads, values, TODAY);
  assert.equal(r.ok, false);
  assert.equal(r.error, LIMIT_MESSAGE);
  assert.equal(r.leads, leads);
  assert.equal(r.leads.length, 500);
});

test('AC-10.8 500 leads are saved and load back after a reload', () => {
  const storage = fakeStorage();
  const leads = leadsOf(500);
  assert.deepEqual(saveLeads(storage, leads), { ok: true, reason: 'saved' });
  const loaded = loadLeads(storage, TODAY);
  assert.equal(loaded.invalid, false);
  assert.equal(loaded.leads.length, 500);
  assert.equal(nextLeadId(loaded.leads), 'L-501');
  assert.equal(canAddLead(loaded.leads), false);
});

for (const [label, make] of [
  ['501 leads', () => leadsOf(501)],
  ['a lead with an unknown status', () => { const l = leadsOf(3); l[1] = { ...l[1], status: 'בטיפול' }; return l; }],
  ['a duplicate id', () => { const l = leadsOf(3); l[2] = { ...l[2], id: 'L-001' }; return l; }],
  ['no leads', () => []],
]) {
  test(`AC-10.8 saveLeads does not write ${label}; the last valid value stays`, () => {
    const valid = JSON.stringify({ version: 1, leads: leadsOf(30) });
    const storage = fakeStorage(valid);
    assert.deepEqual(saveLeads(storage, make()), { ok: false, reason: 'invalid' });
    assert.equal(storage.sets, 0);
    assert.equal(storage.raw(), valid);
  });
}
