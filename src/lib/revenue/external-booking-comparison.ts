import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { recordedAmount } from '@/lib/revenue/booking-value';

export const externalComparisonModes=['targets','metadata','probe','bounds','summary','duplicates','scan','local-duplicates'] as const;
export type ExternalComparisonMode=typeof externalComparisonModes[number];
const cursorTypes:Record<string,string>={int2:'smallint',int4:'integer',int8:'bigint',numeric:'numeric',uuid:'uuid',text:'text',varchar:'character varying',bpchar:'character'};
type SourceRow={sourceId:string;reference:string|null;originalReference:string|null;sourceStatus:string|null;price:string|null;cost:string|null;fare:string|null;pickupAt:string|null;completedAt:string|null;pickupMs:string|null};
function reference(v:string|null){const s=v?.trim();return s&&s!=='0'?s:null}
function normalizedReference(v:string|null){const s=reference(v);return s&&/^\d+$/.test(s)?s.replace(/^0+(?=\d)/,''):s}

/** Explicitly authorized source access. No mutation/apply operation exists. */
export async function externalBookingComparison(mode:ExternalComparisonMode,afterId:string|null=null,throughId:string|null=null,test?:{table:string;provider:string}){
 if(test&&!(process.env.DATABASE_URL==='postgresql://taxicrm@127.0.0.1:5432/taxicrm'&&process.env.TAXICRM_SYNTHETIC_TESTS==='1'&&/^SyntheticNeedacabSource[a-z0-9]+$/i.test(test.table)))throw new Error('Synthetic source override forbidden');
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  await tx.$executeRaw`SET LOCAL statement_timeout='25s'`;
  await tx.$executeRaw`SET LOCAL max_parallel_workers_per_gather=0`;
  await tx.$executeRaw`SET LOCAL work_mem='8MB'`;
  if(mode==='targets'){
   const rows=await tx.booking.findMany({where:{provider:test?.provider??'AUTOCAB',...(afterId?{id:{gt:afterId}}:{}),OR:[{price:null,cost:null},{createdAt:{gte:new Date('2026-10-02T06:12:30Z'),lte:new Date('2026-10-02T06:18:07Z')}}]},orderBy:{id:'asc'},take:1001,select:{id:true,provider:true,externalId:true,originalBookingId:true,status:true,price:true,cost:true,fare:true,pickupDueTime:true,completedAt:true,createdAt:true,updatedAt:true,driverId:true,driverBadgeNumber:true,paymentType:true,companyId:true,rawPayload:true,locations:{select:{type:true,address:true}}}});
   const hash=(v:string|undefined)=>v?createHash('sha256').update(v).digest('hex'):null;
   const targets=rows.slice(0,1000).map(({rawPayload,locations,...b})=>{
    const payload=rawPayload&&typeof rawPayload==='object'&&!Array.isArray(rawPayload)?rawPayload as Record<string,unknown>:{};
    return {...b,importMarker:payload.source==='aws_import'?'aws_import':null,locations:locations.map(l=>({type:l.type,exactHash:hash(l.address),normalizedHash:hash(l.address.trim().toLowerCase().replace(/\s+/g,' '))}))};
   });
   return {readOnly:true,targets,selected:targets.length,nextCursor:targets.at(-1)?.id??afterId,hasMore:rows.length>1000,containsCustomerContacts:false};
  }
  if(mode==='local-duplicates'){
   const raw=await tx.$queryRaw`WITH duplicated AS (SELECT provider,"externalId",count(*) n FROM "Booking" GROUP BY provider,"externalId" HAVING count(*)>1) SELECT count(*)::int duplicate_groups,coalesce(sum(n),0)::text rows_in_groups FROM duplicated`;
   const normalized=await tx.$queryRaw`WITH duplicated AS (SELECT upper(trim(provider)),CASE WHEN trim("externalId") ~ '^[0-9]+$' THEN coalesce(nullif(ltrim(trim("externalId"),'0'),''),'0') ELSE trim("externalId") END normalized_reference,count(*) n FROM "Booking" GROUP BY 1,2 HAVING count(*)>1) SELECT count(*)::int candidate_groups,coalesce(sum(n),0)::text rows_in_groups FROM duplicated`;
   const indexes=await tx.$queryRaw`SELECT c.relname index_name,i.indisunique unique_index,i.indisvalid valid,pg_get_indexdef(i.indexrelid) definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public."Booking"'::regclass AND i.indisunique`;
   return {readOnly:true,raw,normalized,indexes};
  }
  const table=test?.table??'needacab_bookings';const provider=test?.provider??'AUTOCAB';
  const columns=await tx.$queryRaw<Array<{column:string;type:string;kind:string}>>`SELECT a.attname::text AS column,t.typname::text AS type,c.relkind::text kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped JOIN pg_type t ON t.oid=a.atttypid WHERE n.nspname='public' AND c.relname=${table}`;
  if(mode==='metadata')return {readOnly:true,columns};
  if(!test&&columns[0]?.kind!=='f')throw new Error('Expected the approved foreign source');
  if(!['id','autocab_booking_id','original_booking_id','status','price','cost','fare','pickup_due_time','completed_at'].every(k=>columns.some(c=>c.column===k)))throw new Error('Source schema unavailable');
  const idType=columns.find(c=>c.column==='id')!.type;const cast=cursorTypes[idType];if(!cast)throw new Error('Unsupported source key type');
  const pickupType=columns.find(c=>c.column==='pickup_due_time')!.type;
  const source=Prisma.raw('public."'+table.replace(/"/g,'""')+'"');const nativeCast=Prisma.raw(cast);
  const bound=(value:string)=>{if(!['text','varchar','bpchar'].includes(idType)&&!(idType==='uuid'?/^[0-9a-f-]{36}$/i:/^[-+]?\d+(?:\.\d+)?$/).test(value))throw new Error('Invalid typed source cursor');return Prisma.sql`${value}::${nativeCast}`};
  const fields=Prisma.sql`id::text AS "sourceId",autocab_booking_id::text AS reference,original_booking_id::text AS "originalReference",status::text AS "sourceStatus",price::text,cost::text,fare::text,pickup_due_time::text AS "pickupAt",completed_at::text AS "completedAt",${['timestamp','timestamptz','date'].includes(pickupType)?Prisma.sql`round(extract(epoch FROM pickup_due_time)*1000)::text`:Prisma.sql`NULL::text`} AS "pickupMs"`;
  if(mode==='probe')return {readOnly:true,sourceType:columns[0].kind,idType,pickupType,rows:await tx.$queryRaw<SourceRow[]>(Prisma.sql`SELECT ${fields} FROM ${source} ORDER BY id LIMIT 5`)};
  if(mode==='bounds')return {readOnly:true,last:await tx.$queryRaw(Prisma.sql`SELECT id::text AS "throughId" FROM ${source} ORDER BY id DESC LIMIT 1`)};
  if(mode==='summary')return {readOnly:true,rows:await tx.$queryRaw(Prisma.sql`SELECT count(*)::int source_rows,count(DISTINCT id)::int distinct_ids,count(*) FILTER(WHERE nullif(trim(autocab_booking_id::text),'') IS NOT NULL AND trim(autocab_booking_id::text)<>'0')::int with_autocab_reference,count(*) FILTER(WHERE cost IS NOT NULL OR price IS NOT NULL)::int with_recorded_amount FROM ${source}`)};
  if(mode==='duplicates')return {readOnly:true,rows:await tx.$queryRaw(Prisma.sql`WITH duplicated AS (SELECT trim(autocab_booking_id::text) reference,count(*)::int n,count(DISTINCT id)::int source_ids FROM ${source} WHERE nullif(trim(autocab_booking_id::text),'') IS NOT NULL AND trim(autocab_booking_id::text)<>'0' GROUP BY 1 HAVING count(*)>1) SELECT reference,n,source_ids,count(*) OVER()::int total_duplicate_groups,sum(n) OVER()::text total_rows_in_groups FROM duplicated ORDER BY n DESC,reference LIMIT 101`)};
  if(mode!=='scan')throw new Error('Unsupported mode');
  const rows=await tx.$queryRaw<SourceRow[]>(Prisma.sql`SELECT ${fields} FROM ${source} WHERE true ${afterId?Prisma.sql`AND id>${bound(afterId)}`:Prisma.empty} ${throughId?Prisma.sql`AND id<=${bound(throughId)}`:Prisma.empty} ORDER BY id LIMIT 1001`);
  const batch=rows.slice(0,1000);
  const keys=Array.from(new Set(batch.flatMap(s=>[s.sourceId,reference(s.reference),normalizedReference(s.reference),reference(s.originalReference)]).filter((s):s is string=>!!s)));
  const local=keys.length?await tx.booking.findMany({where:{provider,externalId:{in:keys}},select:{id:true,externalId:true,status:true,price:true,cost:true,pickupDueTime:true,updatedAt:true}}):[];
  const byReference=new Map(local.map(b=>[b.externalId,b]));
  const matches=[];
  for(const s of batch){
   const ref=reference(s.reference),normalized=normalizedReference(s.reference),original=reference(s.originalReference);
   const matching=new Map<string,{local:typeof local[number];methods:string[]}>();
   for(const [key,method] of [[s.sourceId,'SOURCE_PRIMARY_ID'],[ref,'AUTOCAB_REFERENCE'],[original,'ORIGINAL_REFERENCE'],[normalized,'NUMERIC_NORMALIZED_REFERENCE']] as const){
    const b=key?byReference.get(key):null;if(!b||b.status!=='COMPLETED'||b.price!==null||b.cost!==null)continue;
    const m=matching.get(b.id)??{local:b,methods:[]};if(method!=='NUMERIC_NORMALIZED_REFERENCE'||normalized!==ref)m.methods.push(method);matching.set(b.id,m);
   }
   const counterpart=ref?byReference.get(ref):null;
   for(const {local:b,methods} of Array.from(matching.values())){
    const sameTime=s.pickupMs!==null&&b.pickupDueTime!==null&&s.pickupMs===String(b.pickupDueTime.getTime());
    const other=counterpart&&counterpart.id!==b.id?counterpart:null;
    const otherSameTime=other?.pickupDueTime!==null&&other?.pickupDueTime!==undefined&&s.pickupMs===String(other.pickupDueTime.getTime());
    matches.push({...s,targetId:b.id,targetReference:b.externalId,targetPickup:b.pickupDueTime?.toISOString()??null,targetVersion:b.updatedAt.toISOString(),methods,sameStoredPickup:sameTime,sourceHasAmount:recordedAmount(s.price)!==null||recordedAmount(s.cost)!==null,counterpart:other?{id:other.id,reference:other.externalId,status:other.status,hasAmount:recordedAmount(other.price)!==null||recordedAmount(other.cost)!==null,sameStoredPickup:otherSameTime}:null,possibleDoubleImport:methods.includes('SOURCE_PRIMARY_ID')&&s.sourceId!==ref&&!!other&&sameTime&&otherSameTime});
   }
  }
  return {readOnly:true,selected:batch.length,nextCursor:batch.at(-1)?.sourceId??afterId,hasMore:rows.length>1000,matches,containsCustomerContacts:false};
 },{timeout:30000,maxWait:5000,isolationLevel:'RepeatableRead'});
}
