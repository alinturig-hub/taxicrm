import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconcileMissingAmountEvidence} from './missing-amount-reconciliation';
const target={id:'synthetic-booking',externalId:'42',originalBookingId:null,status:'COMPLETED',completedAt:new Date('2026-10-01T12:00:00Z')};
const event={id:'synthetic-event',eventType:'AUTOCAB_BOOKING_COMPLETED',status:'IGNORED',bookingId:null,processingError:null,receivedAt:new Date('2026-10-01T12:01:00Z'),payload:{Id:42,CompletedAtTime:'2026-10-01T12:00:00Z',Pricing:{Price:0,Cost:12,Currency:'GBP'}}};
test('dry-run evidence preserves zero, max value and source and rejects missing finality',()=>{
 const before=JSON.stringify(event);const r=reconcileMissingAmountEvidence(target,[event]);
 assert.equal(r.classification,'CONSISTENT_EVIDENCE');assert.equal(r.proposed?.price,'0.00');assert.equal(r.proposed?.value,'12.00');assert.equal(JSON.stringify(event),before);
 const incomplete=reconcileMissingAmountEvidence(target,[{...event,payload:{Id:42,Pricing:{Price:10}}}]);assert.ok(incomplete.blockers.includes('CURRENCY_UNCONFIRMED'));assert.ok(incomplete.blockers.includes('INCOMPLETE_BUSINESS_CHRONOLOGY'));
});
test('identity conflicts, changing amounts, later events and truncation require review',()=>{
 assert.equal(reconcileMissingAmountEvidence(target,[{...event,payload:{...event.payload,Id:99}}]).proposed,null);
 const changed={...event,id:'other',payload:{...event.payload,CompletedAtTime:'2026-10-01T12:02:00Z',Pricing:{...event.payload.Pricing,Price:15}}};
 assert.ok(reconcileMissingAmountEvidence(target,[event,changed],true).blockers.includes('HISTORICAL_AMOUNT_CHANGES'));
 assert.ok(reconcileMissingAmountEvidence(target,[event],true).blockers.includes('HISTORY_TRUNCATED'));
 const later={...event,id:'later',receivedAt:new Date('2026-10-01T13:00:00Z'),payload:{Id:42,Timestamp:'2026-10-01T13:00:00Z'}};
 assert.ok(reconcileMissingAmountEvidence(target,[event,later]).blockers.includes('LATER_EVENT_REQUIRES_REVIEW'));
});
