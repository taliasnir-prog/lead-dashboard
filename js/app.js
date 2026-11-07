// Read-only dashboard view. Renders demo data held in memory (no saving yet).
// All text is set with textContent, never innerHTML, so lead data cannot inject markup.

import {
  toLocalDateString, computeMetrics, countBySource, sortLeads, getPriority, isOverdue,
  formatCurrency, formatDate, PRIORITY,
} from './logic.js';
import { createDemoLeads } from './demo-data.js';

const STATUS_CLASS = {
  'חדש': 'st-new',
  'נוצר קשר': 'st-contact',
  'במעקב': 'st-follow',
  'נסגר בהצלחה': 'st-won',
  'נסגר ללא עסקה': 'st-lost',
};

const PRIORITY_CLASS = {
  [PRIORITY.HIGH]: 'pr-high',
  [PRIORITY.MEDIUM]: 'pr-med',
  [PRIORITY.LOW]: 'pr-low',
  [PRIORITY.NONE]: 'pr-none',
};

function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.append(child);
  return node;
}

/** Numbers, ids and dates are isolated so they keep their own direction inside RTL text. */
const bdi = (text) => el('bdi', { text });

function renderMetrics(leads) {
  const m = computeMetrics(leads);
  document.querySelector('[data-testid="metric-total"]').replaceChildren(bdi(String(m.total)));
  document.querySelector('[data-testid="metric-new"]').replaceChildren(bdi(String(m.newCount)));
  document.querySelector('[data-testid="metric-won"]').replaceChildren(bdi(String(m.wonCount)));
  document.querySelector('[data-testid="metric-won-value"]').replaceChildren(bdi(formatCurrency(m.wonValue)));
}

function renderChart(leads) {
  const chart = document.querySelector('[data-testid="source-chart"]');
  const counts = countBySource(leads);
  const max = Math.max(1, ...counts.map((c) => c.count));
  chart.setAttribute(
    'aria-label',
    `חלוקת לידים לפי מקור הגעה: ${counts.map((c) => `${c.source} ${c.count}`).join(', ')}`,
  );
  chart.replaceChildren(...counts.map(({ source, count }) => {
    const fill = el('div', { className: 'bar-fill' });
    fill.style.width = `${(count / max) * 100}%`;
    return el('div', { className: 'bar-row', attrs: { 'data-source': source, 'aria-hidden': 'true' } }, [
      el('span', { className: 'bar-label', text: source }),
      el('div', { className: 'bar-track' }, [fill]),
      el('span', { className: 'bar-count', text: String(count), attrs: { 'data-testid': 'bar-count' } }),
    ]);
  }));
}

function followUpCell(lead, today) {
  if (lead.followUpDate === null) {
    return el('td', { attrs: { 'data-col': 'followUp' } }, [el('span', { className: 'no-date', text: formatDate(null) })]);
  }
  const children = [bdi(formatDate(lead.followUpDate))];
  if (isOverdue(lead, today)) {
    children.push(el('span', { className: 'overdue-tag', text: 'באיחור', attrs: { 'data-testid': 'overdue-tag' } }));
  }
  return el('td', { attrs: { 'data-col': 'followUp' } }, children);
}

function priorityCell(lead, today) {
  const { score, level } = getPriority(lead, today);
  const children = [el('span', { className: `badge ${PRIORITY_CLASS[level]}`, text: level })];
  if (score !== null) children.push(el('span', { className: 'score', text: `(${score})` }));
  return el('td', { attrs: { 'data-col': 'priority' } }, children);
}

function renderTable(leads, today) {
  const tbody = document.querySelector('[data-testid="leads-table"] tbody');
  tbody.replaceChildren(...sortLeads(leads, today).map((lead) => {
    const row = el('tr', { attrs: { 'data-id': lead.id } }, [
      el('td', { attrs: { 'data-col': 'id' } }, [bdi(lead.id)]),
      el('td', { text: lead.name, attrs: { 'data-col': 'name' } }),
      el('td', { attrs: { 'data-col': 'source' } }, [bdi(lead.source)]),
      el('td', { text: lead.rep, attrs: { 'data-col': 'rep' } }),
      el('td', { attrs: { 'data-col': 'status' } }, [el('span', { className: `badge ${STATUS_CLASS[lead.status]}`, text: lead.status })]),
      el('td', { text: lead.interest, attrs: { 'data-col': 'interest' } }),
      el('td', { className: 'num', attrs: { 'data-col': 'value' } }, [bdi(formatCurrency(lead.value))]),
      followUpCell(lead, today),
      priorityCell(lead, today),
    ]);
    if (isOverdue(lead, today)) row.classList.add('is-overdue');
    return row;
  }));
}

function setupPriorityHelp() {
  const button = document.querySelector('[data-testid="priority-help-button"]');
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  });
}

function init() {
  const today = toLocalDateString(new Date());
  const leads = createDemoLeads(today);
  renderMetrics(leads);
  renderChart(leads);
  renderTable(leads, today);
  setupPriorityHelp();
}

init();
