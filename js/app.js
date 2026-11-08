// Dashboard UI: view, filters, lead details, add, edit, local saving and reset.
// Data is saved in localStorage (js/storage.js); if that fails, the page keeps working in memory.
// All text is set with textContent, never innerHTML, so lead data cannot inject markup.

import {
  toLocalDateString, computeMetrics, countBySource, sortLeadsBy, filterLeads, getPriority, isOverdue,
  formatCurrency, formatDate, validateLeadForm, addLead, canAddLead, applyEdit, LIMIT_MESSAGE,
  PRIORITY, STATUSES, SOURCES, REPS, INTEREST_LEVELS, EMPTY_FILTERS, ADD_FIELDS, EDIT_FIELDS,
  SORT_MODES, SORT_LABELS, DEFAULT_SORT,
} from './logic.js';
import { createDemoLeads } from './demo-data.js';
import { getStorage, loadLeads, saveLeads } from './storage.js';

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

const $ = (testid) => document.querySelector(`[data-testid="${testid}"]`);

function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.append(child);
  return node;
}

/** Numbers, ids and dates are isolated so they keep their own direction inside RTL text. */
const bdi = (text, attrs) => el('bdi', { text, attrs });

// ---------- State ----------

const state = {
  today: '', leads: [], sorted: [], sortMode: DEFAULT_SORT,
  storage: null, canRead: false, saved: false, invalid: false, rejected: false,
  highlightId: null, highlightTimer: null,
};

const HIGHLIGHT_MS = 3000;

/** Saves the current leads. Never writes when the stored data could not be read. Returns true if saved. */
function persist() {
  const result = state.canRead ? saveLeads(state.storage, state.leads) : { ok: false, reason: 'failed' };
  state.saved = result.ok;
  state.rejected = result.reason === 'invalid';
  updateStorageNotices();
  return state.saved;
}

function updateStorageNotices() {
  $('storage-unavailable').hidden = state.saved || state.rejected;
  $('storage-rejected').hidden = !state.rejected;
  $('storage-invalid').hidden = !state.invalid;
}

/** At 500 leads the add button is disabled and the limit is explained; editing still works. */
function updateAddAvailability() {
  const can = canAddLead(state.leads);
  $('add-lead-button').disabled = !can;
  const note = $('add-limit');
  note.hidden = can;
  note.textContent = can ? '' : LIMIT_MESSAGE;
}

/** Replace the whole list (never mutate it) and redraw everything that depends on it. */
function setLeads(leads) {
  state.leads = leads;
  state.sorted = sortLeadsBy(state.sortMode, leads, state.today);
  renderMetrics(state.leads);
  renderChart(state.leads);
  renderResults();
  updateAddAvailability();
}

// ---------- Cards and chart (always all leads) ----------

function renderMetrics(leads) {
  const m = computeMetrics(leads);
  $('metric-total').replaceChildren(bdi(String(m.total)));
  $('metric-new').replaceChildren(bdi(String(m.newCount)));
  $('metric-won').replaceChildren(bdi(String(m.wonCount)));
  $('metric-won-value').replaceChildren(bdi(formatCurrency(m.wonValue)));
}

