import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';

// Aggregate evidence only. Never writes source bookings or returns customer payloads.
export async function missingAmountAudit(afterId: string | null = null, history = false, provider: string | null = null) {
 return prisma.$transaction(async tx => {
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  await tx.$executeRaw`SET LOCAL statement_timeout='25s'`;
  await tx.$executeRaw`SET LOCAL max_parallel_workers_per_gather=0`;
  await tx.$executeRaw`SET LOCAL work_mem='8MB'`;
  const rows = await tx.$queryRaw<Array<{id:string;provider:string;externalId:string;status:string;year:string|null;fare:string|null;rawPrice:string|null;rawCost:string|null;lowerPrice:string|null;lowerCost:string|null;rootPrice:string|null;rootCost:string|null;hasPricing:boolean;accountAmount:string|null;cashAmount:string|null}>>(Prisma.sql`
   SELECT id, provider, "externalId",status,to_char(coalesce("completedAt","pickupDueTime","bookedAtTime") AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London','YYYY') AS "year",fare::text,
    coalesce("rawPayload"#>>'{Pricing,Price}',"rawPayload"#>>'{Pricing,price}') "rawPrice",
    coalesce("rawPayload"#>>'{Pricing,Cost}',"rawPayload"#>>'{Pricing,cost}') "rawCost",
    coalesce("rawPayload"#>>'{pricing,price}',"rawPayload"#>>'{pricing,Price}') "lowerPrice",
    coalesce("rawPayload"#>>'{pricing,cost}',"rawPayload"#>>'{pricing,Cost}') "lowerCost",
    coalesce("rawPayload"->>'Price',"rawPayload"->>'price') "rootPrice",
    coalesce("rawPayload"->>'Cost',"rawPayload"->>'cost') "rootCost",
    jsonb_typeof("rawPayload"->'Pricing')='object' "hasPricing",
    "accountAmount"::text,"cashAmount"::text
   FROM "Booking" WHERE price IS NULL AND cost IS NULL
    ${afterId ? Prisma.sql`AND id>${afterId}` : Prisma.empty}
    ${provider ? Prisma.sql`AND provider=${provider}` : Prisma.empty}
   ORDER BY id LIMIT 1001`);
  const batch=rows.slice(0,1000);
  const numeric=(v:string|null)=>v!==null&&v.trim()!==''&&/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(v.trim())&&Number.isFinite(Number(v));
  const groups=new Map<string,{status:string;year:string|null;bookings:number;pricingObject:number;originalAmount:number;alternateAmount:number;fareKnown:number;fareNonzero:number;paymentAllocationKnown:number}>();
  for(const row of batch){
   const key=JSON.stringify([row.status,row.year]);
   const g=groups.get(key)??{status:row.status,year:row.year,bookings:0,pricingObject:0,originalAmount:0,alternateAmount:0,fareKnown:0,fareNonzero:0,paymentAllocationKnown:0};
   g.bookings++;g.pricingObject+=Number(!!row.hasPricing);
   g.originalAmount+=Number(numeric(row.rawPrice)||numeric(row.rawCost));
   g.alternateAmount+=Number([row.lowerPrice,row.lowerCost,row.rootPrice,row.rootCost].some(numeric));
   g.fareKnown+=Number(numeric(row.fare));g.fareNonzero+=Number(numeric(row.fare)&&Number(row.fare)!==0);
   g.paymentAllocationKnown+=Number(numeric(row.accountAmount)||numeric(row.cashAmount));groups.set(key,g);
  }
  const nacEvidence={tableAvailable:false,matchedBookings:0,withRecordedAmount:0};
  const available=await tx.$queryRaw<Array<{n:number}>>`SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name IN ('external_booking_id','pricing_data','raw_payload')`;
  if(available[0]?.n===3){
   nacEvidence.tableAvailable=true;
   const ids=batch.filter(r=>r.provider==='AUTOCAB').map(r=>r.externalId);
   if(ids.length){
    const matches=await tx.$queryRaw<Array<{price:string|null;cost:string|null;rawPrice:string|null;rawCost:string|null}>>(Prisma.sql`
     SELECT coalesce(pricing_data->>'price',pricing_data->>'Price') price,
      coalesce(pricing_data->>'cost',pricing_data->>'Cost') cost,
      coalesce(raw_payload#>>'{Pricing,Price}',raw_payload#>>'{pricing,price}',raw_payload#>>'{Price}') "rawPrice",
      coalesce(raw_payload#>>'{Pricing,Cost}',raw_payload#>>'{pricing,cost}',raw_payload#>>'{Cost}') "rawCost"
     FROM public.bookings WHERE external_booking_id IN (${Prisma.join(ids)})`);
    nacEvidence.matchedBookings=matches.length;
    nacEvidence.withRecordedAmount=matches.filter(m=>[m.price,m.cost,m.rawPrice,m.rawCost].some(numeric)).length;
   }
  }
  const historyEvidence={sampledBookings:0,withEvents:0,withHistoricalAmount:0,withSnapshots:0,withSnapshotAmount:0,eventLimitReached:0,snapshotLimitReached:0};
  if(history)for(const row of batch.slice(0,100)){
   const events=await tx.webhookEvent.findMany({where:{provider:row.provider,externalBookingId:row.externalId},orderBy:{receivedAt:'desc'},take:21,select:{payload:true}});
   const snapshots=await tx.bookingSnapshot.findMany({where:{bookingId:row.id},orderBy:{createdAt:'desc'},take:21,select:{snapshot:true}});
   const amount=(input:unknown)=>{
    if(!input||typeof input!=='object'||Array.isArray(input))return false;
    const object=input as Record<string,unknown>;
    const pricing=object.Pricing??object.pricing;
    const p=pricing&&typeof pricing==='object'&&!Array.isArray(pricing)?pricing as Record<string,unknown>:object;
    return ['Price','price','Cost','cost'].some(k=>(typeof p[k]==='number'||typeof p[k]==='string')&&numeric(String(p[k])));
   };
   historyEvidence.sampledBookings++;historyEvidence.withEvents+=Number(events.length>0);
   historyEvidence.withHistoricalAmount+=Number(events.slice(0,20).some(e=>amount(e.payload)));
   historyEvidence.withSnapshots+=Number(snapshots.length>0);historyEvidence.withSnapshotAmount+=Number(snapshots.slice(0,20).some(e=>amount(e.snapshot)));
   historyEvidence.eventLimitReached+=Number(events.length>20);historyEvidence.snapshotLimitReached+=Number(snapshots.length>20);
  }
  return {selected:batch.length,nextCursor:batch.at(-1)?.id??afterId,hasMore:rows.length>1000,groups:Array.from(groups.values()),historyEvidence,nacEvidence,containsPersonalData:false,readOnly:true};
 },{timeout:30000,maxWait:5000,isolationLevel:'RepeatableRead'});
}
