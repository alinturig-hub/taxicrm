import { addLondonDays, startOfLondonDay } from "@/lib/time/london-calendar";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  dayKey,
  previousRange,
  rentEstimate,
  type Range,
  type Totals,
  type Area,
  type AnalyticsData,
} from "./model";
// One read-only snapshot, server-side aggregates, no payload/address export or data writes.
const aggregate = Prisma.sql`count(*)::int total,
 count(*) FILTER(WHERE status='COMPLETED')::int completed,
 count(*) FILTER(WHERE status IN ('CANCELLED','CANCELLED_CUSTOMER','CANCELLED_DRIVER','CANCELLED_OPERATOR'))::int cancelled,
 count(*) FILTER(WHERE status='NO_FARE')::int "noFare",count(*) FILTER(WHERE status='REJECTED')::int rejected,
 count(*) FILTER(WHERE recovered)::int recovered,
 count(*) FILTER(WHERE "pickupDueTime">="bookedAtTime"+interval '6 hours')::int prebook,
 count(*) FILTER(WHERE pay='CASH')::int cash,count(*) FILTER(WHERE pay='ACCOUNT')::int account,count(*) FILTER(WHERE pay='CARD')::int card,count(*) FILTER(WHERE pay='OTHER')::int other,
 count(*) FILTER(WHERE status='COMPLETED' AND price IS NULL)::int "missingPrice",count(*) FILTER(WHERE status='COMPLETED' AND cost IS NULL)::int "missingCost",
 count(*) FILTER(WHERE area_key='UNKNOWN')::int "unknownArea",
 coalesce(sum(price) FILTER(WHERE status='COMPLETED'),0)::text gross,
 coalesce(sum(price) FILTER(WHERE status='COMPLETED' AND pay='CASH'),0)::text "cashIncome",
 coalesce(sum(price) FILTER(WHERE status='COMPLETED' AND pay='ACCOUNT'),0)::text "accountIncome",
 coalesce(sum(price) FILTER(WHERE status='COMPLETED' AND pay='CARD'),0)::text "cardIncome",
 coalesce(sum(price) FILTER(WHERE status='COMPLETED' AND pay='OTHER'),0)::text "otherIncome",
 coalesce(sum(cost) FILTER(WHERE status='COMPLETED'),0)::text "driverMoney",
 CASE WHEN count(*) FILTER(WHERE status='COMPLETED' AND(price IS NULL OR cost IS NULL))>0 THEN NULL ELSE coalesce(sum(price-cost) FILTER(WHERE status='COMPLETED'),0)::text END margin`;
function cte(range: Range, context = true) {
  const head = Prisma.sql`
 WITH source AS MATERIALIZED (
 SELECT b.id,b.provider,b."externalId",b.status,b.price,b.cost,b."driverId",b."pickupDueTime",b."bookedAtTime",
 CASE WHEN ((upper(coalesce(b."paymentType",'')) LIKE '%ACCOUNT%')::int+(upper(coalesce(b."paymentType",'')) LIKE '%CASH%')::int+(upper(coalesce(b."paymentType",'')) ~ '(CARD|CREDIT|DEBIT)')::int)>1 THEN 'OTHER'
 WHEN upper(coalesce(b."paymentType",'')) LIKE '%ACCOUNT%' THEN 'ACCOUNT'
 WHEN upper(coalesce(b."paymentType",'')) LIKE '%CASH%' THEN 'CASH'
 WHEN upper(coalesce(b."paymentType",'')) ~ '(CARD|CREDIT|DEBIT)' THEN 'CARD' ELSE 'OTHER' END pay
 FROM public."Booking" b WHERE b."pickupDueTime">=(${range.from.toISOString()}::timestamptz AT TIME ZONE 'UTC') AND b."pickupDueTime"<(${range.to.toISOString()}::timestamptz AT TIME ZONE 'UTC')
 ), cohort AS MATERIALIZED(SELECT * FROM source WHERE ${range.payment}='ALL' OR pay=${range.payment})`;
  if (!context)
    return Prisma.sql`${head}, selected AS MATERIALIZED(SELECT b.*,(b."pickupDueTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London') local_time FROM cohort b)`;
  return Prisma.sql`${head},
 recovered AS MATERIALIZED(
 SELECT DISTINCT b.id FROM cohort b JOIN public."WebhookEvent" w ON w.provider=b.provider AND w."externalBookingId"=b."externalId"
 WHERE w.status='PROCESSED' AND w."eventType" IN ('BookingRecovered','AUTOCAB_BOOKING_RECOVERED')
 UNION SELECT DISTINCT b.id FROM cohort b JOIN public."WebhookEvent" w ON w."bookingId"=b.id AND w.provider=b.provider AND w."externalBookingId" IS NULL
 WHERE w.status='PROCESSED' AND w."eventType" IN ('BookingRecovered','AUTOCAB_BOOKING_RECOVERED')
 ), selected AS MATERIALIZED(
 SELECT b.*,r.id IS NOT NULL recovered,coalesce(z.provider||':'||z."externalId",'UNKNOWN') area_key,coalesce(z.name,'Unknown area') area_name,z.latitude,z.longitude,
 (b."pickupDueTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London') local_time
 FROM cohort b LEFT JOIN recovered r ON r.id=b.id LEFT JOIN public."BookingLocation" l ON l."bookingId"=b.id AND l.type='PICKUP'
 LEFT JOIN public."Zone" z ON z.provider=b.provider AND z."externalId"=l."zoneId"
 )`;
}

