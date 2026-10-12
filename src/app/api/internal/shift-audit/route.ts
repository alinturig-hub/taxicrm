import { driverPresence, fleetPresence } from "@/lib/operations/live-presence";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET,
    supplied = request.headers.get("x-cron-secret");
  if (
    !expected ||
    !supplied ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  ) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const now = new Date();
  const since24h = new Date(now.getTime() - 86400000);
  const since7d = new Date(now.getTime() - 7 * 86400000);
  const counts = await prisma.$queryRaw<
    Array<{
      openRows: number;
      distinctDrivers: number;
      startedOver24hAgo: number;
      startedOver7dAgo: number;
      rowsWithEndTimestamp: number;
      oldestStart: Date | null;
    }>
  >`
    SELECT count(*)::int AS "openRows", count(DISTINCT "driverId")::int AS "distinctDrivers",
      count(*) FILTER (WHERE "startedAt" < ${since24h})::int AS "startedOver24hAgo",
      count(*) FILTER (WHERE "startedAt" < ${since7d})::int AS "startedOver7dAgo",
      count(*) FILTER (WHERE "endedAt" IS NOT NULL)::int AS "rowsWithEndTimestamp",
      min("startedAt") AS "oldestStart"
    FROM "DriverShift" WHERE status = 'ACTIVE'`;
  const [latest, vehicles] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        driverId: string;
        vehicleId: string | null;
        status: string;
        startedAt: Date;
        endedAt: Date | null;
      }>
    >`
      SELECT DISTINCT ON ("driverId") "driverId", "vehicleId", status, "startedAt", "endedAt"
      FROM "DriverShift" WHERE "startedAt" <= ${now}
      ORDER BY "driverId", "startedAt" DESC, CASE WHEN status = 'ENDED' THEN 0 ELSE 1 END, id DESC`,
    prisma.vehicle.findMany({
      where: { lastSeenAt: { not: null } },
      select: {
        id: true,
        currentDriverId: true,
        currentStatus: true,
        lastSeenAt: true,
      },
    }),
  ]);
  const presence = driverPresence(latest, vehicles, now);
  const fleet = fleetPresence(vehicles, now);
  return NextResponse.json({
    checkedAt: now.toISOString(),
    ...counts[0],
    currentEvidence: { drivers: presence, fleet },
    containsPersonalData: false,
    definition:
      "Distinct drivers with stored ACTIVE shifts; this is not live presence.",
  });
}
