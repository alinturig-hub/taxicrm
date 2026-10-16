import { prisma } from '@/lib/prisma';

/** Read-only dimensions of completed bookings with both source amounts absent. */
export async function missingCompletedCohort(provider:string|null=null){
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  await tx.$executeRaw`SET LOCAL statement_timeout='25s'`;
  await tx.$executeRaw`SET LOCAL max_parallel_workers_per_gather=0`;
  await tx.$executeRaw`SET LOCAL work_mem='8MB'`;
  return tx.$queryRaw<Array<Record<string,string|number|null>>>`
   WITH cohort AS MATERIALIZED (
    SELECT id,provider,"accountId","accountCode","accountName","customerName","telephoneNumber","normalCustomerId","driverId","driverBadgeNumber","completedAt","cancelledAt","noFareAt","pickupDueTime","bookedAtTime","createdAt","paymentType","accountType","bookingSource",("rawPayload"='{}'::jsonb) payload_empty,to_char(coalesce("completedAt","pickupDueTime","bookedAtTime") AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London','YYYY-MM') business_month,
     to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London','YYYY-MM-DD') created_day
    FROM "Booking" b WHERE status='COMPLETED' AND price IS NULL AND cost IS NULL AND (${provider}::text IS NULL OR provider=${provider})
   )
   SELECT CASE WHEN GROUPING(business_month)=0 THEN 'BUSINESS_MONTH' WHEN GROUPING(created_day)=0 THEN 'CREATED_DAY' WHEN GROUPING(provider)=0 THEN 'PROVIDER' WHEN GROUPING("paymentType")=0 THEN 'PAYMENT_TYPE' WHEN GROUPING("accountType")=0 THEN 'ACCOUNT_TYPE' WHEN GROUPING("bookingSource")=0 THEN 'BOOKING_SOURCE' ELSE 'TOTAL' END scope,
    business_month,created_day,provider,"paymentType","accountType","bookingSource",
    count(*)::int bookings,
    count(*) FILTER(WHERE nullif(trim("accountId"),'') IS NOT NULL)::int with_account_id,
    count(*) FILTER(WHERE nullif(trim("accountCode"),'') IS NOT NULL)::int with_account_code,
    count(*) FILTER(WHERE trim("accountId")='0')::int zero_account_id,
    count(*) FILTER(WHERE nullif(trim("accountName"),'') IS NOT NULL)::int with_account_name,
    count(DISTINCT nullif(trim("accountId"),''))::int distinct_account_ids,
    count(*) FILTER(WHERE nullif(trim("customerName"),'') IS NOT NULL)::int with_customer_name,
    count(*) FILTER(WHERE lower(trim("customerName")) IN ('unknown','unknown passenger','n/a','not supplied','-','—'))::int placeholder_customer_name,
    count(DISTINCT nullif(trim("customerName"),''))::int distinct_customer_names,
    count(*) FILTER(WHERE nullif(trim("telephoneNumber"),'') IS NOT NULL)::int with_phone,
    count(*) FILTER(WHERE "normalCustomerId" IS NOT NULL)::int linked_customer,
    count(*) FILTER(WHERE "driverId" IS NOT NULL)::int with_driver_id,
    count(*) FILTER(WHERE nullif(trim("driverBadgeNumber"),'') IS NOT NULL)::int with_driver_badge,
    count(*) FILTER(WHERE "completedAt" IS NOT NULL)::int with_completion_time,
    count(*) FILTER(WHERE "cancelledAt" IS NOT NULL)::int with_cancellation_time,
    count(*) FILTER(WHERE "noFareAt" IS NOT NULL)::int with_no_fare_time,
    count(*) FILTER(WHERE "pickupDueTime" IS NOT NULL)::int with_pickup_time,
    count(*) FILTER(WHERE "bookedAtTime" IS NOT NULL)::int with_booked_time,
    count(*) FILTER(WHERE payload_empty)::int empty_payload,
    count(*) FILTER(WHERE id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')::int uuid_ids,
    min("createdAt")::text first_created_at,max("createdAt")::text last_created_at,
    min("pickupDueTime")::text first_pickup_at,max("pickupDueTime")::text last_pickup_at,
    min("completedAt")::text first_completion_at,max("completedAt")::text last_completion_at
   FROM cohort GROUP BY GROUPING SETS ((),(business_month),(created_day),(provider),("paymentType"),("accountType"),("bookingSource"))
   ORDER BY scope,bookings DESC
  `;
 },{timeout:30000,maxWait:5000,isolationLevel:'RepeatableRead'});
}
