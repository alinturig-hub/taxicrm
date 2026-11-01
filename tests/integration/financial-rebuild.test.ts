import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {prisma} from '@/lib/prisma';
import {buildCompanyDailyMetrics} from '@/lib/analytics/build-company-daily-metrics';
import {financialAudit} from '@/lib/revenue/financial-audit';
import {generateDailyProfileSnapshots} from '@/lib/customers/generate-daily-profile-snapshots';
assert.equal(process.env.DATABASE_URL,'postgresql://taxicrm@127.0.0.1:5432/taxicrm');
assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS,'1');
const prefix='synthetic-finance-'+randomUUID();
test('aggregate audit compares exact values, preserves account waiting rules and leaves sources unchanged',async()=>{
 const metricDate=new Date('2051-01-01T00:00:00Z');
 const priorMetric=await prisma.companyDailyMetric.findUnique({where:{date:metricDate}});
 try{
  await prisma.accountRevenueRule.create({data:{provider:prefix,accountId:'a',accountCode:'original',waitingChargeable:true,waitingRatePerMinute:2}});
  const inputs=[{status:'COMPLETED',price:10,cost:15,completedAt:new Date('2051-01-01T10:00:00Z'),paymentType:'CASH'},{status:'CANCELLED',price:12,cost:2},{status:'COMPLETED',price:null,cost:null},{status:'NO_FARE',price:10,cost:20,accountId:'a',accountCode:'changed',arrivedAt:new Date('2042-01-01T10:00:00Z'),noFareAt:new Date('2042-01-01T10:05:00Z')}];
  for(const [i,input] of inputs.entries())await prisma.booking.create({data:{...input,provider:prefix,externalId:`${prefix}-${i}`,rawPayload:{synthetic:true},pickupDueTime:new Date('2042-01-01T10:00:00Z')}});
  const before=await prisma.booking.findMany({where:{provider:prefix},orderBy:{externalId:'asc'}});
  const report=await financialAudit(prefix);const total=report.find(row=>row.scope==='TOTAL')!;
  assert.equal(total.bookings,4);assert.equal(total.cost_higher,2);assert.equal(total.price_higher,1);assert.equal(total.missing_both,1);
  assert.equal(Number(total.price_total),32);assert.equal(Number(total.cost_total),37);
  assert.equal(Number(total.previous_recognized),30);assert.equal(Number(total.proposed_recognized),45);
  const metric=await buildCompanyDailyMetrics(new Date('2051-01-01T12:00:00Z'));
  assert.equal(Number(metric.revenue),15);assert.equal(Number(metric.cashRevenue),15);
  assert.deepEqual(await prisma.booking.findMany({where:{provider:prefix},orderBy:{externalId:'asc'}}),before);
 }finally{await prisma.booking.deleteMany({where:{provider:prefix}});await prisma.accountRevenueRule.deleteMany({where:{provider:prefix}});if(priorMetric)await prisma.companyDailyMetric.upsert({where:{date:metricDate},create:priorMetric,update:priorMetric});else await prisma.companyDailyMetric.deleteMany({where:{date:metricDate}})}
});
test('all-customer rebuild includes dormant and empty profiles, resumes and uses no external APIs',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('External API forbidden')};
 try{
  for(const suffix of ['a','b'])await prisma.normalCustomer.create({data:{id:prefix+suffix,normalizedTelephone:prefix+suffix,telephoneNumber:prefix+suffix}});
  await prisma.booking.create({data:{provider:prefix,externalId:prefix,normalCustomerId:prefix+'a',status:'COMPLETED',bookedAtTime:new Date('2020-01-01'),pickupDueTime:new Date('2020-01-01'),price:null,cost:20,rawPayload:{synthetic:true}}});
  const a=await generateDailyProfileSnapshots({scope:'all',limit:1,afterId:prefix,throughId:prefix+'z',skipExternal:true,refreshPredictions:true});
  assert.equal(a.saved,1);assert.equal(a.failed,0);assert.equal(a.hasMore,true);
  const b=await generateDailyProfileSnapshots({scope:'all',limit:1,afterId:a.nextCursor!,throughId:prefix+'z',skipExternal:true,refreshPredictions:true});
  assert.equal(b.saved,1);assert.equal(b.hasMore,false);
  assert.equal(await prisma.customerProfileSnapshot.count({where:{normalCustomerId:{startsWith:prefix}}}),2);
  const repeat=await generateDailyProfileSnapshots({scope:'all',limit:2,afterId:prefix,throughId:prefix+'z',skipExternal:true,refreshPredictions:true});
  assert.equal(repeat.saved,2);
  assert.equal(await prisma.customerProfileSnapshot.count({where:{normalCustomerId:{startsWith:prefix}}}),2);
 }finally{globalThis.fetch=original;await prisma.booking.deleteMany({where:{provider:prefix}});await prisma.normalCustomer.deleteMany({where:{id:{startsWith:prefix}}});await prisma.$disconnect()}
});
