import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
export const importComparisonModes=['catalog','footprint','payloads','exact','minute','references','archive'] as const;
export type ImportComparisonMode=typeof importComparisonModes[number];
export async function bookingImportComparison(mode:ImportComparisonMode,provider:string|null=null,table:string|null=null){
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  await tx.$executeRaw`SET LOCAL statement_timeout='25s'`;
  await tx.$executeRaw`SET LOCAL max_parallel_workers_per_gather=0`;
  await tx.$executeRaw`SET LOCAL work_mem='8MB'`;
  const suspects=Prisma.sql`SELECT id,provider,"externalId","originalBookingId","normalCustomerId","pickupDueTime" FROM "Booking" WHERE status='COMPLETED' AND price IS NULL AND cost IS NULL ${provider?Prisma.sql`AND provider=${provider}`:Prisma.empty}`;
  if(mode==='catalog')return tx.$queryRaw`
   SELECT n.nspname AS schema,c.relname AS "table",c.relkind::text kind,c.reltuples::bigint::text estimated_rows,
    coalesce(array_agg(a.attname::text ORDER BY a.attnum) FILTER(WHERE a.attname IN ('id','provider','externalId','originalBookingId','price','cost','rawPayload','external_booking_id','pricing_data','raw_payload','bookingId','snapshot','payload','data')),ARRAY[]::text[]) relevant_columns
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
   WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
    AND c.relname ~* '(booking|snapshot|import|apirecord|api_record)'
   GROUP BY n.nspname,c.relname,c.relkind,c.reltuples ORDER BY n.nspname,c.relname`;
  if(mode==='footprint')return tx.$queryRaw`
   WITH base AS (
    SELECT provider,status,price,cost,"createdAt","completedAt","pickupDueTime",status='COMPLETED' AND price IS NULL AND cost IS NULL suspect,
     to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London','YYYY-MM-DD') created_day FROM "Booking" WHERE (${provider}::text IS NULL OR provider=${provider})
   ) SELECT CASE WHEN GROUPING(created_day)=0 THEN 'CREATED_DAY' WHEN GROUPING(status)=0 THEN 'STATUS' WHEN GROUPING(provider)=0 THEN 'PROVIDER' ELSE 'TOTAL' END scope,created_day,status,provider,
    count(*)::int bookings,count(*) FILTER(WHERE suspect)::int suspect_bookings,
    count(*) FILTER(WHERE price IS NOT NULL OR cost IS NOT NULL)::int with_amount,
    count(*) FILTER(WHERE "completedAt"="createdAt")::int completion_equals_creation,
    count(*) FILTER(WHERE suspect AND "completedAt"="createdAt")::int suspect_completion_equals_creation,
    min("createdAt")::text first_created,max("createdAt")::text last_created,
    min("pickupDueTime")::text first_pickup,max("pickupDueTime")::text last_pickup
   FROM base GROUP BY GROUPING SETS ((),(created_day),(status),(provider)) ORDER BY scope,bookings DESC`;
  if(mode==='payloads')return tx.$queryRaw(Prisma.sql`
   WITH selected AS (SELECT b."rawPayload",b.id FROM "Booking" b JOIN (${suspects}) s ON s.id=b.id), patterns AS (
    SELECT id,CASE WHEN jsonb_typeof("rawPayload")='object' THEN ARRAY(SELECT k FROM jsonb_object_keys("rawPayload") k ORDER BY k) ELSE ARRAY['NON_OBJECT']::text[] END root_keys,
     CASE WHEN coalesce("rawPayload"->>'source',"rawPayload"->>'importSource','') ~* '^(autocab|taxicrm|legacy|import|history|customer.?booking|manual|migration)[A-Za-z0-9 _-]{0,100}$' THEN coalesce("rawPayload"->>'source',"rawPayload"->>'importSource') ELSE NULL END import_marker,
     (jsonb_path_exists("rawPayload",'$.**.Price ? (@ != null)') OR jsonb_path_exists("rawPayload",'$.**.price ? (@ != null)') OR jsonb_path_exists("rawPayload",'$.**.Cost ? (@ != null)') OR jsonb_path_exists("rawPayload",'$.**.cost ? (@ != null)')) nested_amount_field
    FROM selected
   ) SELECT root_keys,import_marker,count(*)::int bookings,count(*) FILTER(WHERE nested_amount_field)::int with_nested_amount_field FROM patterns GROUP BY root_keys,import_marker ORDER BY bookings DESC`);
  if(mode==='exact'||mode==='minute'){
   const timeMatch=mode==='exact'?Prisma.sql`b."pickupDueTime"=s."pickupDueTime"`:Prisma.sql`date_trunc('minute',b."pickupDueTime")=date_trunc('minute',s."pickupDueTime") AND b."pickupDueTime"<>s."pickupDueTime"`;
   return tx.$queryRaw(Prisma.sql`
    WITH suspects AS MATERIALIZED (${suspects}), matches AS (
     SELECT s.id suspect_id,b.id other_id,b.price IS NOT NULL OR b.cost IS NOT NULL priced,b.status,
      b.status='COMPLETED' AND b.price IS NULL AND b.cost IS NULL other_suspect,
      nullif(trim(sp.address),'') IS NOT NULL AND nullif(trim(sd.address),'') IS NOT NULL AND lower(trim(sp.address))=lower(trim(bp.address)) AND lower(trim(sd.address))=lower(trim(bd.address)) same_route
     FROM suspects s JOIN "Booking" b ON b.provider=s.provider AND b."normalCustomerId"=s."normalCustomerId" AND ${timeMatch} AND b.id<>s.id
     LEFT JOIN "BookingLocation" sp ON sp."bookingId"=s.id AND sp.type='PICKUP'
     LEFT JOIN "BookingLocation" sd ON sd."bookingId"=s.id AND sd.type='DESTINATION'
     LEFT JOIN "BookingLocation" bp ON bp."bookingId"=b.id AND bp.type='PICKUP'
     LEFT JOIN "BookingLocation" bd ON bd."bookingId"=b.id AND bd.type='DESTINATION'
    ) SELECT count(*)::int candidate_pairs,count(DISTINCT suspect_id)::int suspect_bookings_with_match,
     count(DISTINCT suspect_id) FILTER(WHERE priced)::int with_priced_match,
     count(DISTINCT suspect_id) FILTER(WHERE priced AND same_route)::int with_priced_same_route,
     count(DISTINCT suspect_id) FILTER(WHERE NOT other_suspect)::int with_match_outside_suspect_cohort,
     count(*) FILTER(WHERE same_route)::int same_route_pairs FROM matches`);
  }
  if(mode==='references')return tx.$queryRaw(Prisma.sql`
   WITH suspects AS MATERIALIZED (${suspects}), matches AS (
    SELECT s.id suspect_id,b.id other_id,'SUSPECT_ORIGINAL_ID' reason,b.price IS NOT NULL OR b.cost IS NOT NULL priced FROM suspects s JOIN "Booking" b ON b.provider=s.provider AND b."externalId"=s."originalBookingId" AND b.id<>s.id
    UNION ALL SELECT s.id,b.id,'OTHER_ORIGINAL_ID',b.price IS NOT NULL OR b.cost IS NOT NULL FROM suspects s JOIN "Booking" b ON b.provider=s.provider AND b."originalBookingId"=s."externalId" AND b.id<>s.id
    UNION ALL SELECT s.id,b.id,'OTHER_PROVIDER_SAME_REFERENCE',b.price IS NOT NULL OR b.cost IS NOT NULL FROM suspects s JOIN "Booking" b ON b.provider<>s.provider AND b."externalId"=s."externalId"
   ) SELECT reason,count(*)::int candidate_pairs,count(DISTINCT suspect_id)::int suspect_bookings_with_match,count(DISTINCT suspect_id) FILTER(WHERE priced)::int with_priced_match FROM matches GROUP BY reason ORDER BY reason`);
  if(mode==='archive'){
   if(!table||!/^Booking[A-Za-z0-9_]*$/.test(table)||table==='Booking')throw new Error('Unsupported archive table');
   const available=await tx.$queryRaw<Array<{column:string}>>`SELECT a.attname::text AS column FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname='public' AND c.relname=${table} AND c.relkind IN ('r','p')`;
   if(!['id','provider','externalId','price','cost'].every(key=>available.some(c=>c.column===key)))throw new Error('Unsupported archive columns');
   const name=Prisma.raw('"'+table.replace(/"/g,'""')+'"');
   return tx.$queryRaw(Prisma.sql`
    WITH suspects AS MATERIALIZED (${suspects}), matches AS (
     SELECT s.id suspect_id,a.id archive_id,a.price IS NOT NULL OR a.cost IS NOT NULL priced,a.id=s.id same_id,
      a.price IS NULL AND a.cost IS NULL same_missing_amounts FROM suspects s JOIN public.${name} a ON a.provider=s.provider AND a."externalId"=s."externalId"
    ) SELECT count(*)::int candidate_pairs,count(DISTINCT suspect_id)::int matched_suspect_bookings,
     count(DISTINCT suspect_id) FILTER(WHERE priced)::int with_archived_amount,
     count(DISTINCT suspect_id) FILTER(WHERE same_id)::int same_id,
     count(DISTINCT suspect_id) FILTER(WHERE same_missing_amounts)::int archived_already_missing FROM matches`);
  }
  throw new Error('Unsupported comparison mode');
 },{timeout:30000,maxWait:5000,isolationLevel:'RepeatableRead'});
}
