import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { parseRange } from "@/lib/analytics/explorer/model";
import { getAnalytics } from "@/lib/analytics/explorer/query";
assert.equal(
  process.env.DATABASE_URL,
  "postgresql://analytics_test@127.0.0.1:55438/analytics_synthetic",
);
test("SQL analytics preserves monetary facts, avoids join/recovery duplicates, isolates providers and attributes only explicit drivers", async () => {
  const identity = await prisma.$queryRaw<
    { db: string; role: string }[]
  >`SELECT current_database() db,current_user role`;
  assert.deepEqual(identity, [
    { db: "analytics_synthetic", role: "analytics_test" },
  ]);
  const provider = "SYNTHETIC_ANALYTICS";
  try {
    await prisma.zone.create({
      data: {
        provider,
        externalId: "Z",
        companyId: 1,
        name: "Synthetic West",
        latitude: 50.4,
        longitude: -4.1,
      },
    });
    await prisma.zone.create({
      data: {
        provider: "SYNTHETIC_OTHER",
        externalId: "Z",
        companyId: 1,
        name: "Other namespace",
      },
    });
    await prisma.driver.create({
      data: { provider, externalId: "DX", badgeNumber: "TEST-X" },
    });
    const later = await prisma.driver.create({
      data: { provider, externalId: "DY", badgeNumber: "TEST-Y" },
    });
    const make = async (
      ref: string,
      status: string,
      price: number | null,
      cost: number | null,
      paymentType: string,
      time: string,
      zone = true,
    ) =>
      prisma.booking.create({
        data: {
          provider,
          externalId: ref,
          status,
          price,
          cost,
          paymentType,
          pickupDueTime: new Date(time),
          bookedAtTime: new Date("2026-10-24T12:00Z"),
          completedAt: status === "COMPLETED" ? new Date(time) : null,
          driverId: later.id,
          rawPayload: { synthetic: true, loyalty: "preserved" },
          ...(zone
            ? {
                locations: {
                  create: {
                    type: "PICKUP",
                    address: "Synthetic location",
                    zoneId: "Z",
                  },
                },
              }
            : {}),
        },
      });
    const a = await make(
      "A",
      "COMPLETED",
      17.1,
      19,
      "Cash",
      "2026-10-25T00:30Z",
    );
    await make("B", "COMPLETED", 50, 45, "Account", "2026-10-25T01:30Z");
    await make("C", "NO_FARE", 100, 90, "Card", "2026-10-25T02:30Z");
    await make("D", "CANCELLED", 500, 400, "Cash", "2026-10-25T03:30Z");
    await make(
      "E",
      "COMPLETED",
      null,
      3,
      "Credit Card",
      "2026-10-25T04:30Z",
      false,
    );
    await make("Boundary", "COMPLETED", 1000, 900, "Cash", "2026-10-26T00:00Z");
    await make(
      "Mixed",
      "COMPLETED",
      12,
      10,
      "CASH / CARD",
      "2026-10-25T05:30Z",
      false,
    );
    await make("Zero", "COMPLETED", 0, 0, "", "2026-10-25T06:30Z", false);
    for (const [id, type, driver] of [
      ["r1", "BookingRecovered", "DX"],
      ["r2", "BookingRecovered", "DX"],
      ["j1", "BookingRejected", "DX"],
      ["j2", "BookingRejected", null],
    ] as const)
      await prisma.webhookEvent.create({
        data: {
          provider,
          eventType: type,
          externalBookingId: "A",
          bookingId: a.id,
          idempotencyKey: "synthetic-analytics-" + id,
          status: "PROCESSED",
          payload: driver ? { Driver: { Id: driver } } : {},
          receivedAt: new Date("2026-10-25T01:00Z"),
        },
      });
    const before = await prisma.booking.findMany({
      where: { provider },
      orderBy: { externalId: "asc" },
    });
    const r = parseRange(
      new URLSearchParams({
        preset: "custom",
        from: "2026-10-25",
        to: "2026-10-25",
      }),
    );
    const data = await getAnalytics(r, true);
    assert.equal(data.totals.total, 7);
    assert.equal(data.totals.completed, 5);
    assert.equal(data.totals.gross, 79.1);
    assert.equal(data.totals.driverMoney, 77);
    assert.equal(data.totals.margin, null);
    assert.equal(data.totals.missingPrice, 1);
    assert.equal(data.totals.other, 2);
    assert.equal(data.totals.otherIncome, 12);
    assert.equal(data.totals.recovered, 1);
    assert.equal(data.totals.unknownArea, 3);
    assert.equal(data.hours[1].count, 2);
    assert.equal(data.areas.find((x) => x.name === "Synthetic West")?.total, 4);
    assert.equal(data.drivers.rejected[0].label, "Driver TEST-X");
    assert.equal(data.drivers.recovered[0].count, 1);
    assert.equal(data.drivers.unattributed, 1);
    assert.equal(data.rent.estimated, null);
    const cash = await getAnalytics({ ...r, payment: "CASH" }, false);
    assert.equal(cash.totals.total, 2);
    assert.equal(cash.totals.gross, 17.1);
    assert.equal(cash.totals.margin, -1.9);
    assert.deepEqual(cash.drivers.rejected, []);
    assert.equal(
      await prisma.driverRentConfiguration.count(),
      0,
      "read-only report must not create default rent rates",
    );
    assert.deepEqual(
      await prisma.booking.findMany({
        where: { provider },
        orderBy: { externalId: "asc" },
      }),
      before,
    );
  } finally {
    await prisma.webhookEvent.deleteMany({ where: { provider } });
    await prisma.booking.deleteMany({ where: { provider } });
    await prisma.driver.deleteMany({ where: { provider } });
    await prisma.zone.deleteMany({
      where: { provider: { in: [provider, "SYNTHETIC_OTHER"] } },
    });
    await prisma.$disconnect();
  }
});
