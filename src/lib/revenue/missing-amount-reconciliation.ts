import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

type SourceEvent={id:string;eventType:string;status:string;receivedAt:Date;bookingId:string|null;processingError:string|null;payload:unknown};
type Target={id:string;externalId:string;originalBookingId:string|null;status:string;completedAt:Date|null};
function object(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}}
function text(value:unknown){return typeof value==='string'||typeof value==='number'?String(value).trim():null}
function amount(value:unknown){
 if(typeof value!=='number'&&typeof value!=='string')return null;
 if(typeof value==='string'&&!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value.trim()))return null;
 try{const d=new Prisma.Decimal(value);return d.isFinite()&&d.abs().lt('10000000000')&&d.decimalPlaces()<=2?d.toFixed(2):null}catch{return null}
}
function timestamp(value:unknown){if(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))return null;const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():null}
const completeTypes=new Set(['bookingcomplete','bookingcompleted','autocabbookingcompleted']);
export function reconcileMissingAmountEvidence(target:Target,events:SourceEvent[],truncated=false){
 const evidence=events.map(event=>{
  const p=object(event.payload),pricing=object(p.Pricing??p.pricing);
  const source=Object.keys(pricing).length?pricing:p;
  const price=amount(source.Price??source.price),cost=amount(source.Cost??source.cost);
  const ref=text(p.OriginalBookingId)||text(p.BookingId)||text(p.Id);
  const explicitTime=timestamp(p.EventTimestamp)||timestamp(p.Timestamp)||timestamp(p.ModifiedAtTime)||timestamp(p.ModifiedDate)||timestamp(p.CompletedAtTime);
  return {eventId:event.id,eventType:event.eventType,processingStatus:event.status,receivedAt:event.receivedAt.toISOString(),businessAt:explicitTime,sourceReference:ref,referenceMatches:ref===target.externalId,aliasMatches:!!target.originalBookingId&&ref===target.originalBookingId,price,cost,currency:text(source.Currency??source.CurrencyCode??p.Currency??p.CurrencyCode),bookingLinked:event.bookingId===target.id,linkedElsewhere:event.bookingId!==null&&event.bookingId!==target.id,hasProcessingError:!!event.processingError,payloadEmpty:Object.keys(p).length===0,isCompletion:completeTypes.has(event.eventType.replace(/[^a-z0-9]/gi,'').toLowerCase())};
 });
 const priced=evidence.filter(e=>e.price!==null||e.cost!==null);
 const comparable=priced.filter(e=>e.referenceMatches&&!e.linkedElsewhere);
 comparable.sort((a,b)=>Date.parse(b.businessAt??b.receivedAt)-Date.parse(a.businessAt??a.receivedAt)||a.eventId.localeCompare(b.eventId));
 const proposed=comparable[0]??null;
 const blockers:string[]=[];
 if(truncated)blockers.push('HISTORY_TRUNCATED');
 if(!proposed)blockers.push('NO_MATCHED_NUMERIC_SOURCE');
 if(evidence.some(e=>!e.referenceMatches||e.linkedElsewhere))blockers.push('IDENTITY_REVIEW');
 if(evidence.some(e=>!e.businessAt))blockers.push('INCOMPLETE_BUSINESS_CHRONOLOGY');
 if(proposed){
  if(proposed.currency?.toUpperCase()!=='GBP')blockers.push('CURRENCY_UNCONFIRMED');
  if(target.status!=='COMPLETED')blockers.push('NOT_COMPLETED');
  if(!proposed.isCompletion)blockers.push('FINAL_PRICE_UNCONFIRMED');
  if(!target.completedAt)blockers.push('COMPLETION_TIME_MISSING');
  if(target.completedAt&&proposed.businessAt&&Date.parse(proposed.businessAt)<target.completedAt.getTime())blockers.push('SOURCE_PREDATES_COMPLETION');
  if(evidence.some(e=>Date.parse(e.businessAt??e.receivedAt)>Date.parse(proposed.businessAt??proposed.receivedAt)))blockers.push('LATER_EVENT_REQUIRES_REVIEW');
  if(comparable.some(e=>e!==proposed&&(e.price!==null&&proposed.price!==null&&e.price!==proposed.price||e.cost!==null&&proposed.cost!==null&&e.cost!==proposed.cost)))blockers.push('HISTORICAL_AMOUNT_CHANGES');
 }
 const proposedValue=proposed?Prisma.Decimal.max(...[proposed.price,proposed.cost].filter((x):x is string=>x!==null)).toFixed(2):null;
 return {bookingId:target.id,externalId:target.externalId,status:target.status,completedAt:target.completedAt?.toISOString()??null,classification:blockers.length?'REVIEW_REQUIRED':'CONSISTENT_EVIDENCE',blockers,proposed:proposed?{price:proposed.price,cost:proposed.cost,value:proposedValue,eventId:proposed.eventId,businessAt:proposed.businessAt,currency:proposed.currency}:null,evidence};
}

export async function missingAmountReconciliation(afterId:string|null=null,provider:string|null=null){
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  await tx.$executeRaw`SET LOCAL statement_timeout='25s'`;
  await tx.$executeRaw`SET LOCAL max_parallel_workers_per_gather=0`;
  await tx.$executeRaw`SET LOCAL work_mem='8MB'`;
  const rows=await tx.$queryRaw<Array<Target&{provider:string;updatedAt:Date}>>(Prisma.sql`
   SELECT id,provider,"externalId","originalBookingId",status,"completedAt","updatedAt" FROM "Booking"
   WHERE price IS NULL AND cost IS NULL
    ${afterId?Prisma.sql`AND id>${afterId}`:Prisma.empty}
    ${provider?Prisma.sql`AND provider=${provider}`:Prisma.empty}
    AND EXISTS(SELECT 1 FROM "WebhookEvent" e WHERE e.provider="Booking".provider AND e."externalBookingId"="Booking"."externalId")
   ORDER BY id LIMIT 26`);
  const records=[];
  for(const row of rows.slice(0,25)){
   const events=await tx.webhookEvent.findMany({where:{provider:row.provider,externalBookingId:row.externalId},orderBy:[{receivedAt:'desc'},{id:'desc'}],take:201,select:{id:true,eventType:true,status:true,receivedAt:true,bookingId:true,processingError:true,payload:true}});
   records.push({...reconcileMissingAmountEvidence(row,events.slice(0,200),events.length>200),checkedVersion:row.updatedAt.toISOString()});
  }
  return {dryRun:true,readOnly:true,selected:records.length,nextCursor:records.at(-1)?.bookingId??afterId,hasMore:rows.length>25,containsBookingReferences:true,containsCustomerContacts:false,records};
 },{timeout:30000,maxWait:5000,isolationLevel:'RepeatableRead'});
}
