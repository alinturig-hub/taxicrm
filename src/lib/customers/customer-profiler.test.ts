import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCustomerProfile, type ProfileBooking } from "./customer-profiler";
import { buildCustomerBookingWindow } from "./customer-booking-window";
import { buildNextBookingPrediction } from "./customer-next-booking";
const now = new Date("2026-10-26T10:00:00Z");
function booking(at: string | null, extra: Partial<ProfileBooking> = {}): ProfileBooking {
  return { externalId: `synthetic-${at}`, status: "COMPLETED", bookedAtTime: at ? new Date(at) : null, pickupDueTime: at ? new Date(at) : null, completedAt: null, price: 12, fare: 99, distance: null, paymentType: null, bookingSource: "SYNTHETIC", locations: [], ...extra };
}
test("future and undated records stay visible without changing historical recency or readiness", () => {
  const past = booking("2026-10-01T10:00:00Z");
  const future = booking("2026-10-27T10:00:00Z", { bookedAtTime: new Date("2026-10-25T10:00:00Z"), status: "CREATED" });
  const rows = [past, future, booking(null), booking("invalid-date")];
  const before = JSON.stringify(rows);
  const profile = buildCustomerProfile(rows, now);
  assert.equal(profile.overview.totalBookings, 1);
  assert.equal(profile.overview.recordedBookings, 4);
  assert.equal(profile.overview.futureDatedBookings, 1);
  assert.equal(profile.overview.undatedBookings, 2);
  assert.equal(profile.overview.lastBookingAt?.toISOString(), past.pickupDueTime?.toISOString());
  assert.equal(profile.overview.daysSinceLastBooking, 25);
  assert.equal(profile.classification.profileSafeForPersonalisation, false);
  assert.equal(profile.latestBookings.length, 4);
  assert.equal(JSON.stringify(rows), before);
});
test("unknown prices are not zero and the average uses only known completed prices", () => {
  const rows = [null, undefined, "", " ", "invalid", NaN, Infinity, false, 0, "12.00", { toString: () => "24" }].map(price => booking("2026-10-25T10:00:00Z", { price }));
  const profile = buildCustomerProfile(rows, now);
  assert.equal(profile.overview.totalSpent, 36);
  assert.equal(profile.overview.averageCompletedValue, 12);
  assert.equal(profile.overview.pricedCompletedBookings, 3);
  assert.equal(profile.overview.missingCompletedPrices, 8);
  assert.equal(profile.overview.spendCoverage, 27.3);
  assert.equal(buildCustomerProfile([booking("2026-10-25T10:00:00Z", { price: null, fare: 99 })], now).overview.totalSpent, null, "fare is not substituted for price");
  assert.equal(buildCustomerProfile([], now).overview.averageCompletedValue, null);
  assert.equal(buildCustomerProfile([booking("2026-10-25T10:00:00Z", { price: 0 })], now).overview.averageCompletedValue, 0);
});
test("future creation/completion timestamps cannot become observed history", () => {
  const profile = buildCustomerProfile([
    booking("2026-10-25T10:00:00Z", { bookedAtTime: new Date("2026-10-27T10:00:00Z") }),
    booking("2026-10-25T10:00:00Z", { completedAt: new Date("2026-10-27T10:00:00Z") }),
    booking(now.toISOString()),
  ], now);
  assert.equal(profile.overview.totalBookings, 1);
  assert.equal(profile.overview.futureDatedBookings, 2);
  assert.equal(profile.overview.daysSinceLastBooking, 0);
});
test("London repeated autumn hour is grouped locally and cancelled prices do not become spend", () => {
  const profile = buildCustomerProfile([
    booking("2026-10-25T00:30:00Z"), booking("2026-10-25T01:30:00Z", { status: "CANCELLED", price: 500 }),
  ], now);
  assert.deepEqual(profile.behaviour.hours, [{ label: "01:00", count: 2, percentage: 100 }]);
  assert.equal(profile.overview.cancellationRate, 50);
  assert.equal(profile.overview.totalSpent, 12);
});
test("shared/freephone identity protection remains in force", () => {
  const rows = Array.from({ length: 25 }, (_, i) => booking(new Date(now.getTime() - (i + 1) * 86400000).toISOString(), { locations: [{ type: "PICKUP", address: "Synthetic shared freephone", zoneName: null }, { type: "DESTINATION", address: `Synthetic destination ${i}`, zoneName: null }] }));
  const profile = buildCustomerProfile(rows, now);
  assert.equal(profile.classification.identityType, "SHARED_BOOKING_POINT");
  assert.equal(profile.classification.profileSafeForPersonalisation, false);
  assert.deepEqual(profile.tags, []);
});
test("prediction ignores future-created actions but retains lead times for already-made advance bookings", () => {
  const past = Array.from({ length: 10 }, (_, i) => booking(new Date(now.getTime() - (i + 1) * 86400000).toISOString()));
  const futureCreated = booking("2026-10-28T10:00:00Z", { bookedAtTime: new Date("2026-10-27T10:00:00Z") });
  const baseline = buildCustomerBookingWindow(past, { now });
  assert.equal(baseline.status, "READY");
  const withFuture = buildCustomerBookingWindow([...past, futureCreated], { now });
  assert.deepEqual(withFuture, baseline);
  const alreadyBooked = booking("2026-10-27T10:00:00Z", { bookedAtTime: new Date("2026-10-25T10:00:00Z") });
  assert.equal(buildCustomerBookingWindow([alreadyBooked], { now }).leadTimeSamples, 1);
  assert.equal(buildCustomerBookingWindow([alreadyBooked], { now }).medianLeadMinutes, 2880);
  assert.deepEqual(buildNextBookingPrediction([...past, futureCreated], now), buildNextBookingPrediction(past, now));
  assert.equal(buildCustomerBookingWindow(past, { now, profileSafeForPersonalisation: false }).status, "DISABLED");
});