type Row = Record<string, unknown>;
function totals(row: Row): Totals {
  const out: Record<string, number | null> = {};
  for (const key of [
    "total",
    "completed",
    "cancelled",
    "noFare",
    "rejected",
    "recovered",
    "prebook",
    "cash",
    "account",
    "card",
    "other",
    "missingPrice",
    "missingCost",
    "unknownArea",
    "gross",
    "cashIncome",
    "accountIncome",
    "cardIncome",
    "otherIncome",
    "driverMoney",
    "margin",
  ])
    out[key] = row[key] === null ? null : Number(row[key] ?? 0);
  return out as Totals;
}
export async function getAnalytics(
  range: Range,
  includeDrivers: boolean,
): Promise<AnalyticsData> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout='12s'");
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'");
      await tx.$executeRawUnsafe("SET LOCAL work_mem='8MB'");
      await tx.$executeRawUnsafe("SET LOCAL jit=off");
      await tx.$executeRawUnsafe("SET LOCAL max_parallel_workers_per_gather=0");
      const base = cte(range),
        plain = cte(range, false);
      const grouped = await tx.$queryRaw<Row[]>(
        Prisma.sql`${base} SELECT grouping(area_key)::int overall,area_key key,area_name name,latitude::text latitude,longitude::text longitude,${aggregate} FROM selected GROUP BY GROUPING SETS ((area_key,area_name,latitude,longitude),()) ORDER BY grouping(area_key) DESC,count(*) DESC LIMIT 1002`,
      );
      const previous = previousRange(range);
      const [comparison] = await tx.$queryRaw<{ total: number; completed: number; gross: string; missingPrice: number }[]>(Prisma.sql`${cte(previous, false)}
        SELECT count(*)::int total, count(*) FILTER(WHERE status='COMPLETED')::int completed,
        coalesce(sum(price) FILTER(WHERE status='COMPLETED'),0)::text gross,
        count(*) FILTER(WHERE status='COMPLETED' AND price IS NULL)::int "missingPrice" FROM selected`);
      const total = grouped.find((row) => row.overall === 1)!;
      const areaRows = grouped.filter((row) => row.overall === 0);
      if (areaRows.length > 1000)
        throw Error(
          "Too many zone definitions for this report. Narrow the date range.",
        );
      const timeRows = await tx.$queryRaw<
        {
          day: string;
          hour: number;
          weekday: number;
          count: number;
          gross: string;
          driverMoney: string;
        }[]
      >(
        Prisma.sql`${plain} SELECT to_char(local_time,'YYYY-MM-DD') AS "day",extract(hour FROM local_time)::int AS "hour",extract(isodow FROM local_time)::int AS weekday,count(*)::int count,coalesce(sum(price) FILTER(WHERE status='COMPLETED'),0)::text gross,coalesce(sum(cost) FILTER(WHERE status='COMPLETED'),0)::text "driverMoney" FROM selected GROUP BY 1,2,3 ORDER BY 1,2`,
      );
      const rentRows = await tx.$queryRaw<
        { driver: string; week: string; earnings: string; missing: number }[]
      >(
        Prisma.sql`${plain} SELECT coalesce(d.id,d2.id,'UNATTRIBUTED') driver,to_char(date_trunc('week',s.local_time),'YYYY-MM-DD') week,coalesce(sum(s.cost),0)::text earnings,count(*) FILTER(WHERE s.cost IS NULL OR coalesce(d.id,d2.id) IS NULL)::int missing FROM selected s LEFT JOIN public."Driver" d ON d.id=s."driverId" AND d.provider=s.provider LEFT JOIN public."Driver" d2 ON d.id IS NULL AND d2."externalId"=s."driverId" AND d2.provider=s.provider WHERE s.status='COMPLETED' GROUP BY 1,2 LIMIT 10001`,
      );
      if (rentRows.length > 10000)
        throw Error("Too many driver-weeks. Narrow the date range.");
      const configuration = await tx.driverRentConfiguration.findUnique({
        where: { key: "GLOBAL" },
        select: { rentPercentage: true, weeklyCap: true },
      });
      const rankings: AnalyticsData["drivers"] = {
        rejected: [],
        noFare: [],
        recovered: [],
        unattributed: 0,
      };
      if (includeDrivers) {
        const rows = await tx.$queryRaw<
          {
            kind: "rejected" | "noFare" | "recovered";
            label: string;
            count: number;
          }[]
        >(Prisma.sql`${plain}, outcomes AS (
    SELECT DISTINCT b.id,b.provider,CASE WHEN w."eventType" IN ('BookingRejected','AUTOCAB_BOOKING_REJECTED') THEN 'rejected' ELSE 'recovered' END kind,nullif(w.payload->'Driver'->>'Id','') external_driver
    FROM cohort b JOIN public."WebhookEvent" w ON w.provider=b.provider AND w."externalBookingId"=b."externalId" WHERE w.status='PROCESSED' AND w."eventType" IN ('BookingRejected','AUTOCAB_BOOKING_REJECTED','BookingRecovered','AUTOCAB_BOOKING_RECOVERED')
   ), grouped AS (
    SELECT o.kind,CASE WHEN d.id IS NULL THEN 'Unattributed' ELSE 'Driver '||coalesce(nullif(d."badgeNumber",''),nullif(d.callsign,''),d."externalId") END label,d.id driver,count(DISTINCT o.id)::int count FROM outcomes o LEFT JOIN public."Driver" d ON d.provider=o.provider AND d."externalId"=o.external_driver GROUP BY o.kind,d.id
    UNION ALL SELECT 'noFare',CASE WHEN coalesce(d.id,d2.id) IS NULL THEN 'Unattributed' ELSE 'Driver '||coalesce(nullif(d."badgeNumber",''),nullif(d2."badgeNumber",''),d.callsign,d2.callsign,d."externalId",d2."externalId") END,coalesce(d.id,d2.id),count(*)::int FROM selected b LEFT JOIN public."Driver" d ON d.id=b."driverId" AND d.provider=b.provider LEFT JOIN public."Driver" d2 ON d.id IS NULL AND d2."externalId"=b."driverId" AND d2.provider=b.provider WHERE b.status='NO_FARE' GROUP BY d.id,d2.id
   ), ranked AS (SELECT *,row_number() OVER(PARTITION BY kind ORDER BY count DESC,label) position FROM grouped)
   SELECT kind,label,count FROM ranked WHERE position<=10 OR driver IS NULL`);
        for (const r of rows) {
          if (r.label === "Unattributed") rankings.unattributed += r.count;
          else rankings[r.kind].push({ label: r.label, count: r.count });
        }
      }
      const hours = Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: 0,
        })),
        weekdays = Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          count: 0,
        }));
      const days = new Map<string, number>(),
        revenueTrend = new Map<
          string,
          { date: string; gross: number; driverMoney: number }
        >();
      for (
        let day = startOfLondonDay(range.from);
        day < range.to;
        day = addLondonDays(day, 1)
      ) {
        const key = dayKey(day);
        days.set(key, 0);
        revenueTrend.set(key, { date: key, gross: 0, driverMoney: 0 });
      }
      const heat = new Map<
        string,
        { day: number; hour: number; count: number }
      >();
      for (const r of timeRows) {
        hours[r.hour].count += r.count;
        weekdays[r.weekday - 1].count += r.count;
        days.set(r.day, (days.get(r.day) || 0) + r.count);
        const revenue = revenueTrend.get(r.day)!;
        revenue.gross += Number(r.gross);
        revenue.driverMoney += Number(r.driverMoney);
        const key = r.weekday + ":" + r.hour;
        const h = heat.get(key) || { day: r.weekday, hour: r.hour, count: 0 };
        h.count += r.count;
        heat.set(key, h);
      }
      return {
        generatedAt: new Date().toISOString(),
        comparison: { ...comparison, gross: Number(comparison.gross), from: previous.from.toISOString(), to: previous.to.toISOString() },
        range: {
          ...range,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
        totals: totals(total),
        areas: areaRows.map(
          (r) =>
            ({
              ...totals(r),
              key: String(r.key),
              name: String(r.name),
              latitude: r.latitude === null ? null : Number(r.latitude),
              longitude: r.longitude === null ? null : Number(r.longitude),
            }) as Area,
        ),
        revenueTrend: Array.from(revenueTrend.values()),
        hours,
        days: Array.from(days, ([date, count]) => ({ date, count })),
        weekdays,
        heat: Array.from(heat.values()),
        drivers: rankings,
        rent: rentEstimate(
          rentRows.map((r) => ({ ...r, earnings: Number(r.earnings) })),
          configuration ? Number(configuration.rentPercentage) : null,
          configuration ? Number(configuration.weeklyCap) : null,
        ),
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 55000, maxWait: 3000 },
  );
}
