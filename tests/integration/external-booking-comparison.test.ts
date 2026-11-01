import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {externalBookingComparison} from '@/lib/revenue/external-booking-comparison';
assert.equal(process.env.DATABASE_URL,'postgresql://taxicrm@127.0.0.1:5432/taxicrm');assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS,'1');
test('read-only external comparison distinguishes replicas, wrong primary-ID copies and date collisions',async()=>{
 const provider='synthetic-external-'+randomUUID(),table='SyntheticNeedacabSource'+randomUUID().replaceAll('-',''),options={table,provider};
 try{
  await prisma.$executeRawUnsafe(`CREATE TABLE "${table}" (id bigint PRIMARY KEY,autocab_booking_id text,original_booking_id text,status text,price numeric,cost numeric,fare numeric,pickup_due_time timestamp,completed_at timestamp)`);
  await prisma.$executeRawUnsafe(`INSERT INTO "${table}" VALUES (10,'100',NULL,'CANCELLED',15,12,15,'2051-01-01 10:00:00',NULL),(11,'100',NULL,'COMPLETED',15,12,15,'2051-01-01 10:00:00','2051-01-01 10:30:00'),(20,'200',NULL,'COMPLETED',0,0,0,'2051-01-01 11:00:00','2051-01-01 11:30:00'),(30,'300',NULL,'COMPLETED',10,8,10,'2051-01-01 12:00:00','2051-01-01 12:30:00')`);
  const base={provider,status:'COMPLETED',rawPayload:{synthetic:true}};
  for(const [externalId,time,price] of [['10','10:00:00',null],['100','10:00:00',15],['200','11:00:00',null],['30','09:00:00',null],['300','12:00:00',10]] as const)await prisma.booking.create({data:{...base,externalId,pickupDueTime:new Date('2051-01-01T'+time+'Z'),price}});
  const before=await prisma.booking.findMany({where:{provider},orderBy:{id:'asc'}});
  const targets=await externalBookingComparison('targets',null,null,options);assert.ok('targets'in targets&&targets.targets.length===3);if('targets'in targets)assert.ok(targets.targets.every(t=>t.price===null&&t.cost===null&&!('rawPayload'in t)));
  const probe=await externalBookingComparison('probe',null,null,options);assert.equal('idType'in probe&&probe.idType,'int8');
  const bounds=await externalBookingComparison('bounds',null,null,options);assert.equal('last'in bounds&&(bounds.last as Array<{throughId:string}>)[0].throughId,'30');
  const summary=await externalBookingComparison('summary',null,null,options);assert.equal('rows'in summary&&(summary.rows as Array<{source_rows:number}>)[0].source_rows,4);
  const duplicates=await externalBookingComparison('duplicates',null,null,options);assert.equal('rows'in duplicates&&(duplicates.rows as Array<{n:number}>)[0].n,2);
  const result=await externalBookingComparison('scan',null,'30',options);assert.ok('matches'in result);
  if('matches'in result){assert.equal(result.selected,4);assert.equal(result.hasMore,false);assert.equal(result.matches.find(m=>m.targetReference==='10')?.possibleDoubleImport,true);assert.equal(result.matches.find(m=>m.targetReference==='30')?.possibleDoubleImport,false);assert.equal(result.matches.find(m=>m.targetReference==='200')?.sourceHasAmount,true)}
  const tail=await externalBookingComparison('scan','20','30',options);assert.ok('selected'in tail&&tail.selected===1);
  assert.deepEqual(await prisma.booking.findMany({where:{provider},orderBy:{id:'asc'}}),before);
  const source=await prisma.$queryRawUnsafe<Array<{n:number}>>(`SELECT count(*)::int n FROM "${table}"`);assert.equal(source[0].n,4);
  await assert.rejects(externalBookingComparison('probe',null,null,{table:'other',provider}));
 }finally{await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}"`);await prisma.booking.deleteMany({where:{provider}});await prisma.$disconnect()}
});