function renderChart(leads) {
  const chart = $('source-chart');
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

// ---------- Table ----------

/**
 * The lead name itself opens the details (SPEC 1.4). It is a button styled as a link, with an
 * underline always, because it opens a dialog and does not navigate. The accessible name keeps
 * the visible name and adds what the button does.
 */
function nameCell(lead) {
  const button = el('button', {
    className: 'name-link name-text',
    text: lead.name,
    attrs: {
      type: 'button',
      'data-testid': 'details-button',
      'data-id': lead.id,
      'aria-label': `פרטי ליד: ${lead.name}`,
      'aria-haspopup': 'dialog',
    },
  });
  return el('td', { attrs: { 'data-col': 'name' } }, [button]);
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

/** Renders the given leads, already filtered and sorted. */
function renderTable(visibleLeads, today) {
  const tbody = document.querySelector('[data-testid="leads-table"] tbody');
  tbody.replaceChildren(...visibleLeads.map((lead) => {
    const row = el('tr', { attrs: { 'data-id': lead.id } }, [
      el('td', { attrs: { 'data-col': 'id' } }, [bdi(lead.id)]),
      nameCell(lead),
      el('td', { attrs: { 'data-col': 'source' } }, [bdi(lead.source)]),
      el('td', { text: lead.rep, attrs: { 'data-col': 'rep' } }),
      el('td', { attrs: { 'data-col': 'status' } }, [el('span', { className: `badge ${STATUS_CLASS[lead.status]}`, text: lead.status })]),
      el('td', { text: lead.interest, attrs: { 'data-col': 'interest' } }),
      el('td', { className: 'num', attrs: { 'data-col': 'value' } }, [bdi(formatCurrency(lead.value))]),
      followUpCell(lead, today),
      priorityCell(lead, today),
    ]);
    if (isOverdue(lead, today)) row.classList.add('is-overdue');
    if (lead.id === state.highlightId) markHighlight(row);
    return row;
  }));
}

// ---------- Row highlight after "הצג ליד" (SPEC 1.5, AC-5.9) ----------

/**
 * A thick frame and a text tag, not colour alone. The row background is not touched,
 * so an overdue row keeps its background and its "באיחור" tag. The tag sits under the name:
 * that column stays in view while the table scrolls sideways, and it does not widen a column.
 */
function markHighlight(row) {
  row.classList.add('is-highlighted');
  const nameCellEl = row.querySelector('td[data-col="name"]');
  if (!nameCellEl.querySelector('.highlight-tag')) {
    nameCellEl.append(el('span', { className: 'highlight-tag', text: 'נוסף עכשיו', attrs: { 'data-testid': 'highlight-tag' } }));
  }
}

/** Ends the highlight in place, without redrawing the table, so focus stays on the name. */
function clearHighlight() {
  clearTimeout(state.highlightTimer);
  state.highlightTimer = null;
  state.highlightId = null;
  for (const row of document.querySelectorAll('.leads tr.is-highlighted')) {
    row.classList.remove('is-highlighted');
    row.querySelector('.highlight-tag')?.remove();
  }
}

function setupPriorityHelp() {
  const button = $('priority-help-button');
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  });
}

// ---------- Filters ----------

const filterEls = {
  form: $('filters'),
  query: $('filter-query'),
  status: $('filter-status'),
  source: $('filter-source'),
  rep: $('filter-rep'),
};

function fillSelect(select, values, firstOption) {
  const options = values.map((v) => el('option', { text: v, attrs: { value: v } }));
  if (firstOption) options.unshift(el('option', { text: firstOption, attrs: { value: '' } }));
  select.replaceChildren(...options);
}

function readFilters() {
  return {
    query: filterEls.query.value,
    status: filterEls.status.value,
    source: filterEls.source.value,
    rep: filterEls.rep.value,
  };
}

function resetFilterInputs() {
  filterEls.query.value = EMPTY_FILTERS.query;
  filterEls.status.value = EMPTY_FILTERS.status;
  filterEls.source.value = EMPTY_FILTERS.source;
  filterEls.rep.value = EMPTY_FILTERS.rep;
}

/** Table, counter and empty state follow the filters. Cards and chart always use all leads. */
function renderResults() {
  const visible = filterLeads(state.sorted, readFilters());
  renderTable(visible, state.today);
  $('results-count').textContent = `מוצגים ${visible.length} מתוך ${state.leads.length} לידים`;
  renderSortInfo();
  const empty = visible.length === 0;
  $('empty-state').hidden = !empty;
  $('table-wrap').hidden = empty;
}

// ---------- Sort selector (SPEC 1.5, AC-3.3, AC-3.4) ----------

const SORT_HINTS = {
  [SORT_MODES.PRIORITY]: 'ממוין לפי עדיפות: הלידים הדחופים למעלה, הסגורים בסוף.',
  [SORT_MODES.RECENT]: 'ממוין לפי תאריך ההוספה: האחרונים שנוספו למעלה, כולל לידים סגורים.',
};

function renderSortInfo() {
  $('sort-status').textContent = `מיון: ${SORT_LABELS[state.sortMode]}`;
  $('sort-hint').textContent = SORT_HINTS[state.sortMode];
  $('table-caption').textContent = state.sortMode === SORT_MODES.RECENT
    ? 'כל הלידים, מהאחרון שנוסף לראשון'
    : 'כל הלידים, ממוינים לפי עדיפות';
}

