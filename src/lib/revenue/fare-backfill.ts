import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { normaliseDecimal } from "@/lib/autocab/booking-mappers";

export function originalFare(value: unknown) {
  // Accept only provider-supplied numeric values representable by Decimal(12,2).
  const fare = normaliseDecimal(value);
  if (!fare || !fare.isFinite() || fare.abs().gte("10000000000")) return null;
  return fare;
}

export async function backfillOriginalFares(options: {
  limit: number;
  afterId?: string;
  dryRun: boolean;
}) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; updatedAt: Date; originalFare: unknown }>
  >(Prisma.sql`
    SELECT id, "updatedAt",
      CASE WHEN ("rawPayload"->'Pricing') ? 'Fare'
        THEN "rawPayload"->'Pricing'->'Fare'
        ELSE "rawPayload"->'Pricing'->'fare' END AS "originalFare"
    FROM "Booking"
    WHERE provider = 'AUTOCAB' AND fare IS NULL
      ${options.afterId ? Prisma.sql`AND id > ${options.afterId}` : Prisma.empty}
    ORDER BY id LIMIT ${options.limit}`);
  let candidates = 0,
    updated = 0,
    noSource = 0,
    invalidSource = 0,
    concurrentChanges = 0;
  for (const row of rows) {
    if (row.originalFare === null || row.originalFare === undefined) {
      noSource++;
      continue;
    }
    const fare = originalFare(row.originalFare);
    if (!fare) {
      invalidSource++;
      continue;
    }
    candidates++;
    if (!options.dryRun) {
      const changed = await prisma.booking.updateMany({
        where: { id: row.id, fare: null, updatedAt: row.updatedAt },
        data: { fare },
      });
      updated += changed.count;
      if (!changed.count) concurrentChanges++;
    }
  }
  const nextCursor = rows.at(-1)?.id ?? options.afterId ?? null;
  const hasMore = Boolean(
    nextCursor &&
      (await prisma.booking.findFirst({
        where: { provider: "AUTOCAB", fare: null, id: { gt: nextCursor } },
        select: { id: true },
      })),
  );
  return {
    selected: rows.length,
    candidates,
    updated,
    noSource,
    invalidSource,
    concurrentChanges,
    nextCursor,
    hasMore,
    dryRun: options.dryRun,
  };
}

export async function backfillCachedPlaces(options: {
  limit: number;
  afterId?: string;
  dryRun: boolean;
}) {
  const { placeLocationKey } = await import(
    "@/lib/places/geoapify-place-enrichment"
  );
  const rows = await prisma.bookingLocation.findMany({
    where: {
      placeIntelligenceId: null,
      type: { in: ["PICKUP", "DESTINATION"] },
      latitude: { not: null },
      longitude: { not: null },
      ...(options.afterId ? { id: { gt: options.afterId } } : {}),
    },
    orderBy: { id: "asc" },
    take: options.limit,
    select: { id: true, latitude: true, longitude: true },
  });
  const keys = rows.map((row) =>
    placeLocationKey(Number(row.latitude), Number(row.longitude)),
  );
  const cached = await prisma.placeIntelligence.findMany({
    where: {
      locationKey: { in: Array.from(new Set(keys)) },
      status: { in: ["READY", "NOT_FOUND"] },
    },
    select: { id: true, locationKey: true },
  });
  const byKey = new Map(cached.map((place) => [place.locationKey, place.id]));
  let candidates = 0,
    updated = 0;
  for (let i = 0; i < rows.length; i++) {
    const placeId = byKey.get(keys[i]);
    if (!placeId) continue;
    candidates++;
    if (!options.dryRun)
      updated += (
        await prisma.bookingLocation.updateMany({
          where: {
            id: rows[i].id,
            placeIntelligenceId: null,
            latitude: rows[i].latitude,
            longitude: rows[i].longitude,
          },
          data: { placeIntelligenceId: placeId },
        })
      ).count;
  }
  const nextCursor = rows.at(-1)?.id ?? options.afterId ?? null;
  const hasMore = Boolean(
    nextCursor &&
      (await prisma.bookingLocation.findFirst({
        where: {
          id: { gt: nextCursor },
          placeIntelligenceId: null,
          type: { in: ["PICKUP", "DESTINATION"] },
          latitude: { not: null },
          longitude: { not: null },
        },
        select: { id: true },
      })),
  );
  return {
    selected: rows.length,
    candidates,
    updated,
    noCache: rows.length - candidates,
    nextCursor,
    hasMore,
    dryRun: options.dryRun,
    externalCalls: 0,
  };
}
