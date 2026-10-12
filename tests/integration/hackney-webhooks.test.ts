import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { processWebhookEvent } from "@/lib/autocab/process-webhook-event";
import { AUTOCAB_EVENT_REGISTRY } from "@/lib/autocab/event-registry";
import { retryableWebhooks } from "@/lib/autocab/webhook-processing";
import {
  getHackneyDriverPerformance,
  getHackneyMetrics,
} from "@/lib/analytics/hackney";
import { POST as receiveWebhook } from "@/app/api/webhooks/autocab/[event]/route";

// This suite is deliberately opt-in and refuses every database except the isolated
// development instance. Fixtures are synthetic and removed even on assertion failures.
assert.equal(
  process.env.DATABASE_URL,
  "postgresql://taxicrm@127.0.0.1:5432/taxicrm",
);
assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");
const prefix = `synthetic-${randomUUID()}`;
const configs = new Map<string, string>();
const date = "2042-07-01";
const originalFetch = globalThis.fetch;
let networkAttempts = 0;
let previousMetric: Awaited<
  ReturnType<typeof prisma.companyDailyMetric.findUnique>
>;
before(async () => {
  previousMetric = await prisma.companyDailyMetric.findUnique({
    where: { date: new Date(`${date}T00:00:00Z`) },
  });
});
globalThis.fetch = async () => {
  networkAttempts++;
  throw new Error(
    "External networking is forbidden in synthetic integration tests.",
  );
};
after(async () => {
  globalThis.fetch = originalFetch;
  await prisma.booking.deleteMany({
    where: { externalId: { startsWith: prefix } },
  });
  await prisma.webhookEvent.deleteMany({
    where: { idempotencyKey: { startsWith: prefix } },
  });
  const configurationIds = Array.from(configs.values());
  await prisma.webhookEvent.deleteMany({
    where: { webhookConfigurationId: { in: configurationIds } },
  });
  await prisma.autocabWebhookConfiguration.deleteMany({
    where: { id: { in: configurationIds } },
  });
  const drivers = await prisma.driver.findMany({
    where: { externalId: { startsWith: prefix } },
    select: { id: true },
  });
  await prisma.driverShift.deleteMany({
    where: { driverId: { in: drivers.map((d) => d.id) } },
  });
  await prisma.vehicle.deleteMany({
    where: { externalId: { startsWith: prefix } },
  });
  await prisma.driver.deleteMany({
    where: { id: { in: drivers.map((d) => d.id) } },
  });
  if (previousMetric)
    await prisma.companyDailyMetric.update({
      where: { id: previousMetric.id },
      data: previousMetric,
    });
  else
    await prisma.companyDailyMetric.deleteMany({
      where: { date: new Date(`${date}T00:00:00Z`) },
    });
  await prisma.$disconnect();
  assert.equal(
    networkAttempts,
    0,
    "No external fetch may even be attempted by synthetic fixtures.",
  );
});
async function config(type: string) {
  let id = configs.get(type);
  if (!id) {
    const item = await prisma.autocabWebhookConfiguration.create({
      data: {
        eventType: `${prefix}-${type}`,
        displayName: "Synthetic configuration",
        endpointSlug: `${prefix}-${type.toLowerCase()}`,
      },
    });
    id = item.id;
    configs.set(type, id);
  }
  return id;
}
async function event(
  type: string,
  payload: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return prisma.webhookEvent.create({
    data: {
      eventType: type,
      payload: payload as never,
      receivedAt: new Date(`${date}T12:00:00Z`),
      idempotencyKey: `${prefix}-${randomUUID()}`,
      webhookConfigurationId: await config(type),
      ...extra,
    },
  });
}
function bookingPayload(name: string, hour: string, badge = "001-SYN") {
  return {
    Id: `${prefix}-${name}`,
    PickupDueTime: `${date}T09:00:00Z`,
    BookingSource: "FlaggedBooking",
    EventTimestamp: `${date}T${hour}:00:00Z`,
    Driver: { Id: `${prefix}-driver`, BadgeNumber: badge },
  };
}

