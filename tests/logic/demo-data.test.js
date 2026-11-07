import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoLeads } from '../../js/demo-data.js';
import {
  REPS, isOpen, isOverdue, validateLead, validateStoredData, getPriority, LEAD_FIELDS,
} from '../../js/logic.js';
import { TODAY } from './helpers.js';

function countBy(leads, field) {
  return leads.reduce((acc, lead) => ({ ...acc, [lead[field]]: (acc[lead[field]] ?? 0) + 1 }), {});
}

function followUpProfile(leads, today) {
  const open = leads.filter(isOpen);
  return {
    overdue: open.filter((l) => isOverdue(l, today)).length,
    today: open.filter((l) => l.followUpDate === today).length,
    noDate: open.filter((l) => l.followUpDate === null).length,
    future: open.filter((l) => l.followUpDate !== null && l.followUpDate > today).length,
  };
}

const leads = createDemoLeads(TODAY);

test('AC-1.2 demo data: 30 leads with unique ids', () => {
  assert.equal(leads.length, 30);
  assert.equal(new Set(leads.map((l) => l.id)).size, 30);
});

test('AC-1.2 demo data: status counts 7/7/7/5/4', () => {
  assert.deepEqual(countBy(leads, 'status'), {
    'חדש': 7, 'נוצר קשר': 7, 'במעקב': 7, 'נסגר בהצלחה': 5, 'נסגר ללא עסקה': 4,
  });
});

test('AC-1.2 demo data: source counts Facebook 10, Google 8, אתר 7, הפניה 5', () => {
  assert.deepEqual(countBy(leads, 'source'), { Facebook: 10, Google: 8, 'אתר': 7, 'הפניה': 5 });
});

test('AC-1.2 demo data: every rep has at least 6 leads', () => {
  const byRep = countBy(leads, 'rep');
  for (const rep of REPS) assert.ok(byRep[rep] >= 6, `${rep}: ${byRep[rep]}`);
});

test('AC-1.2 demo data: won deal values sum to 60,000', () => {
  const won = leads.filter((l) => l.status === 'נסגר בהצלחה').map((l) => l.value).sort((a, b) => a - b);
  assert.deepEqual(won, [4500, 8500, 12000, 15000, 20000]);
  assert.equal(won.reduce((a, b) => a + b, 0), 60000);
});

test('AC-1.2 demo data: open leads cover overdue (>=4), today (>=2), no date (>=3) and future', () => {
  const p = followUpProfile(leads, TODAY);
  assert.ok(p.overdue >= 4, `overdue ${p.overdue}`);
  assert.ok(p.today >= 2, `today ${p.today}`);
  assert.ok(p.noDate >= 3, `noDate ${p.noDate}`);
  assert.ok(p.future >= 1, `future ${p.future}`);
  assert.equal(p.overdue + p.today + p.noDate + p.future, 21);
});

test('AC-1.2 demo data: at least one closed lead with a past follow-up date', () => {
  const closedPast = leads.filter((l) => !isOpen(l) && l.followUpDate !== null && l.followUpDate < TODAY);
  assert.ok(closedPast.length >= 1);
});

test('AC-1.2 demo data: phone is empty for every lead', () => {
  for (const lead of leads) assert.equal(lead.phone, '', lead.id);
});

test('AC-1.2 demo data: every non-empty email is on example.com', () => {
  for (const lead of leads) {
    if (lead.email !== '') assert.match(lead.email, /@example\.com$/, lead.id);
  }
});

test('AC-1.2 demo data: every lead has exactly the 12 SPEC fields and passes validateLead', () => {
  for (const lead of leads) {
    assert.deepEqual(Object.keys(lead).sort(), [...LEAD_FIELDS].sort(), lead.id);
    const result = validateLead(lead);
    assert.ok(result.valid, `${lead.id}: ${JSON.stringify(result.errors)}`);
  }
});

test('AC-1.2 demo data: wrapped as stored value passes validateStoredData', () => {
  const result = validateStoredData({ version: 1, leads });
  assert.ok(result.valid, result.errors.join('\n'));
});

test('AC-1.2 demo data: includes the leads future UI tests need (AC-5.5, AC-8.3)', () => {
  const inTenDays = (l) => l.followUpDate === '2026-11-17';
  const contacted = leads.find((l) => l.status === 'נוצר קשר' && l.interest === 'בינונית' && inTenDays(l));
  const following = leads.find((l) => l.status === 'במעקב' && l.interest === 'בינונית' && inTenDays(l));
  assert.ok(contacted, 'missing: נוצר קשר + בינונית + 10 days');
  assert.ok(following, 'missing: במעקב + בינונית + 10 days');
  assert.deepEqual(getPriority(contacted, TODAY), { score: 2, level: 'נמוכה' });
  assert.deepEqual(getPriority(following, TODAY), { score: 2, level: 'נמוכה' });
});

test('AC-1.2 demo data: AC-4.2 scenario has matches (במעקב + Facebook)', () => {
  assert.ok(leads.some((l) => l.status === 'במעקב' && l.source === 'Facebook'));
});

test('AC-1.3 demo data: same follow-up profile on 2026-11-07 and 2027-03-15', () => {
  const a = followUpProfile(createDemoLeads('2026-11-07'), '2026-11-07');
  const b = followUpProfile(createDemoLeads('2027-03-15'), '2027-03-15');
  assert.deepEqual(a, b);
});

test('AC-1.3 demo data: same profile across a year boundary (2026-12-31)', () => {
  const a = followUpProfile(createDemoLeads('2026-11-07'), '2026-11-07');
  const b = followUpProfile(createDemoLeads('2026-12-31'), '2026-12-31');
  assert.deepEqual(a, b);
});

test('AC-1.3 demo data: each call returns new objects', () => {
  const first = createDemoLeads(TODAY);
  first[0].status = 'נסגר בהצלחה';
  assert.equal(createDemoLeads(TODAY)[0].status, 'חדש');
});
