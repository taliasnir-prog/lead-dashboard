// Pure logic for the lead dashboard (SPEC.md sections 6 and 7).
// No DOM and no storage access here, so everything can be tested with `node --test`.
// Every date-dependent function receives `today` as a 'YYYY-MM-DD' string.

export const STATUSES = ['חדש', 'נוצר קשר', 'במעקב', 'נסגר בהצלחה', 'נסגר ללא עסקה'];
export const OPEN_STATUSES = ['חדש', 'נוצר קשר', 'במעקב'];
export const CLOSED_STATUSES = ['נסגר בהצלחה', 'נסגר ללא עסקה'];
export const SOURCES = ['Facebook', 'Google', 'אתר', 'הפניה'];
export const REPS = ['נועה ברק', 'איתי שמש', 'מאיה גל', 'עומר טל'];
export const INTEREST_LEVELS = ['נמוכה', 'בינונית', 'גבוהה'];

export const LEAD_FIELDS = [
  'id', 'name', 'phone', 'email', 'source', 'rep', 'status',
  'interest', 'value', 'followUpDate', 'notes', 'createdAt',
];

export const STORAGE_VERSION = 1;
export const MAX_LEADS = 500;
export const MAX_VALUE = 10_000_000;
export const MAX_NOTES = 500;

export const PRIORITY = { HIGH: 'גבוהה', MEDIUM: 'בינונית', LOW: 'נמוכה', NONE: 'לא בתעדוף' };

const INTEREST_POINTS = { 'גבוהה': 3, 'בינונית': 2, 'נמוכה': 1 };

