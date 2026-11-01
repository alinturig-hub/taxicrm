import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {missingCompletedCohort} from '@/lib/revenue/missing-amount-cohort';
assert.equal(process.env.DATABASE_URL,'postgresql://taxicrm@127.0.0.1:5432/taxicrm');
assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS,'1');
test('cohort separates account/name/date evidence, preserves source rows and London months',async()=>{
 const provider='synthetic-cohort-'+randomUUID();
 try{
  const base={provider,status:'COMPLETED',rawPayload:{},pickupDueTime:new Date('2051-05-31T23:30:00Z')};
  await prisma.booking.create({data:{...base,externalId:'a',accountId:'synthetic-account',accountName:'Synthetic Ltd',customerName:'Synthetic Customer',telephoneNumber:'synthetic-number',completedAt:new Date('2051-05-31T23:30:00Z')}});
  await prisma.booking.create({data:{...base,externalId:'b',customerName:'Unknown',cancelledAt:new Date('2051-05-31T23:30:00Z')}});
  await prisma.booking.create({data:{...base,externalId:'c',status:'CANCELLED'}});
  await prisma.booking.create({data:{...base,externalId:'d',price:0}});
  const before=await prisma.booking.findMany({where:{provider},orderBy:{id:'asc'}});
  const report=await missingCompletedCohort(provider);const total=report.find(r=>r.scope==='TOTAL')!;
  assert.equal(total.bookings,2);assert.equal(total.with_account_id,1);assert.equal(total.with_customer_name,2);assert.equal(total.placeholder_customer_name,1);assert.equal(total.with_completion_time,1);assert.equal(total.with_cancellation_time,1);assert.equal(total.empty_payload,2);
  assert.equal(report.find(r=>r.scope==='BUSINESS_MONTH')?.business_month,'2051-06');
  assert.deepEqual(await prisma.booking.findMany({where:{provider},orderBy:{id:'asc'}}),before);
 }finally{await prisma.booking.deleteMany({where:{provider}});await prisma.$disconnect()}
});
