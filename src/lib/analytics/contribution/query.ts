import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Range } from "../explorer/model";
import { contributionReport, type ContributionRow } from "./model";
export async function getContribution(range: Range, database = prisma) {
  if (range.calendarDays > 31) throw Error("Choose at most 31 London calendar days.");
  return database.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='12s'");
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'");
    await tx.$executeRawUnsafe("SET LOCAL work_mem='8MB'");
    await tx.$executeRawUnsafe("SET LOCAL jit=off");
    await tx.$executeRawUnsafe("SET LOCAL max_parallel_workers_per_gather=0");
    const rows = await tx.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      WITH source AS (
        SELECT provider,price,cost,"accountName" account_name,
          CASE WHEN nullif(btrim("accountId"),'') IS NOT NULL THEN 'ACCOUNT' WHEN "normalCustomerId" IS NOT NULL THEN 'CUSTOMER' ELSE 'UNATTRIBUTED' END kind,
          CASE WHEN nullif(btrim("accountId"),'') IS NOT NULL THEN "accountId" ELSE coalesce("normalCustomerId",'') END id,
          CASE WHEN ((upper(coalesce("paymentType",'')) LIKE '%ACCOUNT%')::int+(upper(coalesce("paymentType",'')) LIKE '%CASH%')::int+(upper(coalesce("paymentType",'')) ~ '(CARD|CREDIT|DEBIT)')::int)>1 THEN 'OTHER'
            WHEN upper(coalesce("paymentType",'')) LIKE '%ACCOUNT%' THEN 'ACCOUNT' WHEN upper(coalesce("paymentType",'')) LIKE '%CASH%' THEN 'CASH' WHEN upper(coalesce("paymentType",'')) ~ '(CARD|CREDIT|DEBIT)' THEN 'CARD' ELSE 'OTHER' END pay
        FROM public."Booking" WHERE status='COMPLETED' AND "pickupDueTime">=(${range.from.toISOString()}::timestamptz AT TIME ZONE 'UTC') AND "pickupDueTime"<(${range.to.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      ) SELECT kind,provider,id,
        CASE WHEN kind='CUSTOMER' THEN (SELECT left(n."displayName",120) FROM public."NormalCustomer" n WHERE n.id=source.id) ELSE left(min(nullif(btrim(account_name),'')),120) END label,
        count(*)::int completed,count(*) FILTER(WHERE price IS NULL)::int "missingPrice",count(*) FILTER(WHERE cost IS NULL)::int "missingCost",
        coalesce(sum(round(price::numeric*100)),0)::text "grossPence",coalesce(sum(round(cost::numeric*100)),0)::text "costPence",
        CASE WHEN count(*) FILTER(WHERE price IS NULL OR cost IS NULL)>0 THEN NULL ELSE coalesce(sum(round(price::numeric*100)-round(cost::numeric*100)),0)::text END "marginPence"
      FROM source WHERE ${range.payment}='ALL' OR pay=${range.payment} GROUP BY kind,provider,id ORDER BY kind,provider,id LIMIT 50001`);
    if (rows.length > 50000) throw Error("Too many contributors; narrow the date range.");
    const mapped = rows.map(r => { const result = { ...r } as unknown as ContributionRow; for (const key of ["completed", "missingPrice", "missingCost", "grossPence", "costPence", "marginPence"] as const) { const v = r[key] === null ? null : Number(r[key]); if (v !== null && !Number.isSafeInteger(v)) throw Error("Unsafe aggregate amount"); (result as Record<string, unknown>)[key] = v; } return result; });
    for (const key of ["completed", "grossPence", "costPence", "marginPence"] as const) {
      const magnitude = mapped.reduce((n, row) => n + BigInt(Math.abs(row[key] ?? 0)), BigInt(0));
      if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Unsafe aggregate total");
    }
    return { ...contributionReport(mapped), range: { ...range, from: range.from.toISOString(), to: range.to.toISOString() }, generatedAt: new Date().toISOString() };
  }, { isolationLevel: "RepeatableRead", timeout: 20000, maxWait: 3000 });
}
