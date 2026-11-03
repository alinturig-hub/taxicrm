import {test} from 'node:test';import assert from 'node:assert/strict';import {enqueueOutbound,type OutboxTransaction} from './outbox';
test('equivalent template key ordering has stable operation hash; changed request conflicts',async()=>{
 let savedHash='';const tx:OutboxTransaction={query:async(sql,values)=>{if(sql.startsWith('INSERT'))savedHash||=values[3] as string;return {rows:sql.startsWith('SELECT')?[{id:'synthetic',requestHash:savedHash,status:'QUEUED'}]:[]}}};
 const d={connectionKey:'META:synthetic',operationKey:'test',actorUserId:'operator',recipient:'+447700900123',templateSnapshot:{a:1,b:2},purpose:'SERVICE' as const,eligibilityEvidence:{}};
 await enqueueOutbound(tx,d);await enqueueOutbound(tx,{...d,templateSnapshot:{b:2,a:1}});await assert.rejects(enqueueOutbound(tx,{...d,recipient:'+447700900124'}),/OUTBOUND_IDEMPOTENCY_CONFLICT/);
});
