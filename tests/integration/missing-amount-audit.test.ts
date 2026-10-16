import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {missingAmountAudit} from '@/lib/revenue/missing-amount-audit';
assert.equal(process.env.DATABASE_URL,'postgresql://taxicrm@127.0.0.1:5432/taxicrm');
assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS,'1');
test('missing amount audit separates original, alternate, fare and historical evidence without writes',async()=>{
 const provider='synthetic-missing-'+randomUUID();
 try{
  const b=await prisma.booking.create({data:{provider,externalId:'a',status:'COMPLETED',rawPayload:{Pricing:{Price:'12.20'}},fare:0}});
  await prisma.booking.create({data:{provider,externalId:'b',status:'COMPLETED',rawPayload:{pricing:{cost:0}}}});
  await prisma.booking.create({data:{provider,externalId:'c',status:'CANCELLED',rawPayload:{Pricing:{Price:'bad'}}}});
  await prisma.webhookEvent.create({data:{provider,externalBookingId:'a',eventType:'synthetic',idempotencyKey:provider,payload:{Pricing:{Cost:15}}}});
  await prisma.bookingSnapshot.create({data:{bookingId:b.id,version:1,eventType:'synthetic',snapshot:{price:12}}});
  const before=await prisma.booking.findMany({where:{provider},orderBy:{id:'asc'}});
  const r=await missingAmountAudit(null,true,provider);
  assert.equal(r.selected,3);assert.equal(r.hasMore,false);
  const c=r.groups.find(x=>x.status==='COMPLETED')!;assert.equal(c.originalAmount,1);assert.equal(c.alternateAmount,1);assert.equal(c.fareKnown,1);assert.equal(c.fareNonzero,0);
  assert.equal(r.historyEvidence.withHistoricalAmount,1);assert.equal(r.historyEvidence.withSnapshotAmount,1);
  assert.equal((await missingAmountAudit(r.nextCursor,false,provider)).selected,0);
  assert.deepEqual(await prisma.booking.findMany({where:{provider},orderBy:{id:'asc'}}),before);
 }finally{await prisma.webhookEvent.deleteMany({where:{provider}});await prisma.booking.deleteMany({where:{provider}});await prisma.$disconnect()}
});
