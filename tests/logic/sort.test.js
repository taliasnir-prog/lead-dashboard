// Sort selector (SPEC 1.5): "לפי עדיפות" keeps the existing order, "נוספו לאחרונה" is newest first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sortLeads, sortLeadsBy, sortLeadsByRecent, idNumber, addLead, SORT_MODES, DEFAULT_SORT, SORT_LABELS,
} from '../../js/logic.js';
import { createDemoLeads } from '../../js/demo-data.js';
import { TODAY, makeLead } from './helpers.js';

const ids = (leads) => leads.map((l) => l.id);

test('AC-3.3 sort modes: two options, default is priority, Hebrew labels', () => {
  assert.deepEqual(Object.values(SORT_MODES), ['priority', 'recent']);
  assert.equal(DEFAULT_SORT, 'priority');
  assert.equal(SORT_LABELS.priority, 'לפי עדיפות');
  assert.equal(SORT_LABELS.recent, 'נוספו לאחרונה');
});

test('AC-3.2 sort modes: "priority" is exactly the existing default order', () => {
  const leads = createDemoLeads(TODAY);
  assert.deepEqual(ids(sortLeadsBy('priority', leads, TODAY)), ids(sortLeads(leads, TODAY)));
});

test('AC-3.3 sort modes: an unknown mode falls back to the priority order', () => {
  const leads = createDemoLeads(TODAY);
  assert.deepEqual(ids(sortLeadsBy('zzz', leads, TODAY)), ids(sortLeads(leads, TODAY)));
  assert.deepEqual(ids(sortLeadsBy(undefined, leads, TODAY)), ids(sortLeads(leads, TODAY)));
});

test('AC-3.3 idNumber: numeric part of the id', () => {
  assert.equal(idNumber('L-001'), 1);
  assert.equal(idNumber('L-031'), 31);
  assert.equal(idNumber('L-500'), 500);
});

test('AC-3.3 recent: newest createdAt first', () => {
  const leads = [
    makeLead({ id: 'L-001', createdAt: '2026-10-01' }),
    makeLead({ id: 'L-002', createdAt: '2026-11-07' }),
    makeLead({ id: 'L-003', createdAt: '2026-10-15' }),
  ];
  assert.deepEqual(ids(sortLeadsByRecent(leads)), ['L-002', 'L-003', 'L-001']);
});

test('AC-3.3 recent: same createdAt -> higher id number first', () => {
  const leads = ['L-010', 'L-100', 'L-099', 'L-002'].map((id) => makeLead({ id, createdAt: '2026-11-07' }));
  assert.deepEqual(ids(sortLeadsByRecent(leads)), ['L-100', 'L-099', 'L-010', 'L-002']);
});

test('AC-3.3 recent: closed leads are mixed in by date, not moved to the end', () => {
  const leads = [
    makeLead({ id: 'L-001', status: 'חדש', interest: 'גבוהה', createdAt: '2026-10-01' }),
    makeLead({ id: 'L-002', status: 'נסגר בהצלחה', createdAt: '2026-11-07' }),
    makeLead({ id: 'L-003', status: 'נסגר ללא עסקה', createdAt: '2026-10-20' }),
  ];
  assert.deepEqual(ids(sortLeadsByRecent(leads)), ['L-002', 'L-003', 'L-001']);
});

test('AC-3.3 recent: demo data -> all 30, from L-030 down to L-001 (createdAt grows with the id)', () => {
  const sorted = sortLeadsBy('recent', createDemoLeads(TODAY), TODAY);
  assert.equal(sorted.length, 30);
  assert.deepEqual(ids(sorted), Array.from({ length: 30 }, (_, i) => `L-${String(30 - i).padStart(3, '0')}`));
  for (let i = 1; i < sorted.length; i += 1) assert.ok(sorted[i].createdAt <= sorted[i - 1].createdAt, `index ${i}`);
});

test('AC-3.3 recent: two consecutive adds on the same day -> L-032, L-031, then the demo leads', () => {
  const values = {
    name: 'ליד', phone: '', email: '', source: 'Google', status: 'חדש', interest: 'בינונית',
    rep: 'נועה ברק', value: 0, followUpDate: null, notes: '',
  };
  const first = addLead(createDemoLeads(TODAY), values, TODAY);
  const second = addLead(first.leads, values, TODAY);
  assert.equal(second.lead.createdAt, first.lead.createdAt);
  assert.deepEqual(ids(sortLeadsByRecent(second.leads)).slice(0, 4), ['L-032', 'L-031', 'L-030', 'L-029']);
});

test('AC-3.3 recent: does not mutate the input array', () => {
  const leads = createDemoLeads(TODAY);
  const before = ids(leads);
  sortLeadsByRecent(leads);
  assert.deepEqual(ids(leads), before);
});