test("concurrent workers persist exactly one timeline and snapshot per event", async () => {
  const item = await event(
    "BookingCreated",
    bookingPayload("concurrent", "09"),
  );
  await Promise.all([
    processWebhookEvent(item.id),
    processWebhookEvent(item.id),
    processWebhookEvent(item.id),
  ]);
  const saved = await prisma.webhookEvent.findUniqueOrThrow({
    where: { id: item.id },
  });
  assert.equal(saved.status, "PROCESSED");
  assert.equal(saved.attemptCount, 1);
  assert.equal(
    await prisma.bookingSnapshot.count({ where: { webhookEventId: item.id } }),
    1,
  );
  assert.equal(
    await prisma.bookingTimelineEvent.count({
      where: { webhookEventId: item.id },
    }),
    1,
  );
});

test("failure after booking and audit writes rolls back everything; retry commits once", async () => {
  const type = "BookingCreated";
  const original = AUTOCAB_EVENT_REGISTRY.get(type)!;
  const item = await event(type, bookingPayload("rollback", "09"));
  AUTOCAB_EVENT_REGISTRY.set(type, {
    ...original,
    handler: async (id, tx) => {
      await original.handler!(id, tx);
      throw Error("synthetic fault after audit writes");
    },
  });
  try {
    await assert.rejects(processWebhookEvent(item.id), /synthetic fault/);
  } finally {
    AUTOCAB_EVENT_REGISTRY.set(type, original);
  }
  assert.equal(
    await prisma.booking.count({ where: { externalId: `${prefix}-rollback` } }),
    0,
  );
  assert.equal(
    await prisma.bookingSnapshot.count({ where: { webhookEventId: item.id } }),
    0,
  );
  assert.equal(
    await prisma.bookingTimelineEvent.count({
      where: { webhookEventId: item.id },
    }),
    0,
  );
  let saved = await prisma.webhookEvent.findUniqueOrThrow({
    where: { id: item.id },
  });
  assert.equal(saved.status, "FAILED");
  assert.equal(saved.attemptCount, 1);
  await processWebhookEvent(item.id);
  saved = await prisma.webhookEvent.findUniqueOrThrow({
    where: { id: item.id },
  });
  assert.equal(saved.status, "PROCESSED");
  assert.equal(saved.attemptCount, 2);
  assert.equal(
    await prisma.bookingSnapshot.count({ where: { webhookEventId: item.id } }),
    1,
  );
});

test("post-commit failure cannot turn a processed event into a failed replay", async () => {
  const type = "BookingCreated";
  const original = AUTOCAB_EVENT_REGISTRY.get(type)!;
  const item = await event(type, bookingPayload("postcommit", "09"));
  AUTOCAB_EVENT_REGISTRY.set(type, {
    ...original,
    handler: async (id, tx) => {
      await original.handler!(id, tx);
      return async () => {
        throw Error("synthetic notification failure");
      };
    },
  });
  try {
    await processWebhookEvent(item.id);
  } finally {
    AUTOCAB_EVENT_REGISTRY.set(type, original);
  }
  await processWebhookEvent(item.id);
  const saved = await prisma.webhookEvent.findUniqueOrThrow({
    where: { id: item.id },
  });
  assert.equal(saved.status, "PROCESSED");
  assert.equal(saved.attemptCount, 1);
  assert.equal(
    await prisma.bookingSnapshot.count({ where: { webhookEventId: item.id } }),
    1,
  );
});

test("out-of-order creation and modification do not regress completed status or driver badge", async () => {
  const complete = await event("BookingComplete", {
    ...bookingPayload("late", "11", "NEW"),
    CompletedAtTime: `${date}T11:00:00Z`,
    Pricing: { Fare: 20 },
  });
  await processWebhookEvent(complete.id);
  const created = await event("BookingCreated", {
    ...bookingPayload("late", "09", "OLD"),
    Driver: { Id: "old-driver", BadgeNumber: "OLD", Surname: "Wrong old name" },
  });
  const modified = await event("BookingModified", {
    ...bookingPayload("late", "10", "OLD"),
    Pricing: { Fare: 5 },
  });
  const cancel = await event(
    "BookingCancelled",
    bookingPayload("late", "10", "OLD"),
  );
  await Promise.all([
    processWebhookEvent(created.id),
    processWebhookEvent(modified.id),
    processWebhookEvent(cancel.id),
  ]);
  const saved = await prisma.booking.findUniqueOrThrow({
    where: {
      provider_externalId: {
        provider: "AUTOCAB",
        externalId: `${prefix}-late`,
      },
    },
  });
  assert.equal(saved.status, "COMPLETED");
  assert.equal(saved.driverBadgeNumber, "NEW");
  assert.equal(saved.driverSurname, null);
  assert.equal(Number(saved.fare), 20);
  assert.equal(saved.cancelledAt, null);
  const timeline = await prisma.bookingTimelineEvent.findFirstOrThrow({
    where: { webhookEventId: created.id },
  });
  assert.equal(timeline.occurredAt.toISOString(), `${date}T09:00:00.000Z`);
});

