import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer,normalizeRecords,readAirtable} from '../../server.mjs';
import {createDemoLeads} from '../../js/demo-data.js';
const records=createDemoLeads('2026-11-10').slice(0,3).map(fields=>({fields}));
const config={AIRTABLE_TOKEN:'private-test-token',AIRTABLE_BASE_ID:'appTest',AIRTABLE_TABLE_ID:'tblTest'};
test('AC-11.1 normalizes records and allows empty base',()=>{
 assert.equal(normalizeRecords(records).length,3);assert.deepEqual(normalizeRecords([]),[]);
});
test('AC-11.6 fills only optional omitted Airtable fields',()=>{
 const fields={...records[0].fields};delete fields.phone;delete fields.email;delete fields.notes;delete fields.followUpDate;delete fields.value;
 const lead=normalizeRecords([{fields}])[0];assert.equal(lead.phone,'');assert.equal(lead.value,0);assert.equal(lead.followUpDate,null);
});
test('AC-11.6 rejects invalid data, duplicates and overflow',()=>{
 assert.throws(()=>normalizeRecords([{fields:{}}]));assert.throws(()=>normalizeRecords([records[0],records[0]]));assert.throws(()=>normalizeRecords(Array(501).fill(records[0])));
});
test('AC-11.1 paginates using authorization header only',async()=>{
 let calls=0; const leads=await readAirtable(config,async(url,options)=>{
 assert.equal(options.headers.Authorization,'Bearer private-test-token');assert.ok(!url.href.includes(config.AIRTABLE_TOKEN));calls++;
 return {ok:true,json:async()=>calls===1?{records:records.slice(0,2),offset:'next'}:{records:records.slice(2)}};
 });assert.equal(calls,2);assert.equal(leads.length,3);
});
test('AC-11.2 rejects upstream HTTP errors',async()=>{
 for(const status of [401,403,429,500]) await assert.rejects(readAirtable(config,async()=>({ok:false,status})));
});
test('AC-11.5 serves only allowlisted files and sanitizes errors; AC-11.4 rejects writes',async()=>{
 const server=makeServer(config,async()=>{throw Error(config.AIRTABLE_TOKEN)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try {
 for(const p of ['.env','server.mjs','package.json','.git/config','tests/logic/airtable.test.js','%2eenv'])assert.equal((await fetch(base+'/'+p)).status,404);
 assert.equal((await fetch(base+'/api/leads',{method:'POST'})).status,405);
 const resp=await fetch(base+'/api/leads');assert.equal(resp.status,502);assert.ok(!(await resp.text()).includes(config.AIRTABLE_TOKEN));
 assert.equal((await fetch(base+'/lead-dashboard/')).status,200);
 }finally{await new Promise(r=>server.close(r))}
});
