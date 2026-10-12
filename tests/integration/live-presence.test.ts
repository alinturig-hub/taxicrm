import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "../../src/lib/prisma";
import { getLiveOperations } from "../../src/lib/operations/live-operations";
if (
  process.env.TAXICRM_SYNTHETIC_TESTS !== "1" ||
  process.env.DATABASE_URL !== "postgresql://taxicrm@127.0.0.1:5432/taxicrm"
)
  throw new Error("Synthetic database required");
const prefix = `presence-${randomUUID()}`;
test("database latest-shift selection rejects ghost shifts and confirms matching recent telemetry", async () => {
  const before = await getLiveOperations();
  const now = Date.now();
  try {
    const ended = await prisma.driver.create({
      data: {
        provider: "SYNTHETIC",
        externalId: prefix + "-ended",
        rawPayload: { synthetic: true },
      },
    });
    const live = await prisma.driver.create({
      data: {
        provider: "SYNTHETIC",
        externalId: prefix + "-live",
        rawPayload: { synthetic: true },
      },
    });
    const invalid = await prisma.driver.create({
      data: {
        provider: "SYNTHETIC",
        externalId: prefix + "-unknown",
        rawPayload: { synthetic: true },
      },
    });
    await prisma.driverShift.create({
      data: {
        driverId: invalid.id,
        status: "ACTIVE",
        subEventType: "Unknown",
        startedAt: new Date(now - 3600000),
        rawPayload: { synthetic: true },
      },
    });
    const car = await prisma.vehicle.create({
      data: {
        provider: "SYNTHETIC",
        externalId: prefix,
        currentDriverId: live.id,
        currentStatus: "BusyMeterOff",
        lastSeenAt: new Date(now - 1000),
        rawPayload: { synthetic: true },
      },
    });
    await prisma.driverShift.createMany({
      data: [
        {
          driverId: ended.id,
          status: "ACTIVE",
          subEventType: "Started",
          startedAt: new Date(now - 86400000),
          rawPayload: { synthetic: true },
        },
        {
          driverId: ended.id,
          status: "ENDED",
          subEventType: "Ended",
          startedAt: new Date(now - 3600000),
          endedAt: new Date(now - 10000),
          rawPayload: { synthetic: true },
        },
        {
          driverId: live.id,
          vehicleId: car.id,
          status: "ACTIVE",
          subEventType: "Started",
          startedAt: new Date(now - 3600000),
          rawPayload: { synthetic: true },
        },
      ],
    });
    const after = await getLiveOperations();
    assert.equal(after.drivers.onShift - before.drivers.onShift, 1);
    assert.equal(after.drivers.offShift - before.drivers.offShift, 1);
    assert.equal(after.drivers.liveConfirmed - before.drivers.liveConfirmed, 1);
    assert.equal(after.fleet.busy - before.fleet.busy, 1);
    await prisma.vehicle.update({
      where: { id: car.id },
      data: { lastSeenAt: new Date(now - 86400000) },
    });
    const stale = await getLiveOperations();
    assert.equal(stale.drivers.liveConfirmed, before.drivers.liveConfirmed);
    assert.equal(stale.fleet.busy, before.fleet.busy);
    assert.equal(
      stale.drivers.unconfirmedOpen - before.drivers.unconfirmedOpen,
      1,
    );
  } finally {
    await prisma.driverShift.deleteMany({
      where: {
        driver: { provider: "SYNTHETIC", externalId: { startsWith: prefix } },
      },
    });
    await prisma.vehicle.deleteMany({
      where: { provider: "SYNTHETIC", externalId: prefix },
    });
    await prisma.driver.deleteMany({
      where: { provider: "SYNTHETIC", externalId: { startsWith: prefix } },
    });
    await prisma.$disconnect();
  }
});