/** Changes only the order: search, filters, cards, chart and the message stay as they are. */
function setSortMode(mode) {
  state.sortMode = Object.values(SORT_MODES).includes(mode) ? mode : DEFAULT_SORT;
  $('sort-mode').value = state.sortMode;
  state.sorted = sortLeadsBy(state.sortMode, state.leads, state.today);
  renderResults();
}

function setupSort() {
  $('sort-mode').addEventListener('change', (event) => setSortMode(event.currentTarget.value));
}

function setupFilters() {
  fillSelect(filterEls.status, STATUSES, 'הכל');
  fillSelect(filterEls.source, SOURCES, 'הכל');
  fillSelect(filterEls.rep, REPS, 'הכל');
  const update = () => { clearFlash(); renderResults(); };
  filterEls.form.addEventListener('submit', (event) => event.preventDefault());
  filterEls.query.addEventListener('input', update);
  for (const select of [filterEls.status, filterEls.source, filterEls.rep]) {
    select.addEventListener('change', update);
  }
  const reset = () => {
    resetFilterInputs();
    update();
    filterEls.query.focus();
  };
  $('filters-reset').addEventListener('click', reset);
  $('empty-reset').addEventListener('click', reset);
}

// ---------- Success message ----------

/** `content` is a string or a list of strings and nodes. `showLeadId` adds the "הצג ליד" button. */
function showFlash(content, { warning = false, showLeadId = null } = {}) {
  const box = $('flash-box');
  $('flash').replaceChildren(...[].concat(content));
  box.classList.toggle('is-warning', warning);
  const action = $('show-lead');
  action.hidden = showLeadId === null;
  action.dataset.id = showLeadId ?? '';
  box.hidden = false;
}

function clearFlash() {
  $('flash-box').hidden = true;
  $('flash').textContent = '';
  $('show-lead').hidden = true;
  $('show-lead').dataset.id = '';
}

/** The message after adding: name and id, and whether it was saved in the browser (SPEC 1.5). */
function addedMessage(lead, stored, hidden) {
  const parts = ['הליד ', bdi(lead.name), ' (', bdi(lead.id), ')'];
  parts.push(stored ? ' נוסף ונשמר.' : ' נוסף, אבל לא נשמר בדפדפן ויימחק ברענון.');
  if (hidden) parts.push(' הוא לא מוצג כרגע כי הוא לא מתאים לחיפוש או לסינון הפעילים.');
  return parts;
}

/**
 * "הצג ליד": clears search and filters, keeps the sort, scrolls to the row, focuses its name and
 * highlights the row for about 3 seconds. The details dialog is not opened.
 */
function showAddedLead() {
  const id = $('show-lead').dataset.id;
  const lead = state.leads.find((l) => l.id === id);
  if (!lead) return;
  const warning = $('flash-box').classList.contains('is-warning');
  clearHighlight();
  resetFilterInputs();
  state.highlightId = id;
  renderResults();
  // The lead is shown now: drop "not shown", keep whether it was saved in the browser.
  showFlash(addedMessage(lead, !warning, false), { warning, showLeadId: id });
  const button = document.querySelector(`[data-testid="details-button"][data-id="${id}"]`);
  button.scrollIntoView({ block: 'center', inline: 'nearest' });
  button.focus({ preventScroll: true });
  state.highlightTimer = setTimeout(clearHighlight, HIGHLIGHT_MS);
}

// ---------- Lead dialog (details, edit, add) ----------

const dialog = $('lead-dialog');
const form = $('lead-form');
const fieldEl = (name) => form.elements.namedItem(name);
const dialogState = { mode: null, leadId: null, opener: null, saved: null };

function setupDialogSelects() {
  fillSelect(fieldEl('source'), SOURCES, 'בחרו מקור');
  fillSelect(fieldEl('rep'), REPS, 'בחרו נציג');
  fillSelect(fieldEl('status'), STATUSES); // exactly the 5 statuses, no "הכל"
  fillSelect(fieldEl('interest'), INTEREST_LEVELS);
}

