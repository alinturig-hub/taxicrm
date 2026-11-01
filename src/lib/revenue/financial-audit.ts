import { prisma } from '@/lib/prisma';
/** One repeatable read-only statement; no customer identities or source payloads returned. */
export async function financialAudit(provider: string | null = null) {
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  await tx.$executeRaw`SET LOCAL statement_timeout='25s'`;
  await tx.$executeRaw`SET LOCAL max_parallel_workers_per_gather=0`;
  await tx.$executeRaw`SET LOCAL work_mem='8MB'`;
  return tx.$queryRaw<Array<Record<string, string | number | null>>>`
   WITH amounts AS (
    SELECT b.*, CASE WHEN b.price::text NOT IN ('NaN','Infinity','-Infinity') THEN b.price END p,
      CASE WHEN b.cost::text NOT IN ('NaN','Infinity','-Infinity') THEN b.cost END c,
      to_char(coalesce(b."completedAt",b."pickupDueTime",b."bookedAtTime") AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London','YYYY-MM') AS business_month,
      b."completedAt" IS NOT NULL OR b.status='COMPLETED' completed,
      (b."noFareAt" IS NOT NULL OR b.status='NO_FARE') AND nullif(trim(b."accountId"),'') IS NOT NULL account_no_fare,
      CASE WHEN r."waitingChargeable" AND b."arrivedAt" IS NOT NULL AND b."noFareAt">b."arrivedAt"
        THEN round(extract(epoch FROM (b."noFareAt"-b."arrivedAt"))/60*coalesce(r."waitingRatePerMinute",0),2) ELSE 0 END waiting
    FROM "Booking" b LEFT JOIN "AccountRevenueRule" r
      ON r.provider=coalesce(nullif(trim(b.provider),''),'AUTOCAB') AND r."accountId"=nullif(trim(b."accountId"),'')
    WHERE (${provider}::text IS NULL OR b.provider=${provider})
   ), compared AS (
    SELECT *, CASE WHEN coalesce(p,0)>0 THEN p ELSE coalesce(c,0) END old_value,
      greatest(p,c) new_value FROM amounts
   )
   SELECT CASE WHEN GROUPING(provider,status,business_month)=7 THEN 'TOTAL' WHEN GROUPING(provider,status,business_month)=6 THEN 'MONTH' ELSE 'PROVIDER_STATUS' END scope,
    provider,status,business_month,
    count(*)::int bookings,
    count(*) FILTER(WHERE p IS NULL)::int missing_price,
    count(*) FILTER(WHERE c IS NULL)::int missing_cost,
    count(*) FILTER(WHERE p IS NULL AND c IS NULL)::int missing_both,
    count(*) FILTER(WHERE p<0 OR c<0)::int signed_negative,
    count(*) FILTER(WHERE c>p)::int cost_higher,
    count(*) FILTER(WHERE p>c)::int price_higher,
    count(*) FILTER(WHERE p=c)::int equal_values,
    count(*) FILTER(WHERE coalesce("pickupDueTime","bookedAtTime")>(now() AT TIME ZONE 'UTC'))::int future_dated,
    sum(p)::text price_total,sum(c)::text cost_total,sum(fare)::text fare_total,
    sum(old_value)::text previous_base_total,sum(new_value)::text proposed_base_total,
    sum(coalesce(new_value,0)-old_value)::text base_difference,
    sum(CASE WHEN completed THEN old_value WHEN account_no_fare THEN old_value+waiting ELSE 0 END)::text previous_recognized,
    sum(CASE WHEN completed THEN coalesce(new_value,0) WHEN account_no_fare THEN coalesce(new_value,0)+waiting ELSE 0 END)::text proposed_recognized,
    count(*) FILTER(WHERE (completed OR account_no_fare) AND new_value IS NULL)::int recognized_missing_amount
   FROM compared GROUP BY GROUPING SETS ((provider,status),(business_month),()) ORDER BY scope,provider,status,business_month
  `;
 },{timeout:30000,maxWait:5000,isolationLevel:'RepeatableRead'});
}
