import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '@/lib/prisma';
import {bookingImportComparison} from '@/lib/revenue/booking-import-comparison';
assert.equal(process.env.DATABASE_URL,'postgresql://taxicrm@127.0.0.1:5432/taxicrm');assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS,'1');
test('import comparison finds distinct exact, minute, reference and archive evidence without altering source',async()=>{
 const prefix='synthetic-compare-'+randomUUID();const table='BookingArchiveSynthetic'+randomUUID().replaceAll('-','');
 try{
  const c=await prisma.normalCustomer.create({data:{normalizedTelephone:prefix,telephoneNumber:prefix}});
  const base={provider:prefix,normalCustomerId:c.id,pickupDueTime:new Date('2051-01-01T10:00:01Z'),status:'COMPLETED',rawPayload:{importSource:'need-a-cab',history:{price:'18'},bookingId:'priced'}};
  const s=await prisma.booking.create({data:{...base,externalId:'suspect',originalBookingId:'priced'}});
  await prisma.booking.create({data:{...base,externalId:'priced',price:0}});
  await prisma.booking.create({data:{...base,externalId:'minute',price:30,pickupDueTime:new Date('2051-01-01T10:00:30Z')}});
  await prisma.booking.create({data:{...base,externalId:'unrelated',price:80,normalCustomerId:null}});
  await prisma.$executeRawUnsafe(`CREATE TABLE "${table}" (id text,provider text,"externalId" text,price numeric,cost numeric)`);
  await prisma.$executeRawUnsafe(`INSERT INTO "${table}" VALUES ($1,$2,$3,18,12)`,s.id,prefix,'suspect');
  const catalog=await bookingImportComparison('catalog') as Array<Record<string,unknown>>;assert.ok(catalog.some(r=>r.table===table));
  const before=await prisma.booking.findMany({where:{provider:prefix},orderBy:{id:'asc'}});
  const exact=await bookingImportComparison('exact',prefix) as Array<Record<string,number>>;assert.equal(exact[0].candidate_pairs,1);assert.equal(exact[0].with_priced_match,1);
  const minute=await bookingImportComparison('minute',prefix) as Array<Record<string,number>>;assert.equal(minute[0].candidate_pairs,1);
  const refs=await bookingImportComparison('references',prefix) as Array<Record<string,number>>;assert.equal(refs[0].with_priced_match,1);
  const sourceIds=await bookingImportComparison('source-ids',prefix) as Array<Record<string,unknown>>;assert.ok(sourceIds.some(r=>r.reason==='SOURCE_KEY_MATCHES_EXTERNAL_ID'&&r.with_priced_match===1));
  const archive=await bookingImportComparison('archive',prefix,table) as Array<Record<string,number>>;assert.equal(archive[0].with_archived_amount,1);assert.equal(archive[0].same_id,1);
  const payloads=await bookingImportComparison('payloads',prefix) as Array<Record<string,unknown>>;assert.equal(payloads[0].bookings,1);assert.equal(payloads[0].with_nested_amount_field,1);assert.equal(payloads[0].import_marker,'need-a-cab');
  const footprints=await bookingImportComparison('footprint',prefix) as Array<Record<string,unknown>>;assert.equal(footprints.find(r=>r.scope==='TOTAL')?.suspect_bookings,1);
  await assert.rejects(bookingImportComparison('archive',prefix,'Booking;DELETE'));
  assert.deepEqual(await prisma.booking.findMany({where:{provider:prefix},orderBy:{id:'asc'}}),before);
 }finally{await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}"`);await prisma.booking.deleteMany({where:{provider:prefix}});await prisma.normalCustomer.deleteMany({where:{normalizedTelephone:prefix}});await prisma.$disconnect()}
});
