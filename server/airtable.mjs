import { validateLead, MAX_LEADS } from '../js/logic.js';
export function normalizeRecords(records) {
  if (!Array.isArray(records) || records.length > MAX_LEADS) throw new Error('INVALID_DATA');
  const seen = new Set();
  return records.map(record => {
    const f = record.fields ?? {};
    const lead = { id:f.id, name:f.name, phone:f.phone ?? '', email:f.email ?? '', source:f.source,
      rep:f.rep, status:f.status, interest:f.interest, value:f.value ?? 0,
      followUpDate:f.followUpDate || null, notes:f.notes ?? '', createdAt:f.createdAt };
    if (!validateLead(lead).valid || seen.has(lead.id)) throw new Error('INVALID_DATA');
    seen.add(lead.id); return lead;
  });
}
export async function readAirtable(config, fetcher = fetch) {
  const { AIRTABLE_TOKEN:token, AIRTABLE_BASE_ID:base, AIRTABLE_TABLE_ID:table } = config;
  if (!token || !/^app[a-zA-Z0-9]+$/.test(base ?? '') || !/^tbl[a-zA-Z0-9]+$/.test(table ?? '')) throw new Error('CONFIG');
  let records = [], offset;
  const offsets = new Set();
  do {
    const url = new URL('https://api.airtable.com/v0/' + base + '/' + table);
    url.searchParams.set('pageSize','100');
    if (offset) url.searchParams.set('offset',offset);
    const response = await fetcher(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('AIRTABLE_'+response.status);
    const data = await response.json();
    if (!Array.isArray(data.records)) throw new Error('INVALID_DATA');
    records.push(...data.records);
    if (records.length > MAX_LEADS) throw new Error('LIMIT');
    offset = data.offset;
    if (offset && (typeof offset !== 'string' || offsets.has(offset))) throw new Error('INVALID_DATA');
    offsets.add(offset);
  } while(offset);
  return normalizeRecords(records);
}
