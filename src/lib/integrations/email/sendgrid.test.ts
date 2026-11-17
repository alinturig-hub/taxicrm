import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { checkSendGridKey } from './sendgrid';
const key = 'SG.synthetic_example.synthetic_example';
test('reads scopes only from the fixed SendGrid endpoint and never returns the key', async () => {
 let calls=0;
 const fetcher: typeof fetch = async (url, init) => { calls++; assert.equal(url,'https://api.sendgrid.com/v3/scopes'); assert.equal(init?.method,'GET'); assert.equal(init?.redirect,'error'); return Response.json({scopes:['mail.send']}); };
 const result=await checkSendGridKey(key,{fetcher}); assert.deepEqual(result,{state:'verified',mailSendScope:true}); assert.equal(calls,1); assert(!JSON.stringify(result).includes(key));
});
test('distinguishes insufficient scope, invalid credential, and unavailable provider', async () => {
 assert.deepEqual(await checkSendGridKey(key,{fetcher:async()=>Response.json({scopes:[]})}),{state:'verified',mailSendScope:false});
 assert.equal((await checkSendGridKey(key,{fetcher:async()=>new Response('',{status:401})})).state,'invalid');
 assert.equal((await checkSendGridKey(key,{fetcher:async()=>new Response('',{status:500})})).state,'unavailable');
 assert.equal((await checkSendGridKey(key,{fetcher:async()=>{throw Error('offline')}})).state,'unavailable');
});
test('rejects malformed keys and malformed provider responses', async () => {
 let called=false; assert.equal((await checkSendGridKey('bad',{fetcher:async()=>{called=true;return Response.json({})}})).state,'invalid'); assert.equal(called,false);
 assert.equal((await checkSendGridKey(key,{fetcher:async()=>Response.json({scopes:'mail.send'})})).state,'unavailable');
});
