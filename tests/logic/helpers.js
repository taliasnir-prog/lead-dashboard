// Shared test helpers (not a test file: no `.test.js` suffix).

export const TODAY = '2026-11-07';

/** A valid stored lead; override any field. */
export function makeLead(overrides = {}) {
  return {
    id: 'L-100',
    name: 'ליד בדיקה',
    phone: '',
    email: '',
    source: 'אתר',
    rep: 'נועה ברק',
    status: 'במעקב',
    interest: 'בינונית',
    value: 0,
    followUpDate: null,
    notes: '',
    createdAt: '2026-10-01',
    ...overrides,
  };
}
