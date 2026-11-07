import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterLeads, sortLeads, EMPTY_FILTERS, STATUSES, SOURCES, REPS,
} from '../../js/logic.js';
import { createDemoLeads } from '../../js/demo-data.js';
import { TODAY, makeLead } from './helpers.js';

const leads = createDemoLeads(TODAY);
const ids = (list) => list.map((l) => l.id);

test('AC-4.1 search: part of a name', () => {
  assert.deepEqual(ids(filterLeads(leads, { ...EMPTY_FILTERS, query: 'מור' })), ['L-009', 'L-028']);
});

test('AC-4.1 search: spaces at the edges are ignored', () => {
  assert.deepEqual(
    ids(filterLeads(leads, { ...EMPTY_FILTERS, query: '   מור  ' })),
    ids(filterLeads(leads, { ...EMPTY_FILTERS, query: 'מור' })),
  );
});

test('AC-4.1 search: spaces only means no search', () => {
  assert.equal(filterLeads(leads, { ...EMPTY_FILTERS, query: '   ' }).length, 30);
});

test('AC-4.1 search: inner space is part of the text ("בן עמי")', () => {
  assert.deepEqual(ids(filterLeads(leads, { ...EMPTY_FILTERS, query: 'בן עמי' })), ['L-019']);
});

test('AC-4.1 search: letter case is ignored', () => {
  const list = [makeLead({ id: 'L-001', name: 'Dana Test' }), makeLead({ id: 'L-002', name: 'רון' })];
  assert.deepEqual(ids(filterLeads(list, { ...EMPTY_FILTERS, query: 'dana' })), ['L-001']);
  assert.deepEqual(ids(filterLeads(list, { ...EMPTY_FILTERS, query: 'TEST' })), ['L-001']);
});

test('AC-4.4 search: no match returns an empty list', () => {
  assert.deepEqual(filterLeads(leads, { ...EMPTY_FILTERS, query: 'zzz' }), []);
});

test('AC-4.2 each list alone: status, source and rep', () => {
  for (const status of STATUSES) {
    const result = filterLeads(leads, { ...EMPTY_FILTERS, status });
    assert.ok(result.length > 0 && result.every((l) => l.status === status), status);
  }
  assert.equal(filterLeads(leads, { ...EMPTY_FILTERS, source: 'Google' }).length, 8);
  assert.equal(filterLeads(leads, { ...EMPTY_FILTERS, rep: 'נועה ברק' }).length, 8);
});

test('AC-4.2 combination: status + source + rep + search letter', () => {
  const f = { query: 'ק', status: 'במעקב', source: 'Facebook', rep: 'מאיה גל' };
  assert.deepEqual(ids(filterLeads(leads, f)), ['L-015']);
});

test('AC-4.2 combination: every status x source x rep matches a manual filter', () => {
  for (const status of ['', ...STATUSES]) {
    for (const source of ['', ...SOURCES]) {
      for (const rep of ['', ...REPS]) {
        for (const query of ['', 'א', ' ר ']) {
          const expected = leads.filter((l) => (!status || l.status === status)
            && (!source || l.source === source) && (!rep || l.rep === rep)
            && (!query.trim() || l.name.includes(query.trim())));
          assert.deepEqual(ids(filterLeads(leads, { query, status, source, rep })), ids(expected),
            `${status}/${source}/${rep}/${query}`);
        }
      }
    }
  }
});

test('AC-4.3 empty filters return all leads', () => {
  assert.equal(filterLeads(leads, EMPTY_FILTERS).length, 30);
  assert.equal(filterLeads(leads).length, 30);
});

test('AC-4.2 filter keeps the default order of the sorted list', () => {
  const sorted = sortLeads(leads, TODAY);
  const f = { ...EMPTY_FILTERS, source: 'Facebook' };
  assert.deepEqual(ids(filterLeads(sorted, f)), ids(sorted).filter((id) => f.source === leads.find((l) => l.id === id).source));
  // Filtering then sorting gives the same result as sorting then filtering.
  assert.deepEqual(ids(sortLeads(filterLeads(leads, f), TODAY)), ids(filterLeads(sorted, f)));
});

test('AC-4.2 filter does not change the input array or the leads', () => {
  const copy = JSON.parse(JSON.stringify(leads));
  filterLeads(leads, { query: 'א', status: 'חדש', source: 'Google', rep: 'איתי שמש' });
  assert.deepEqual(leads, copy);
  assert.notEqual(filterLeads(leads), leads); // always a new array
});
