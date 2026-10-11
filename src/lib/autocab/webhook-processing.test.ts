import assert from "node:assert/strict";
import { test } from "node:test";
import {
  webhookIdempotencyKey,
  bookingExternalId,
  webhookOccurredAt,
  driverIdentityUpdate,
} from "./webhook-processing";
import { canTransitionBookingStatus } from "./booking-state";
import { buildBookingUpdateData } from "./booking-mappers";

test("semantic duplicates ignore object key order and slug formatting, but retain array order", () => {
  const a = {
    Id: "synthetic",
    Driver: { BadgeNumber: "001", Id: 1 },
    Vias: [1, 2],
  };
  const b = {
    Vias: [1, 2],
    Driver: { Id: 1, BadgeNumber: "001" },
    Id: "synthetic",
  };
  assert.equal(
    webhookIdempotencyKey("Booking.Created", a),
    webhookIdempotencyKey("booking-created", b),
  );
  assert.notEqual(
    webhookIdempotencyKey("BookingCreated", a),
    webhookIdempotencyKey("BookingCreated", { ...b, Vias: [2, 1] }),
  );
  assert.notEqual(
    webhookIdempotencyKey("BookingCreated", a),
    webhookIdempotencyKey("BookingComplete", b),
  );
});

test("booking identity skips empty primary IDs consistently", () => {
  assert.equal(
    bookingExternalId({ OriginalBookingId: " ", BookingId: "synthetic" }),
    "synthetic",
  );
  assert.equal(
    bookingExternalId({ OriginalBookingId: "original", Id: "other" }),
    "original",
  );
});

test("event occurrence uses offset-aware provider dates and a documented receive-time fallback", () => {
  const receivedAt = new Date("2026-07-01T12:00:00Z");
  assert.equal(
    webhookOccurredAt({
      eventType: "Booking.Complete",
      payload: { CompletedAtTime: "2026-07-01T10:00:00+01:00" },
      receivedAt,
    }).toISOString(),
    "2026-07-01T09:00:00.000Z",
  );
  assert.equal(
    webhookOccurredAt({
      eventType: "BookingComplete",
      payload: { CompletedAtTime: "2026-07-01T10:00:00" },
      receivedAt,
    }),
    receivedAt,
  );
});

test("rejections do not permanently block acceptance or completion, terminal bookings do not regress", () => {
  assert.equal(canTransitionBookingStatus("REJECTED", "COMPLETED"), true);
  assert.equal(canTransitionBookingStatus("REJECTED", "ACCEPTED"), true);
  assert.equal(canTransitionBookingStatus("REJECTED", "DISPATCHED"), true);
  assert.equal(canTransitionBookingStatus("COMPLETED", "CREATED"), false);
  assert.equal(canTransitionBookingStatus("POB", "REJECTED"), false);
});

test("partial driver payloads retain fields which were not sent", () => {
  const update = buildBookingUpdateData({ Driver: { BadgeNumber: "001" } });
  assert.equal(update.driverBadgeNumber, "001");
  assert.equal(Object.hasOwn(update, "driverId"), false);
  assert.equal(Object.hasOwn(update, "driverCallSign"), false);
  assert.deepEqual(driverIdentityUpdate({ Id: "synthetic", Callsign: "42" }), {
    callsign: "42",
  });
});
