// Local saving in the browser (SPEC.md section 7, "שמירה ב-localStorage").
// The storage object is passed in, so the logic can be tested in Node with a fake storage.

import { validateStoredData, STORAGE_VERSION } from './logic.js';
import { createDemoLeads } from './demo-data.js';

export const STORAGE_KEY = 'leadDashboard.v1';

/**
 * window.localStorage, or null when it cannot be used. Just reading the property can throw
 * (blocked site data, some private modes, sandboxed frames), so it is wrapped in try/catch.
 */
export function getStorage(win = globalThis) {
  try {
    const storage = win.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

/**
 * Writes { version: 1, leads } after checking it with the same rules used when loading.
 * A value that would fail on the next load is never written, so the last valid value stays.
 * Returns { ok, reason }: reason is 'saved', 'invalid' (not written) or 'failed' (no storage / write threw).
 */
export function saveLeads(storage, leads) {
  const value = { version: STORAGE_VERSION, leads };
  if (!validateStoredData(value).valid) return { ok: false, reason: 'invalid' };
  if (!storage) return { ok: false, reason: 'failed' };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
    return { ok: true, reason: 'saved' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Loads leads at startup.
 * Returns { leads, invalid, canRead, saved }:
 * - invalid: a stored value existed but failed the JSON / structure / value check, so demo data replaced it
 * - canRead: false when storage is missing or reading threw; then nothing is ever written,
 *   so data that could not be read is never overwritten
 * - saved: true when the data now in storage matches `leads`
 */
export function loadLeads(storage, today) {
  if (!storage) return { leads: createDemoLeads(today), invalid: false, canRead: false, saved: false };

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { leads: createDemoLeads(today), invalid: false, canRead: false, saved: false };
  }

  if (raw !== null) {
    let parsed;
    let ok = false;
    try {
      parsed = JSON.parse(raw);
      ok = validateStoredData(parsed).valid;
    } catch {
      ok = false;
    }
    if (ok) return { leads: parsed.leads, invalid: false, canRead: true, saved: true };
    const leads = createDemoLeads(today);
    return { leads, invalid: true, canRead: true, saved: saveLeads(storage, leads).ok };
  }

  // First load: create the demo data and save it.
  const leads = createDemoLeads(today);
  return { leads, invalid: false, canRead: true, saved: saveLeads(storage, leads).ok };
}