function clearErrors() {
  const formError = $('form-error');
  formError.hidden = true;
  formError.textContent = '';
  for (const name of ADD_FIELDS) {
    const input = fieldEl(name);
    input.removeAttribute('aria-invalid');
    const error = document.getElementById(`e-${name}`);
    error.textContent = '';
    error.hidden = true;
  }
}

function showErrors(errors) {
  clearErrors();
  for (const [name, message] of Object.entries(errors)) {
    fieldEl(name).setAttribute('aria-invalid', 'true');
    const error = document.getElementById(`e-${name}`);
    error.textContent = message;
    error.hidden = false;
  }
}

function setMode(mode) {
  for (const node of dialog.querySelectorAll('[data-mode]')) node.hidden = node.dataset.mode !== mode;
}

function setReadonly(key, text, { ltr = false, empty = false } = {}) {
  const dd = dialog.querySelector(`[data-ro="${key}"]`);
  dd.classList.toggle('empty', empty);
  dd.replaceChildren(ltr ? bdi(text, { dir: 'ltr' }) : document.createTextNode(text));
}

function fillReadonly(lead) {
  setReadonly('id', lead.id, { ltr: true });
  setReadonly('name', lead.name);
  setReadonly('phone', lead.phone || 'לא צוין', { ltr: Boolean(lead.phone), empty: !lead.phone });
  setReadonly('email', lead.email || 'לא צוין', { ltr: Boolean(lead.email), empty: !lead.email });
  setReadonly('source', lead.source);
  setReadonly('value', formatCurrency(lead.value), { ltr: true });
  setReadonly('createdAt', formatDate(lead.createdAt), { ltr: true });
  const { score, level } = getPriority(lead, state.today);
  setReadonly('priority', score === null ? level : `${level} (${score})`);
}

/** Opens the dialog. The form holds a temporary copy; nothing changes until a valid save. */
function openDialog(mode, lead, opener) {
  dialogState.mode = mode;
  dialogState.leadId = lead?.id ?? null;
  dialogState.opener = opener;
  dialogState.saved = null;
  form.reset();
  clearErrors();
  setMode(mode);
  if (mode === 'edit') {
    $('dialog-title').textContent = `פרטי ליד ${lead.id}`;
    fillReadonly(lead);
    fieldEl('status').value = lead.status;
    fieldEl('interest').value = lead.interest;
    fieldEl('rep').value = lead.rep;
    fieldEl('followUpDate').value = lead.followUpDate ?? '';
    fieldEl('notes').value = lead.notes;
  } else {
    $('dialog-title').textContent = 'ליד חדש';
    fieldEl('source').value = '';
    fieldEl('rep').value = '';
    fieldEl('status').value = 'חדש';
    fieldEl('interest').value = 'בינונית';
  }
  dialog.showModal();
  fieldEl(mode === 'add' ? 'name' : 'status').focus();
}

function readForm(mode) {
  const fields = mode === 'add' ? ADD_FIELDS : EDIT_FIELDS;
  return Object.fromEntries(fields.map((name) => [name, fieldEl(name).value]));
}

function handleSave(event) {
  event.preventDefault();
  const { mode } = dialogState;
  const result = validateLeadForm(readForm(mode), mode);
  if (!result.valid) {
    showErrors(result.errors);
    const first = fieldEl(result.firstInvalid);
    first.focus({ preventScroll: true });
    // Bring the whole field into view, including its error message under the input.
    first.closest('.field').scrollIntoView({ block: 'nearest' });
    return;
  }
  let id;
  if (mode === 'add') {
    const added = addLead(state.leads, result.values, state.today);
    if (!added.ok) {
      // The limit is enforced here too, not only by disabling the button.
      const formError = $('form-error');
      formError.textContent = added.error;
      formError.hidden = false;
      return;
    }
    id = added.lead.id;
    setLeads(added.leads);
  } else {
    id = dialogState.leadId;
    setLeads(state.leads.map((l) => (l.id === id ? applyEdit(l, result.values) : l)));
  }
  dialogState.saved = { mode, id, stored: persist() };
  dialog.close();
}

