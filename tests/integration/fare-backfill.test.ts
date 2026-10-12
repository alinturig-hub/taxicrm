import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../src/lib/prisma";
import {
  backfillOriginalFares,
  backfillCachedPlaces,
  originalFare,
} from "../../src/lib/revenue/fare-backfill";
if (
  process.env.TAXICRM_SYNTHETIC_TESTS !== "1" ||
  process.env.DATABASE_URL !== "postgresql://taxicrm@127.0.0.1:5432/taxicrm"
)
  throw new Error("Isolated database required");
const prefix = `zz-fare-${randomUUID()}`;
test("original Fare only: zero, null, missing, invalid, provider isolation and preserved payload", async () => {
  try {
    const fixtures = [
      { key: "a", rawPayload: { Pricing: { Fare: 0, Price: 20 } } },
      { key: "b", rawPayload: { Pricing: { fare: "12.50", Cost: 8 } } },
      { key: "c", rawPayload: { Pricing: { Price: 50 } } },
      { key: "d", rawPayload: { Pricing: { Fare: null, fare: 30 } } },
      { key: "e", rawPayload: { Pricing: { Fare: "bad" } } },
      { key: "f", rawPayload: { Pricing: { Fare: 55 } }, fare: 9 },
      { key: "g", rawPayload: { Pricing: { Fare: 55 } }, provider: "LOCAL" },
    ];
    for (const { key, ...data } of fixtures)
      await prisma.booking.create({
        data: {
          ...data,
          id: `${prefix}-${key}`,
          externalId: `${prefix}-${key}`,
          price: 100,
        },
      });
    const place = await prisma.placeIntelligence.create({
      data: {
        locationKey: `${prefix}:cache`,
        latitude: 50.1,
        longitude: -4.2,
        originalAddress: prefix,
        status: "NOT_FOUND",
      },
    });
    await prisma.placeIntelligence.update({
      where: { id: place.id },
      data: { locationKey: "50.12345:-4.23456" },
    });
    await prisma.bookingLocation.create({
      data: {
        id: `${prefix}-location`,
        bookingId: `${prefix}-a`,
        type: "PICKUP",
        address: prefix,
        latitude: 50.12345,
        longitude: -4.23456,
      },
    });
    const originalFetch = global.fetch;
    global.fetch = async () => {
      throw new Error("External calls forbidden");
    };
    try {
      const previewCache = await backfillCachedPlaces({
        afterId: prefix,
        limit: 1,
        dryRun: true,
      });
      assert.equal(previewCache.candidates, 1);
      assert.equal(previewCache.updated, 0);
      const cache = await backfillCachedPlaces({
        afterId: prefix,
        limit: 1,
        dryRun: false,
      });
      assert.equal(cache.updated, 1);
      assert.equal(cache.externalCalls, 0);
      assert.equal(
        (
          await prisma.bookingLocation.findUniqueOrThrow({
            where: { id: `${prefix}-location` },
          })
        ).placeIntelligenceId,
        place.id,
      );
    } finally {
      global.fetch = originalFetch;
    }
    const preview = await backfillOriginalFares({
      afterId: prefix,
      limit: 5,
      dryRun: true,
    });
    assert.equal(preview.candidates, 2);
    assert.equal(preview.updated, 0);
    assert.equal(
      await prisma.booking.count({
        where: { id: { startsWith: prefix }, fare: null },
      }),
      6,
    );
    const applied = await backfillOriginalFares({
      afterId: prefix,
      limit: 5,
      dryRun: false,
    });
    assert.equal(applied.updated, 2);
    assert.equal(applied.noSource, 2);
    assert.equal(applied.invalidSource, 1);
    for (const fixture of fixtures) {
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: `${prefix}-${fixture.key}` },
      });
      assert.deepEqual(row.rawPayload, fixture.rawPayload);
      assert.equal(Number(row.price), 100);
      const expected =
        fixture.key === "a"
          ? 0
          : fixture.key === "b"
            ? 12.5
            : fixture.key === "f"
              ? 9
              : null;
      assert.equal(row.fare === null ? null : Number(row.fare), expected);
    }
    assert.equal(
      (
        await backfillOriginalFares({
          afterId: prefix,
          limit: 5,
          dryRun: false,
        })
      ).updated,
      0,
    );
    assert.equal(originalFare("NaN"), null);
    assert.equal(originalFare("Infinity"), null);
    assert.equal(originalFare("10000000000"), null);
  } finally {
    await prisma.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.placeIntelligence.deleteMany({
      where: { originalAddress: prefix },
    });
    await prisma.$disconnect();
  }
});
