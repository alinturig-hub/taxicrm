import { Prisma } from "@/generated/prisma/client";
import { bookingEvidenceReadiness } from "./readiness";
import { bookingTimeSql } from "./booking-evidence";
import { prisma } from "@/lib/prisma";

export function normaliseFreephoneNumber(value: string) {
  if (typeof value !== "string" || !/^[+\d\s().-]+$/.test(value))
    throw new Error("Invalid UK freephone line number.");
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0044")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("44")) digits = "0" + digits.slice(2);
  if (!/^0[1-9]\d{9}$/.test(digits))
    throw new Error("Invalid UK freephone line number.");
  return digits;
}
export function telephoneSql() {
  const digits = Prisma.sql`regexp_replace(coalesce(nullif(btrim("telephoneNumber"), ''), "rawPayload"->>'TelephoneNumber', ''), '[^0-9]', '', 'g')`;
  return Prisma.sql`CASE WHEN ${digits} LIKE '0044%' THEN '0' || substring(${digits} FROM 5) WHEN ${digits} LIKE '44%' THEN '0' || substring(${digits} FROM 3) ELSE ${digits} END`;
}
export async function auditFreephoneNumbers(values: unknown, now = new Date()) {
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.length > 25 ||
    values.some((v) => typeof v !== "string")
  )
    throw new Error("Supply between 1 and 25 UK freephone line numbers.");
  const numbers = Array.from(new Set(values.map(normaliseFreephoneNumber)));
  const wanted = Prisma.join(
    numbers.map((phone, i) => Prisma.sql`(${phone}, ${i}::integer)`),
  );
  const from = new Date(now.getTime() - 86400000);
  const rows = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '20s'`;
      return tx.$queryRaw<
        {
          phone: string;
          total: bigint;
          last24h: bigint;
          missingDate: bigint;
          missingSource: bigint;
          payloadDateUsed: bigint;
          last12h: bigint;
          futureDates: bigint;
          lastBookedAt: Date | null;
          samples: unknown;
        }[]
      >(Prisma.sql`
      WITH coverage AS (SELECT count(*) AS "missingSource" FROM "Booking" WHERE provider = 'AUTOCAB' AND ${telephoneSql()} = '' AND ${bookingTimeSql()} > ${new Date(now.getTime() - 12 * 3600000)} AND ${bookingTimeSql()} <= ${now}), wanted(phone, position) AS (VALUES ${wanted}), matched AS MATERIALIZED (
        SELECT w.phone, b."externalId", b.status, ${bookingTimeSql()} AS "bookedAtTime", (b."bookedAtTime" IS NULL AND ${bookingTimeSql()} IS NOT NULL) AS "payloadDateUsed", b."pickupDueTime", b."bookingSource", b."createdAt"
        FROM "Booking" b JOIN wanted w ON ${telephoneSql()} = w.phone WHERE b.provider = 'AUTOCAB'
      ), totals AS (
        SELECT phone, count(*) AS total,
          count(*) FILTER (WHERE "bookedAtTime" > ${from} AND "bookedAtTime" <= ${now}) AS "last24h",
          count(*) FILTER (WHERE "bookedAtTime" IS NULL) AS "missingDate",
          count(*) FILTER (WHERE "payloadDateUsed") AS "payloadDateUsed",
          count(*) FILTER (WHERE "bookedAtTime" > ${new Date(now.getTime() - 12 * 3600000)} AND "bookedAtTime" <= ${now}) AS "last12h",
          count(*) FILTER (WHERE "bookedAtTime" > ${now}) AS "futureDates", max("bookedAtTime") AS "lastBookedAt"
        FROM matched GROUP BY phone
      ), ranked AS (
        SELECT *, row_number() OVER (PARTITION BY phone ORDER BY coalesce("bookedAtTime", "pickupDueTime", "createdAt") DESC, "externalId") AS rank FROM matched
      ), samples AS (
        SELECT phone, jsonb_agg(jsonb_build_object('bookingId', "externalId", 'status', status, 'bookedAt', "bookedAtTime" AT TIME ZONE 'UTC', 'pickupDueTime', "pickupDueTime" AT TIME ZONE 'UTC', 'bookingSource', "bookingSource") ORDER BY rank) AS data FROM ranked WHERE rank <= 3 GROUP BY phone
      ) SELECT w.phone, coalesce(t.total,0) AS total, coalesce(t."last24h",0) AS "last24h", coalesce(t."missingDate",0) AS "missingDate", coalesce(t."payloadDateUsed",0) AS "payloadDateUsed", coalesce(t."last12h",0) AS "last12h", coalesce(t."futureDates",0) AS "futureDates", t."lastBookedAt", coverage."missingSource", coalesce(s.data,'[]'::jsonb) AS samples
      FROM wanted w LEFT JOIN totals t USING (phone) LEFT JOIN samples s USING (phone) CROSS JOIN coverage ORDER BY w.position`);
    },
    { timeout: 25000 },
  );
  return {
    field: "TelephoneNumber",
    from: from.toISOString(),
    through: now.toISOString(),
    rows: rows.map((r) => ({
      ...r,
      total: Number(r.total),
      last24h: Number(r.last24h),
      missingDate: Number(r.missingDate),
      missingSource: Number(r.missingSource),
      readiness: bookingEvidenceReadiness({
        known: Number(r.total),
        missingDate: Number(r.missingDate),
        missingSource: Number(r.missingSource),
        futureDates: Number(r.futureDates),
      }),
      payloadDateUsed: Number(r.payloadDateUsed),
      last12h: Number(r.last12h),
      futureDates: Number(r.futureDates),
    })),
  };
}
