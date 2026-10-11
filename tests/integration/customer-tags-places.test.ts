import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { prisma } from "../../src/lib/prisma";
import { syncCustomerBehaviourTags } from "../../src/lib/customers/sync-customer-behaviour-tags";
import { enrichBookingLocation, placeLocationKey } from "../../src/lib/places/geoapify-place-enrichment";

if (process.env.TAXICRM_SYNTHETIC_TESTS !== "1" || process.env.DATABASE_URL !== "postgresql://taxicrm@127.0.0.1:5432/taxicrm") {
  throw new Error("Synthetic integration tests require the explicitly opted-in isolated loopback database");
}
const prefix = `zz-synthetic-${randomUUID()}`;
const now = new Date("2026-10-11T12:00:00Z");
const originalFetch = global.fetch;
before(() => { global.fetch = async () => { throw new Error("External calls are forbidden in synthetic tests"); }; });
after(async () => {
  global.fetch = originalFetch;
  await prisma.booking.deleteMany({where: {externalId: {startsWith: prefix}}});
  await prisma.normalCustomer.deleteMany({where: {id: {startsWith: prefix}}});
  await prisma.placeIntelligence.deleteMany({where: {originalAddress: {startsWith: prefix}}});
  await prisma.$disconnect();
});

test("all-customer tag batches include dormant customers, preview without writes, resume and deactivate stale tags", async () => {
  const active = `${prefix}-a`, dormant = `${prefix}-b`;
  for (const id of [active, dormant]) await prisma.normalCustomer.create({data: {id, telephoneNumber: id, normalizedTelephone: id}});
  for (let index = 0; index < 6; index++) {
    await prisma.booking.create({data: {rawPayload: {synthetic: true}, externalId: `${prefix}-tag-${index}`, normalCustomerId: active,
      status: "COMPLETED", bookedAtTime: new Date("2026-10-09T00:00:00Z"), pickupDueTime: new Date("2026-10-09T12:00:00Z")}});
  }
  // Future and old bookings must not inflate the existing 14-day evidence window.
  for (const [suffix, date] of [["future", "2026-12-01T12:00:00Z"], ["old", "2025-01-01T12:00:00Z"]]) {
    await prisma.booking.create({data: {rawPayload: {synthetic: true}, externalId: `${prefix}-${suffix}`, normalCustomerId: active,
      status: "COMPLETED", bookedAtTime: new Date(date), pickupDueTime: new Date(date)}});
  }
  const preview = await syncCustomerBehaviourTags({scope: "all", afterId: prefix, customerLimit: 1, now, dryRun: true});
  assert.equal(preview.customersProcessed, 1); assert.equal(preview.hasMore, true); assert.equal(preview.nextCursor, active);
  assert.ok(preview.activeTags > 0);
  assert.equal(await prisma.customerBehaviourTag.count({where: {normalCustomerId: active}}), 0);
  const applied = await syncCustomerBehaviourTags({scope: "all", afterId: prefix, customerLimit: 1, now});
  assert.equal(applied.failedCustomers, 0);
  const tag = await prisma.customerBehaviourTag.findUniqueOrThrow({where: {normalCustomerId_tagId: {normalCustomerId: active, tagId: "ADVANCE_BOOKER"}}});
  assert.equal(tag.evidenceCount, 6); assert.equal(tag.eligibleCount, 6); assert.equal(tag.active, true);
  const repeated = await syncCustomerBehaviourTags({scope: "all", afterId: prefix, customerLimit: 1, now});
  assert.equal(repeated.tagsCreated, 0); assert.equal(repeated.activeTags, applied.activeTags);
  // A failure after deactivating stale tags must roll back the whole customer.
  await prisma.customerBehaviourTag.create({data: {normalCustomerId: active, tagId: "SYNTHETIC_STALE", label: "Synthetic stale", category: "BOOKING", confidence: "EMERGING", evidenceCount: 1, eligibleCount: 1, percentage: 100, windowStartAt: now, windowEndAt: now, explanation: "Synthetic rollback fixture"}});
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = new Proxy(originalTransaction, {apply(target, thisArg, args) {
    return Reflect.apply(target, thisArg, [async (tx: Parameters<Parameters<typeof originalTransaction>[0]>[0]) => args[0](new Proxy(tx, {
      get(transaction, key) {
        if (key !== "customerBehaviourTag") return Reflect.get(transaction, key);
        return new Proxy(transaction.customerBehaviourTag, {get(delegate, method) {
          if (method === "upsert") return async () => { throw new Error("Synthetic tag write failure"); };
          return Reflect.get(delegate, method);
        }});
      },
    }))]);
  }});
  try {
    const failed = await syncCustomerBehaviourTags({scope: "all", afterId: prefix, customerLimit: 1, now});
    assert.equal(failed.failedCustomers, 1); assert.deepEqual(failed.failedCustomerIds, [active]);
    assert.equal(failed.tagsUpdated, 0);
  } finally { prisma.$transaction = originalTransaction; }
  assert.equal(await prisma.customerBehaviourTag.count({where: {normalCustomerId: active, active: true}}), repeated.activeTags + 1);
  const remaining = await syncCustomerBehaviourTags({scope: "all", afterId: applied.nextCursor!, customerLimit: 1, now});
  assert.equal(remaining.customersProcessed, 1); assert.equal(remaining.nextCursor, dormant); assert.equal(remaining.hasMore, false);
  await syncCustomerBehaviourTags({scope: "all", afterId: prefix, customerLimit: 1, now: new Date("2026-11-01T12:00:00Z")});
  assert.equal(await prisma.customerBehaviourTag.count({where: {normalCustomerId: active, active: true}}), 0);
  await assert.rejects(syncCustomerBehaviourTags({scope: "all", customerLimit: NaN}), /batch limit/);
});

test("repeated pickup and destination reuse READY and NOT_FOUND cache without credentials or API credits", async () => {
  for (const [index, status] of Array.from(["READY", "NOT_FOUND"].entries())) {
    const lat = 50.10001 + index / 100, lon = -4.20001;
    const place = await prisma.placeIntelligence.create({data: {locationKey: placeLocationKey(lat, lon), latitude: lat, longitude: lon,
      originalAddress: `${prefix}-${status}`, status}});
    const booking = await prisma.booking.create({data: {rawPayload: {synthetic: true}, externalId: `${prefix}-place-${index}`}});
    const locationIds: string[] = [];
    for (const type of ["PICKUP", "DESTINATION"] as const) {
      const location = await prisma.bookingLocation.create({data: {bookingId: booking.id, type, address: `${prefix}-${type}`, latitude: lat, longitude: lon}});
      locationIds.push(location.id);
    }
    const originalFind = prisma.placeIntelligence.findUnique;
    let cacheReads = 0;
    prisma.placeIntelligence.findUnique = new Proxy(originalFind, {apply(target, thisArg, args) { cacheReads += 1; return Reflect.apply(target, thisArg, args); }});
    try {
      const places = await Promise.all(locationIds.map(id => enrichBookingLocation(id)));
      assert.ok(places.every(result => result.id === place.id));
      assert.equal(cacheReads, 1, "concurrent same-location lookups share one cache/provider operation");
    } finally { prisma.placeIntelligence.findUnique = originalFind; }
    for (const id of locationIds) {
      assert.equal((await enrichBookingLocation(id)).id, place.id);
      assert.equal((await prisma.bookingLocation.findUniqueOrThrow({where: {id}})).placeIntelligenceId, place.id);
    }
    assert.equal((await prisma.placeIntelligence.findUniqueOrThrow({where: {id: place.id}})).attemptCount, 0);
  }
});
