import test from 'node:test';import assert from 'node:assert/strict';import {makeHandler} from '../../netlify/functions/leads.mjs';
test('AC-13.2 public handler reads, rejects writes and hides error details',async()=>{
 const config={AIRTABLE_TOKEN:'hidden-test-token'};
 const handler=makeHandler(async passed=>{assert.equal(passed,config);return []},config);
 assert.equal((await handler({httpMethod:'POST'})).statusCode,405);
 const response=await handler({httpMethod:'GET'});assert.equal(response.statusCode,200);assert.equal(JSON.parse(response.body).source,'airtable');
 const failure=await makeHandler(async()=>{throw Error(config.AIRTABLE_TOKEN)},config)({httpMethod:'GET'});assert.equal(failure.statusCode,502);assert.ok(!failure.body.includes(config.AIRTABLE_TOKEN));
});