test("context received before creation remains retryable and applies after its booking arrives", async () => {
  const modified = await event("BookingModified", {
    ...bookingPayload("context", "11"),
    DriverNote: "Synthetic updated note",
  });
  await assert.rejects(
    processWebhookEvent(modified.id),
    /waiting for its booking/,
  );
  assert.equal(
    (
      await prisma.webhookEvent.findUniqueOrThrow({
        where: { id: modified.id },
      })
    ).status,
    "FAILED",
  );
  assert.equal(
    await prisma.booking.count({ where: { externalId: `${prefix}-context` } }),
    0,
  );
  const created = await event(
    "BookingCreated",
    bookingPayload("context", "09"),
  );
  await processWebhookEvent(created.id);
  await processWebhookEvent(modified.id);
  assert.equal(
    (
      await prisma.booking.findUniqueOrThrow({
        where: {
          provider_externalId: {
            provider: "AUTOCAB",
            externalId: `${prefix}-context`,
          },
        },
      })
    ).driverNote,
    "Synthetic updated note",
  );
});

test("rejection followed by completion reaches COMPLETED", async () => {
  const rejected = await event(
    "BookingRejected",
    bookingPayload("rejected", "09"),
  );
  const completed = await event("BookingComplete", {
    ...bookingPayload("rejected", "11"),
    CompletedAtTime: `${date}T11:00:00Z`,
  });
  await processWebhookEvent(rejected.id);
  assert.equal(
    (
      await prisma.booking.findUniqueOrThrow({
        where: {
          provider_externalId: {
            provider: "AUTOCAB",
            externalId: `${prefix}-rejected`,
          },
        },
      })
    ).driverBadgeNumber,
    null,
  );
  await processWebhookEvent(completed.id);
  assert.equal(
    (
      await prisma.booking.findUniqueOrThrow({
        where: {
          provider_externalId: {
            provider: "AUTOCAB",
            externalId: `${prefix}-rejected`,
          },
        },
      })
    ).status,
    "COMPLETED",
  );
});

test("queue retries failures with a cooldown and cap, and recovers old PROCESSING rows", async () => {
  const failed = await event(
    "BookingCreated",
    {},
    {
      status: "FAILED",
      attemptCount: 1,
      updatedAt: new Date(Date.now() - 120000),
    },
  );
  const exhausted = await event(
    "BookingCreated",
    {},
    {
      status: "FAILED",
      attemptCount: 5,
      updatedAt: new Date(Date.now() - 120000),
    },
  );
  const recent = await event(
    "BookingCreated",
    {},
    { status: "FAILED", attemptCount: 1 },
  );
  const stuck = await event(
    "BookingCreated",
    {},
    { status: "PROCESSING", updatedAt: new Date(Date.now() - 360000) },
  );
  const rows = await prisma.webhookEvent.findMany({
    where: {
      AND: [
        { id: { in: [failed.id, exhausted.id, recent.id, stuck.id] } },
        retryableWebhooks(),
      ],
    },
    select: { id: true },
  });
  assert.deepEqual(rows.map((r) => r.id).sort(), [failed.id, stuck.id].sort());
});

test("ended shift is not reopened by a delayed Started event", async () => {
  const payload = {
    Driver: { Id: `${prefix}-shift-driver`, BadgeNumber: "SYN-SHIFT" },
    StartedDate: `${date}T08:00:00Z`,
  };
  const ended = await event("DriverShiftStartedEnded", {
    ...payload,
    SubEventType: "Ended",
    EndedDate: `${date}T10:00:00Z`,
  });
  const started = await event("DriverShiftStartedEnded", {
    ...payload,
    SubEventType: "Started",
  });
  await processWebhookEvent(ended.id);
  await processWebhookEvent(started.id);
  const driver = await prisma.driver.findUniqueOrThrow({
    where: {
      provider_externalId: {
        provider: "AUTOCAB",
        externalId: `${prefix}-shift-driver`,
      },
    },
  });
  const shifts = await prisma.driverShift.findMany({
    where: { driverId: driver.id },
  });
  assert.equal(shifts.length, 1);
  assert.equal(shifts[0].status, "ENDED");
  assert.equal(shifts[0].durationSeconds, 7200);
});