// ---------- Dates ----------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar date of `date` as 'YYYY-MM-DD'. Never uses toISOString (UTC). */
export function toLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True only for a real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-30, 2026-13-01). */
export function isValidDateString(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

function toUtcMs(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). Calculated in UTC, so DST has no effect. */
export function daysBetween(from, to) {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** `dateStr` plus `days`, as 'YYYY-MM-DD'. Handles month, year and leap-year boundaries. */
export function addDays(dateStr, days) {
  const result = new Date(toUtcMs(dateStr) + days * 86_400_000);
  const y = result.getUTCFullYear();
  const m = String(result.getUTCMonth() + 1).padStart(2, '0');
  const d = String(result.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------- Status, overdue and priority ----------

export function isOpen(lead) {
  return OPEN_STATUSES.includes(lead.status);
}

/** Open lead with a follow-up date earlier than today. Today is not overdue; closed leads never are. */
export function isOverdue(lead, today) {
  return isOpen(lead) && lead.followUpDate != null && lead.followUpDate < today;
}

export function followUpPoints(followUpDate, today) {
  if (followUpDate == null) return 1;
  const diff = daysBetween(today, followUpDate);
  if (diff < 0) return 3;
  if (diff === 0) return 2;
  if (diff <= 3) return 1;
  return 0;
}

/** Priority score for an open lead, or null for a closed lead. */
export function priorityScore(lead, today) {
  if (!isOpen(lead)) return null;
  const interest = INTEREST_POINTS[lead.interest] ?? 0;
  const newBonus = lead.status === 'חדש' ? 1 : 0;
  return interest + followUpPoints(lead.followUpDate, today) + newBonus;
}

export function priorityLevel(score) {
  if (score == null) return PRIORITY.NONE;
  if (score >= 5) return PRIORITY.HIGH;
  if (score >= 3) return PRIORITY.MEDIUM;
  return PRIORITY.LOW;
}

export function getPriority(lead, today) {
  const score = priorityScore(lead, today);
  return { score, level: priorityLevel(score) };
}

// ---------- Metrics, chart counts and default order (SPEC.md sections 6 and 7) ----------

/** The four summary cards. Always computed on all leads, never on a filtered list. */
export function computeMetrics(leads) {
  const won = leads.filter((l) => l.status === 'נסגר בהצלחה');
  return {
    total: leads.length,
    newCount: leads.filter((l) => l.status === 'חדש').length,
    wonCount: won.length,
    wonValue: won.reduce((sum, l) => sum + l.value, 0),
  };
}

/** Lead count per source, in SPEC order, including sources with 0 leads. */
export function countBySource(leads) {
  return SOURCES.map((source) => ({ source, count: leads.filter((l) => l.source === source).length }));
}

/**
 * Default table order: open leads by score (high to low), then follow-up date (earliest first,
 * no date last), then id. Closed leads after all open ones, by id. Returns a new array.
 */
export function sortLeads(leads, today) {
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const open = leads.filter(isOpen);
  const closed = leads.filter((l) => !isOpen(l));
  open.sort((a, b) => {
    const scoreDiff = priorityScore(b, today) - priorityScore(a, today);
    if (scoreDiff !== 0) return scoreDiff;
    if (a.followUpDate !== b.followUpDate) {
      if (a.followUpDate === null) return 1;
      if (b.followUpDate === null) return -1;
      return a.followUpDate < b.followUpDate ? -1 : 1;
    }
    return byId(a, b);
  });
  closed.sort(byId);
  return [...open, ...closed];
}

// ---------- Search and filters (SPEC.md section 7) ----------

/** Default filter state: empty search and "הכל" ('') in every list. */
export const EMPTY_FILTERS = Object.freeze({ query: '', status: '', source: '', rep: '' });

/**
 * Leads matching all conditions together (AND). '' means "הכל" for a list.
 * The search matches part of the name, ignoring spaces at the edges and letter case.
 * Returns a new array in the input order; the input array and leads are not changed.
 */
export function filterLeads(leads, filters = EMPTY_FILTERS) {
  const query = (filters.query ?? '').trim().toLowerCase();
  const { status = '', source = '', rep = '' } = filters;
  return leads.filter((lead) =>
    (query === '' || lead.name.toLowerCase().includes(query))
    && (status === '' || lead.status === status)
    && (source === '' || lead.source === source)
    && (rep === '' || lead.rep === rep));
}

// ---------- Display formatting ----------

/** 60000 -> '60,000 ₪'. Fixed format, independent of the browser locale. */
export function formatCurrency(value) {
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ₪`;
}

/** '2026-11-07' -> '07/11/2026'; null -> 'לא נקבע'. */
export function formatDate(dateStr) {
  if (dateStr == null) return 'לא נקבע';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ---------- Validation (shared by demo data, future forms and localStorage loading) ----------

const ID_RE = /^L-\d{3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9-]+$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Error message for one field value, or null if the value is valid (SPEC.md section 6, lead fields table). */
export function validateField(field, value) {
  switch (field) {
    case 'id':
      return typeof value === 'string' && ID_RE.test(value) ? null : 'מזהה לא תקין';
    case 'name': {
      if (typeof value !== 'string') return 'שם חובה';
      const len = value.trim().length;
      if (len === 0) return 'שם חובה';
      return len >= 2 && len <= 50 ? null : 'שם צריך להכיל 2 עד 50 תווים';
    }
    case 'phone': {
      if (typeof value !== 'string') return 'טלפון לא תקין';
      if (value === '') return null;
      const digits = value.replace(/-/g, '').length;
      return PHONE_RE.test(value) && digits >= 9 && digits <= 10 ? null : 'טלפון צריך להכיל 9 או 10 ספרות';
    }
    case 'email':
      if (typeof value !== 'string') return 'דוא״ל לא תקין';
      return value === '' || EMAIL_RE.test(value) ? null : 'כתובת דוא״ל לא תקינה';
    case 'source':
      return SOURCES.includes(value) ? null : 'יש לבחור מקור';
    case 'rep':
      return REPS.includes(value) ? null : 'יש לבחור נציג';
    case 'status':
      return STATUSES.includes(value) ? null : 'יש לבחור סטטוס';
    case 'interest':
      return INTEREST_LEVELS.includes(value) ? null : 'יש לבחור רמת עניין';
    case 'value':
      return Number.isInteger(value) && value >= 0 && value <= MAX_VALUE
        ? null : 'שווי צריך להיות מספר שלם בין 0 ל-10,000,000';
    case 'followUpDate':
      return value === null || isValidDateString(value) ? null : 'תאריך מעקב לא תקין';
    case 'notes':
      return typeof value === 'string' && value.length <= MAX_NOTES ? null : 'הערות עד 500 תווים';
    case 'createdAt':
      return isValidDateString(value) ? null : 'תאריך יצירה לא תקין';
    default:
      return 'שדה לא מוכר';
  }
}

/**
 * Full check of one stored lead: exactly the 12 fields of SPEC.md section 6, each value valid.
 * Returns { valid, errors } where errors maps field name (or '_shape') to a message.
 */
export function validateLead(lead) {
  if (!isPlainObject(lead)) return { valid: false, errors: { _shape: 'ליד חייב להיות אובייקט' } };
  const errors = {};
  const keys = Object.keys(lead);
  const missing = LEAD_FIELDS.filter((f) => !keys.includes(f));
  const extra = keys.filter((k) => !LEAD_FIELDS.includes(k));
  if (missing.length || extra.length) {
    errors._shape = `שדות חסרים: ${missing.join(', ') || '-'}; שדות מיותרים: ${extra.join(', ') || '-'}`;
  }
  for (const field of LEAD_FIELDS) {
    if (!keys.includes(field)) continue;
    const message = validateField(field, lead[field]);
    if (message) errors[field] = message;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Check of the whole stored value { version: 1, leads: [...] } (SPEC.md section 7).
 * All or nothing: one invalid lead or a duplicate id rejects the whole value.
 * Returns { valid, errors } where errors is a list of readable strings.
 */
export function validateStoredData(data) {
  if (!isPlainObject(data)) return { valid: false, errors: ['הערך השמור חייב להיות אובייקט'] };
  const errors = [];
  if (data.version !== STORAGE_VERSION) errors.push(`גרסה לא נתמכת: ${data.version}`);
  if (!Array.isArray(data.leads)) {
    errors.push('leads חייב להיות מערך');
    return { valid: false, errors };
  }
  if (data.leads.length < 1 || data.leads.length > MAX_LEADS) {
    errors.push(`מספר הלידים צריך להיות בין 1 ל-${MAX_LEADS}`);
  }
  const seen = new Set();
  data.leads.forEach((lead, index) => {
    const result = validateLead(lead);
    if (!result.valid) errors.push(`ליד ${index}: ${Object.values(result.errors).join(' | ')}`);
    if (isPlainObject(lead) && typeof lead.id === 'string') {
      if (seen.has(lead.id)) errors.push(`מזהה כפול: ${lead.id}`);
      seen.add(lead.id);
    }
  });
  return { valid: errors.length === 0, errors };
}
