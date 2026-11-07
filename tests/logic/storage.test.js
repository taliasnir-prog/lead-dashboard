import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLeads, saveLeads, getStorage, STORAGE_KEY } from '../../js/storage.js';
import { createDemoLeads } from '../../js/demo-data.js';
import { validateStoredData, nextLeadId, createLead, validateLeadForm, applyEdit } from '../../js/logic.js';
import { TODAY, makeLead } from './helpers.js';

/** In-memory Storage with optional failures. */
function fakeStorage({ initial, failGet = false, failSet = false } = {}) {
  const data = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return {
    sets: 0,
    getItem(key) { if (failGet) throw new Error('get blocked'); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { this.sets += 1; if (failSet) throw new Error('quota'); data.set(key, String(value)); },
    raw() { return data.get(STORAGE_KEY); },
  };
}

const stored = (leads) => JSON.stringify({ version: 1, leads });

test('AC-10.1 first load creates the demo data and saves it in the SPEC structure', () => {
  const storage = fakeStorage();
  const r = loadLeads(storage, TODAY);
  assert.equal(r.leads.length, 30);
  assert.deepEqual([r.invalid, r.canRead, r.saved], [false, true, true]);
  const saved = JSON.parse(storage.raw());
  assert.equal(saved.version, 1);
  assert.deepEqual(saved.leads, r.leads);
  assert.equal(validateStoredData(saved).valid, true);
});

test('AC-10.1 valid saved data is loaded as is, dates are not regenerated', () => {
  const leads = createDemoLeads('2026-11-07');
  leads[0] = { ...leads[0], status: 'במעקב', notes: 'נשמר' };
  const storage = fakeStorage({ initial: stored(leads) });
  const r = loadLeads(storage, '2026-12-01'); // a later day
  assert.deepEqual(r.leads, leads);
  assert.equal(r.leads[0].followUpDate, '2026-11-05'); // not shifted to the new day
  assert.equal(storage.sets, 0); // nothing rewritten
  assert.deepEqual([r.invalid, r.canRead, r.saved], [false, true, true]);
});

test('AC-10.2 added lead survives a reload and the next id is not duplicated', () => {
  const storage = fakeStorage();
  let { leads } = loadLeads(storage, TODAY);
  const values = validateLeadForm({
    name: 'ליד בדיקה', phone: '', email: '', source: 'הפניה', rep: 'נועה ברק',
    status: 'חדש', interest: 'בינונית', value: '', followUpDate: '', notes: '',
  }, 'add').values;
  leads = [...leads, createLead(values, leads, TODAY)];
  assert.deepEqual(saveLeads(storage, leads), { ok: true, reason: 'saved' });
  const reloaded = loadLeads(storage, TODAY).leads;
  assert.equal(reloaded.length, 31);
  assert.equal(reloaded.at(-1).id, 'L-031');
  assert.equal(nextLeadId(reloaded), 'L-032');
});

test('AC-10.1 edit survives a reload', () => {
  const storage = fakeStorage();
  const { leads } = loadLeads(storage, TODAY);
  const edited = leads.map((l) => (l.id === 'L-009' ? applyEdit(l, { status: 'במעקב', notes: 'בדיקת הערה' }) : l));
  saveLeads(storage, edited);
  const lead = loadLeads(storage, TODAY).leads.find((l) => l.id === 'L-009');
  assert.equal(lead.status, 'במעקב');
  assert.equal(lead.notes, 'בדיקת הערה');
});

test('AC-10.4 broken JSON: demo data loaded, flagged invalid, replaced in storage', () => {
  const storage = fakeStorage({ initial: '{not json' });
  const r = loadLeads(storage, TODAY);
  assert.equal(r.leads.length, 30);
  assert.deepEqual([r.invalid, r.canRead, r.saved], [true, true, true]);
  assert.equal(validateStoredData(JSON.parse(storage.raw())).valid, true);
});

for (const [label, value] of [
  ['one lead with an unknown status', stored([makeLead({ id: 'L-001' }), makeLead({ id: 'L-002', status: 'בטיפול' })])],
  ['wrong version', JSON.stringify({ version: 2, leads: [makeLead()] })],
  ['empty leads', JSON.stringify({ version: 1, leads: [] })],
  ['an array', '[]'],
  ['the string null', 'null'],
  ['a number', '42'],
]) {
  test(`AC-10.5 ${label}: whole value rejected, demo data loaded and saved`, () => {
    const storage = fakeStorage({ initial: value });
    const r = loadLeads(storage, TODAY);
    assert.equal(r.leads.length, 30);
    assert.equal(r.invalid, true);
    assert.equal(r.saved, true);
    assert.equal(JSON.parse(storage.raw()).leads.length, 30);
  });
}

test('AC-10.6 getItem throws: demo data in memory, nothing written', () => {
  const storage = fakeStorage({ initial: stored(createDemoLeads(TODAY)), failGet: true });
  const r = loadLeads(storage, TODAY);
  assert.equal(r.leads.length, 30);
  assert.deepEqual([r.invalid, r.canRead, r.saved], [false, false, false]);
  assert.equal(storage.sets, 0); // data that could not be read is never overwritten
});

test('AC-10.6 setItem throws on first load: demo data in memory, not saved', () => {
  const storage = fakeStorage({ failSet: true });
  const r = loadLeads(storage, TODAY);
  assert.equal(r.leads.length, 30);
  assert.deepEqual([r.invalid, r.canRead, r.saved], [false, true, false]);
});

test('AC-10.6 no storage at all (null): demo data in memory', () => {
  const r = loadLeads(null, TODAY);
  assert.equal(r.leads.length, 30);
  assert.deepEqual([r.canRead, r.saved], [false, false]);
  assert.deepEqual(saveLeads(null, r.leads), { ok: false, reason: 'failed' });
});

test('AC-10.6 saveLeads reports "failed" when setItem throws, "saved" otherwise', () => {
  assert.deepEqual(saveLeads(fakeStorage({ failSet: true }), createDemoLeads(TODAY)), { ok: false, reason: 'failed' });
  assert.deepEqual(saveLeads(fakeStorage(), createDemoLeads(TODAY)), { ok: true, reason: 'saved' });
});

test('AC-10.6 getStorage returns null when reading window.localStorage throws', () => {
  const win = {};
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError'); } });
  assert.equal(getStorage(win), null);
  assert.equal(getStorage({}), null);
  const real = fakeStorage();
  assert.equal(getStorage({ localStorage: real }), real);
});
