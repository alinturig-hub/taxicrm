import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../src/lib/prisma";
import { todayBusinessSummary } from "../../src/lib/today/business-day";

if (
  process.env.TAXICRM_SYNTHETIC_TESTS !== "1" ||
  process.env.DATABASE_URL !== "postgresql://taxicrm@127.0.0.1:5432/taxicrm"
)
  throw new Error("Isolated synthetic database required");
const prefix = `synthetic-today-${randomUUID()}`;
const now = new Date("2026-10-24T12:00:00Z");

test("Today isolates London event dates, preserves revenue rules and reports missing values", async () => {
  const before = await todayBusinessSummary(() => true, now);
  try {
    const rows = [
      {
        externalId: `${prefix}-yesterday`,
        status: "COMPLETED",
        completedAt: new Date("2026-10-23T11:00:00Z"),
        price: 17,
      },
      {
        externalId: `${prefix}-yesterday-later`,
        status: "COMPLETED",
        completedAt: new Date("2026-10-23T14:00:00Z"),
        price: 900,
      },
      {
        externalId: `${prefix}-complete`,
        status: "COMPLETED",
        completedAt: new Date("2026-10-23T23:30:00Z"),
        price: 12,
        cost: 8,
      },
      {
        externalId: `${prefix}-old`,
        status: "COMPLETED",
        completedAt: new Date("2026-10-23T22:59:59Z"),
        price: 900,
      },
      {
        externalId: `${prefix}-future`,
        status: "COMPLETED",
        completedAt: new Date("2026-10-24T20:00:00Z"),
        price: 900,
      },
      {
        externalId: `${prefix}-missing`,
        status: "COMPLETED",
        completedAt: now,
      },
      {
        externalId: `${prefix}-no-fare`,
        status: "NO_FARE",
        noFareAt: now,
        arrivedAt: new Date("2026-10-24T11:50:00Z"),
        accountId: prefix,
        price: 5,
      },
      {
        externalId: `${prefix}-scheduled`,
        bookedAtTime: now,
        pickupDueTime: new Date("2026-10-24T20:00:00Z"),
      },
      {
        externalId: `${prefix}-tomorrow`,
        bookedAtTime: now,
        pickupDueTime: new Date("2026-10-24T23:30:00Z"),
      },
    ];
    await prisma.accountRevenueRule.create({
      data: {
        provider: "AUTOCAB",
        accountId: prefix,
        accountCode: prefix,
        waitingChargeable: true,
        waitingRatePerMinute: 1,
      },
    });
    await prisma.booking.createMany({
      data: rows.map((row) => ({ ...row, rawPayload: { synthetic: true } })),
    });
    const after = await todayBusinessSummary(() => true, now);
    assert.equal(after.yesterday.revenue! - before.yesterday.revenue!, 17);
    assert.equal(after.profit, null);
    assert.equal(after.revenue! - before.revenue!, 27);
    assert.equal(after.missingAmounts - before.missingAmounts, 1);
    assert.equal(after.completed! - before.completed!, 2);
    assert.equal(after.booked! - before.booked!, 2);
    assert.equal(after.pickups! - before.pickups!, 1);
    const hidden = await todayBusinessSummary(() => false, now);
    for (const key of [
      "booked",
      "pickups",
      "completed",
      "cancelled",
      "failed",
      "revenue",
    ] as const) {
      assert.equal(hidden[key], null);
      assert.equal(hidden.yesterday[key], null);
    }
  } finally {
    await prisma.booking.deleteMany({
      where: { externalId: { startsWith: prefix } },
    });
    await prisma.accountRevenueRule.deleteMany({
      where: { accountId: prefix },
    });
    await prisma.$disconnect();
  }
});