test("shift retries with timestamp jitter keep one closure and old ends do not close a newer shift", async () => {
  const base = {
    Driver: { Id: `${prefix}-shift-retries` },
    StartedDate: `${date}T08:00:00Z`,
  };
  for (const payload of [
    { ...base, SubEventType: "Started" },
    { ...base, SubEventType: "Ended", EndedDate: `${date}T10:00:00Z` },
    {
      ...base,
      StartedDate: `${date}T08:00:01Z`,
      SubEventType: "Ended",
      EndedDate: `${date}T10:00:00Z`,
    },
    { ...base, SubEventType: "Ended", EndedDate: `${date}T09:00:00Z` },
    { ...base, StartedDate: `${date}T11:00:00Z`, SubEventType: "Started" },
    { ...base, SubEventType: "Ended", EndedDate: `${date}T10:00:00Z` },
  ]) {
    const item = await event("DriverShiftStartedEnded", payload);
    await processWebhookEvent(item.id);
  }
  const rows = await prisma.driverShift.findMany({
    where: { driver: { externalId: `${prefix}-shift-retries` } },
    orderBy: { startedAt: "asc" },
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, "ENDED");
  assert.equal(rows[0].endedAt?.toISOString(), `${date}T10:00:00.000Z`);
  assert.equal(rows[1].status, "ACTIVE");
  assert.equal(rows[1].endedAt, null);
});

test("Started remains authoritative when optional EndedDate carries a placeholder", async () => {
  const item = await event("DriverShiftStartedEnded", {
    Driver: { Id: `${prefix}-shift-placeholder` },
    StartedDate: `${date}T08:00:00Z`,
    SubEventType: "Started",
    EndedDate: "0001-01-01T00:00:00Z",
  });
  await processWebhookEvent(item.id);
  const row = await prisma.driverShift.findFirstOrThrow({
    where: { driver: { externalId: `${prefix}-shift-placeholder` } },
  });
  assert.equal(row.status, "ACTIVE");
  assert.equal(row.endedAt, null);
});

test("unknown shift subtype and reversed dates fail without inventing an active shift", async () => {
  for (const payload of [
    {
      Driver: { Id: `${prefix}-shift-invalid` },
      StartedDate: `${date}T08:00:00Z`,
      SubEventType: "Unknown",
    },
    {
      Driver: { Id: `${prefix}-shift-invalid` },
      StartedDate: `${date}T08:00:00Z`,
      SubEventType: "Ended",
      EndedDate: `${date}T07:00:00Z`,
    },
  ]) {
    const item = await event("DriverShiftStartedEnded", payload);
    await assert.rejects(processWebhookEvent(item.id), /SubEventType|precedes/);
    assert.equal(
      (await prisma.webhookEvent.findUniqueOrThrow({ where: { id: item.id } }))
        .status,
      "FAILED",
    );
  }
  assert.equal(
    await prisma.driver.count({
      where: { externalId: `${prefix}-shift-invalid` },
    }),
    0,
  );
});

test("late and duplicate vehicle tracks cannot overwrite live position or badge", async () => {
  const track = (hour: string, latitude: number, badge: string) => ({
    Vehicle: { Id: `${prefix}-vehicle` },
    Driver: { Id: `${prefix}-track-driver`, BadgeNumber: badge },
    Timestamp: `${date}T${hour}:00:00Z`,
    CurrentLocation: { Latitude: latitude, Longitude: -4 },
    VehicleStatus: "Available",
  });
  const newer = await event("VehicleTracksChanged", {
    VehicleTracks: [track("11", 51, "NEW")],
  });
  const older = await event("VehicleTracksChanged", {
    VehicleTracks: [track("10", 50, "OLD")],
  });
  const same = await event("VehicleTracksChanged", {
    VehicleTracks: [track("11", 49, "OLD")],
  });
  await processWebhookEvent(newer.id);
  await processWebhookEvent(older.id);
  await processWebhookEvent(same.id);
  const vehicle = await prisma.vehicle.findUniqueOrThrow({
    where: {
      provider_externalId: {
        provider: "AUTOCAB",
        externalId: `${prefix}-vehicle`,
      },
    },
    include: { currentDriver: true },
  });
  assert.equal(Number(vehicle.currentLatitude), 51);
  assert.equal(vehicle.currentDriver?.badgeNumber, "NEW");
  assert.equal(
    await prisma.vehicleSnapshot.count({ where: { vehicleId: vehicle.id } }),
    1,
  );
});

test("Hackney report matches badge rather than external driver ID and uses London month boundaries", async () => {
  const badge = `${prefix}-001`;
  const driver = await prisma.driver.create({
    data: {
      externalId: `${prefix}-report-driver`,
      badgeNumber: badge,
      fullName: "Synthetic Hackney Driver",
      active: false,
      archived: true,
    },
  });
  const jobs = [
    {
      externalId: `${prefix}-report-1`,
      pickupDueTime: new Date("2043-06-30T23:30:00Z"),
      driverId: "wrong-external-id",
      driverBadgeNumber: ` ${badge.toUpperCase()} `,
      status: "COMPLETED",
      fare: 0,
    },
    {
      externalId: `${prefix}-report-2`,
      pickupDueTime: new Date("2043-07-31T23:00:00Z"),
      driverBadgeNumber: badge,
      status: "COMPLETED",
      fare: 30,
    },
    {
      externalId: `${prefix}-report-3`,
      pickupDueTime: null,
      driverBadgeNumber: badge,
      status: "COMPLETED",
      fare: null,
    },
  ];
  await prisma.booking.createMany({
    data: jobs.map((job) => ({
      ...job,
      provider: "AUTOCAB",
      bookingSource: "FlaggedBooking",
      rawPayload: { synthetic: true },
    })),
  });
  const report = await getHackneyDriverPerformance("2043-07-01", "2043-07-31");
  assert.equal(report.totals.total, 1);
  assert.equal(report.drivers[0].driverId, driver.id);
  assert.equal(report.totals.completedWithoutFare, 0);
  assert.equal(report.undatedBookings, 1);
  const annual = await getHackneyMetrics(2043);
  assert.equal(annual.monthly[6].total, 1);
  assert.equal(annual.monthly[7].total, 1);
  assert.equal(annual.monthly[5].total, 0);
});

test("receiver deduplicates formatted payloads and repeated delivery retries a failed event", async () => {
  const type = "BookingModified";
  const configurationId = await config(type);
  const configuration =
    await prisma.autocabWebhookConfiguration.findUniqueOrThrow({
      where: { id: configurationId },
    });
  const payload = {
    ...bookingPayload("receiver", "11"),
    EventType: "BookingModified",
  };
  const receive = (body: string) =>
    receiveWebhook(
      new NextRequest(
        `http://localhost/api/webhooks/autocab/${configuration.endpointSlug}`,
        { method: "POST", body },
      ),
      { params: { event: configuration.endpointSlug } },
    );
  const first = await receive(JSON.stringify(payload));
  assert.equal(first.status, 202);
  const stored = await first.json();
  const id = stored.webhook.id;
  for (let i = 0; i < 50; i++) {
    if (
      (await prisma.webhookEvent.findUniqueOrThrow({ where: { id } }))
        .status === "FAILED"
    )
      break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(
    (await prisma.webhookEvent.findUniqueOrThrow({ where: { id } })).status,
    "FAILED",
  );
  const created = await event(
    "BookingCreated",
    bookingPayload("receiver", "09"),
  );
  await processWebhookEvent(created.id);
  const duplicate = await receive(
    JSON.stringify(
      Object.fromEntries(Object.entries(payload).reverse()),
      null,
      2,
    ),
  );
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).webhook.id, id);
  for (let i = 0; i < 50; i++) {
    if (
      (await prisma.webhookEvent.findUniqueOrThrow({ where: { id } }))
        .status === "PROCESSED"
    )
      break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(
    (await prisma.webhookEvent.findUniqueOrThrow({ where: { id } })).status,
    "PROCESSED",
  );
  assert.equal(
    await prisma.bookingTimelineEvent.count({ where: { webhookEventId: id } }),
    1,
  );
});

test("different concurrent booking events have distinct audit versions and preserve the newest payload", async () => {
  const first = await event(
    "BookingCreated",
    bookingPayload("distinct", "09", "OLD"),
  );
  const second = await event("BookingComplete", {
    ...bookingPayload("distinct", "11", "NEW"),
    CompletedAtTime: `${date}T11:00:00Z`,
  });
  await Promise.all([
    processWebhookEvent(second.id),
    processWebhookEvent(first.id),
  ]);
  const booking = await prisma.booking.findUniqueOrThrow({
    where: {
      provider_externalId: {
        provider: "AUTOCAB",
        externalId: `${prefix}-distinct`,
      },
    },
    include: { snapshots: { orderBy: { version: "asc" } } },
  });
  assert.equal(booking.status, "COMPLETED");
  assert.equal(booking.driverBadgeNumber, "NEW");
  assert.deepEqual(
    booking.snapshots.map((s) => s.version),
    [1, 2],
  );
});

test("invalid payload is failed with an attempt recorded; ignored events stay ignored", async () => {
  const invalid = await event("BookingCreated", {});
  await assert.rejects(
    processWebhookEvent(invalid.id),
    /Missing Autocab booking ID/,
  );
  assert.equal(
    (await prisma.webhookEvent.findUniqueOrThrow({ where: { id: invalid.id } }))
      .attemptCount,
    1,
  );
  const ignored = await event(
    "BookingCreated",
    bookingPayload("ignored", "09"),
    { status: "IGNORED" },
  );
  await processWebhookEvent(ignored.id);
  assert.equal(
    (await prisma.webhookEvent.findUniqueOrThrow({ where: { id: ignored.id } }))
      .status,
    "IGNORED",
  );
  assert.equal(
    await prisma.booking.count({ where: { externalId: `${prefix}-ignored` } }),
    0,
  );
});

test("partial live driver metadata retains badge and vehicle identity", async () => {
  const vehicleId = `${prefix}-partial-vehicle`,
    driverId = `${prefix}-partial-driver`;
  const track = (hour: string, extra: Record<string, unknown>) => ({
    Vehicle: { Id: vehicleId },
    Driver: { Id: driverId, ...extra },
    Timestamp: `${date}T${hour}:00:00Z`,
    CurrentLocation: { Latitude: 51, Longitude: -4 },
  });
  const first = await event("VehicleTracksChanged", {
    VehicleTracks: [
      track("09", { BadgeNumber: "001-SYN", Forename: "Synthetic" }),
    ],
  });
  const next = await event("VehicleTracksChanged", {
    VehicleTracks: [track("10", { Callsign: "SYN-1" })],
  });
  await processWebhookEvent(first.id);
  await processWebhookEvent(next.id);
  const driver = await prisma.driver.findUniqueOrThrow({
    where: {
      provider_externalId: { provider: "AUTOCAB", externalId: driverId },
    },
  });
  assert.equal(driver.badgeNumber, "001-SYN");
  assert.equal(driver.forename, "Synthetic");
  assert.equal(driver.callsign, "SYN-1");
});

test("new recovery can return a live booking to dispatch and clear its assignment; delayed recovery cannot regress it", async () => {
  const accepted = await event(
    "BookingDispatchAccepted",
    bookingPayload("recovery", "09"),
  );
  const recovered = await event("BookingRecovered", {
    ...bookingPayload("recovery", "10"),
    Driver: null,
  });
  await processWebhookEvent(accepted.id);
  await processWebhookEvent(recovered.id);
  let booking = await prisma.booking.findUniqueOrThrow({
    where: {
      provider_externalId: {
        provider: "AUTOCAB",
        externalId: `${prefix}-recovery`,
      },
    },
  });
  assert.equal(booking.status, "DISPATCHED");
  assert.equal(booking.driverBadgeNumber, null);
  const later = await event(
    "BookingDispatchAccepted",
    bookingPayload("recovery", "11", "NEW"),
  );
  const delayed = await event("BookingRecovered", {
    ...bookingPayload("recovery", "10"),
    Driver: null,
  });
  await processWebhookEvent(later.id);
  await processWebhookEvent(delayed.id);
  booking = await prisma.booking.findUniqueOrThrow({
    where: {
      provider_externalId: {
        provider: "AUTOCAB",
        externalId: `${prefix}-recovery`,
      },
    },
  });
  assert.equal(booking.status, "ACCEPTED");
  assert.equal(booking.driverBadgeNumber, "NEW");
});
