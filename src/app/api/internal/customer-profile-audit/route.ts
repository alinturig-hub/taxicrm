import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCustomerBehaviourTags } from "@/lib/customers/sync-customer-behaviour-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function authorized(request: NextRequest) {
  return Boolean(process.env.CRON_SECRET && request.headers.get("x-cron-secret") === process.env.CRON_SECRET);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const now = new Date();
  const since = new Date(now.getTime() - 14 * 86_400_000);
  try {
    const [bookings, customerCohorts, tags, locationCount, placeCount, categorizedSafePlaces, statusCounts] = await Promise.all([
      prisma.$queryRaw<Array<Record<string, number>> >`
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE "normalCustomerId" IS NOT NULL)::int AS linked,
          count(*) FILTER (WHERE "normalCustomerId" IS NULL)::int AS unlinked,
          count(*) FILTER (WHERE coalesce("pickupDueTime", "bookedAtTime") BETWEEN ${since} AND ${now})::int AS recent,
          count(*) FILTER (WHERE "normalCustomerId" IS NOT NULL AND coalesce("pickupDueTime", "bookedAtTime") BETWEEN ${since} AND ${now})::int AS recent_linked,
          count(*) FILTER (WHERE "status" = 'COMPLETED' AND "normalCustomerId" IS NOT NULL AND coalesce("pickupDueTime", "bookedAtTime") BETWEEN ${since} AND ${now})::int AS recent_linked_completed,
          count(*) FILTER (WHERE "normalCustomerId" IS NOT NULL AND "bookedAtTime" IS NOT NULL AND "pickupDueTime" IS NOT NULL AND "pickupDueTime" >= "bookedAtTime" AND "pickupDueTime" BETWEEN ${since} AND ${now})::int AS recent_valid_lead
        FROM "Booking"`,
      prisma.$queryRaw<Array<Record<string, number>> >`
        WITH counts AS (
          SELECT c.id, count(b.id)::int AS total,
            count(b.id) FILTER (WHERE coalesce(b."pickupDueTime", b."bookedAtTime") BETWEEN ${since} AND ${now})::int AS recent
          FROM "NormalCustomer" c LEFT JOIN "Booking" b ON b."normalCustomerId" = c.id
          GROUP BY c.id
        )
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE total = 0)::int AS no_bookings,
          count(*) FILTER (WHERE total = 1)::int AS one_booking,
          count(*) FILTER (WHERE total >= 2)::int AS repeat_customers,
          count(*) FILTER (WHERE recent > 0)::int AS recent_customers,
          count(*) FILTER (WHERE recent >= 3)::int AS recent_3_plus,
          count(*) FILTER (WHERE recent >= 6)::int AS recent_6_plus,
          count(*) FILTER (WHERE recent >= 12)::int AS recent_12_plus
        FROM counts`,
      prisma.$queryRaw<Array<{ tagId: string; active: boolean; customers: number }>>`
        SELECT "tagId", active, count(*)::int AS customers FROM "CustomerBehaviourTag"
        GROUP BY "tagId", active ORDER BY "tagId", active`,
      prisma.bookingLocation.count(),
      prisma.placeIntelligence.count(),
      prisma.placeIntelligence.count({ where: { poiCategoryStatus: "READY", isSensitive: false } }),
      prisma.booking.groupBy({ by: ["status"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 30 }),
    ]);
    return NextResponse.json({ now: now.toISOString(), windowStart: since.toISOString(), bookings: bookings[0], customerCohorts: customerCohorts[0], tags, locationCoverage: { locations: locationCount, places: placeCount, categorizedSafePlaces }, statusCounts: statusCounts.map((row) => ({ status: row.status, count: row._count.id })), containsPersonalData: false });
  } catch (error) {
    console.error("Customer profile audit failed", error);
    return NextResponse.json({ error: "AUDIT_FAILED" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      (body.afterId !== undefined && (typeof body.afterId !== "string" || !body.afterId.trim())) ||
      (body.limit !== undefined && (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 200)) ||
      (body.dryRun !== undefined && typeof body.dryRun !== "boolean") ||
      (body.now !== undefined && (typeof body.now !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(body.now) || !Number.isFinite(Date.parse(body.now))))) {
    return NextResponse.json({ error: "INVALID_BATCH_OPTIONS" }, { status: 400 });
  }
  try {
    const result = await syncCustomerBehaviourTags({ scope: "all", customerLimit: body.limit ?? 200, afterId: body.afterId, now: body.now ? new Date(body.now) : undefined, dryRun: body.dryRun !== false });
    return NextResponse.json({ success: result.failedCustomers === 0, ...result });
  } catch (error) {
    console.error("Customer profile batch failed", error);
    return NextResponse.json({ error: "BATCH_FAILED" }, { status: 500 });
  }
}