/** Where focus goes after the dialog closes. */
function afterClose() {
  const { saved, opener } = dialogState;
  if (!saved) {
    // Cancel or Esc: nothing changed. Back to the button that opened the dialog.
    const target = opener?.isConnected ? opener
      : (dialogState.leadId && document.querySelector(`[data-testid="details-button"][data-id="${dialogState.leadId}"]`))
        || $('add-lead-button');
    target.focus();
    return;
  }
  const button = document.querySelector(`[data-testid="details-button"][data-id="${saved.id}"]`);
  // Never claim the data is saved in the browser when saving failed.
  if (saved.mode === 'add') {
    // Adding does not change the sort, search or filters. Focus goes to the message,
    // and "הצג ליד" is the next stop for Tab (SPEC 1.5, AC-5.8).
    const lead = state.leads.find((l) => l.id === saved.id);
    showFlash(addedMessage(lead, saved.stored, !button), { warning: !saved.stored, showLeadId: saved.id });
    $('flash').focus();
    return;
  }
  const action = saved.stored
    ? `השינויים בליד ${saved.id} נשמרו.`
    : `השינויים בליד ${saved.id} עודכנו, אבל לא נשמרו בדפדפן ויימחקו ברענון.`;
  const hidden = ' הליד לא מוצג כרגע כי הוא כבר לא מתאים לחיפוש או לסינון הפעילים.';
  showFlash(action + (button ? '' : hidden), { warning: !saved.stored });
  (button ?? $('flash')).focus();
}

/** Keeps Tab and Shift+Tab inside the dialog that received the event. */
function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const box = event.currentTarget;
  const focusables = [...box.querySelectorAll('input, select, textarea, button')]
    .filter((node) => !node.disabled && node.getClientRects().length > 0);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setupDialog() {
  setupDialogSelects();
  form.addEventListener('submit', handleSave);
  $('dialog-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', trapFocus);
  dialog.addEventListener('close', afterClose);
  $('show-lead').addEventListener('click', showAddedLead);
  $('add-lead-button').addEventListener('click', (event) => {
    if (canAddLead(state.leads)) openDialog('add', null, event.currentTarget);
  });
  document.querySelector('[data-testid="leads-table"] tbody').addEventListener('click', (event) => {
    const button = event.target.closest('[data-testid="details-button"]');
    if (!button) return;
    const lead = state.leads.find((l) => l.id === button.dataset.id);
    if (lead) openDialog('edit', lead, button);
  });
}

// ---------- Reset to demo data ----------

const resetDialog = $('reset-dialog');
let resetConfirmed = false;

function confirmReset() {
  resetConfirmed = true;
  resetFilterInputs();
  clearFlash();
  clearHighlight();
  // The sort is not kept: reset returns to the default (SPEC 1.5, AC-10.10).
  state.sortMode = DEFAULT_SORT;
  $('sort-mode').value = DEFAULT_SORT;
  state.invalid = false;
  // "Today" is recalculated here: the page may have stayed open past midnight (SPEC 1.3, AC-10.9).
  state.today = toLocalDateString(new Date());
  setLeads(createDemoLeads(state.today));
  persist();
  resetDialog.close();
}

function setupReset() {
  $('reset-button').addEventListener('click', () => {
    resetConfirmed = false;
    resetDialog.showModal();
    $('reset-cancel').focus(); // safe default
  });
  $('reset-cancel').addEventListener('click', () => resetDialog.close());
  $('reset-confirm').addEventListener('click', confirmReset);
  resetDialog.addEventListener('keydown', trapFocus);
  resetDialog.addEventListener('close', () => {
    if (resetConfirmed) {
      showFlash(state.saved
        ? 'נתוני הדמה שוחזרו: 30 לידים.'
        : 'נתוני הדמה שוחזרו: 30 לידים, אבל לא נשמרו בדפדפן.', { warning: !state.saved });
    }
    $('reset-button').focus();
  });
}

// ---------- Start ----------

function init() {
  state.today = toLocalDateString(new Date());
  // The sort is not saved: every load starts from the default, even if the browser restored the field.
  $('sort-mode').value = DEFAULT_SORT;
  setupFilters();
  setupSort();
  setupPriorityHelp();
  setupDialog();
  setupReset();
  state.storage = getStorage(window);
  const loaded = loadLeads(state.storage, state.today);
  state.canRead = loaded.canRead;
  state.saved = loaded.saved;
  state.invalid = loaded.invalid;
  setLeads(loaded.leads);
  updateStorageNotices();
}

init();
