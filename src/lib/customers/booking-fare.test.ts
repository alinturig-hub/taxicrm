import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBookingCreateData, buildBookingUpdateData } from "../autocab/booking-mappers";
import { buildCustomerProfile, type ProfileBooking } from "./customer-profiler";
import { bookingPriceDisplay } from "./booking-price-display";

test("Autocab fare survives creation and partial updates independently of price", () => {
  for (const [fare, expected] of [["12.34", "£12.34"], [0, "£0.00"], [null, "Not available"], [undefined, "Not available"]] as const) {
    const payload = { Pricing: { Fare: fare }, synthetic: true };
    const original = JSON.stringify(payload);
    const created = buildBookingCreateData(payload, "synthetic-fare");
    assert.equal(bookingPriceDisplay(created.fare?.toString()), expected);
    assert.equal(created.price, null);
    const update = buildBookingUpdateData({Pricing: {Price: "10.20"}});
    assert.equal(Object.hasOwn(update, "fare"), false, "partial pricing must not erase recorded fare");
    assert.equal(JSON.stringify(payload), original, "source payload is unchanged");
  }
  const update = buildBookingUpdateData({Pricing: {Fare: "14.50", Price: "10.20"}});
  assert.equal(update.fare?.toString(), "14.5");
  assert.equal(update.price?.toString(), "10.2");
});

test("customer booking history carries fare for every lifecycle without changing price", () => {
  const bookings: ProfileBooking[] = ["COMPLETED", "CANCELLED", "NO_FARE", "DISPATCHED"].map((status, index) => ({
    externalId: `synthetic-fare-${index}`, status,
    bookedAtTime: new Date("2026-10-10T12:00:00Z"), pickupDueTime: new Date("2026-10-10T13:00:00Z"),
    completedAt: status === "COMPLETED" ? new Date("2026-10-10T14:00:00Z") : null,
    fare: index === 0 ? "12.34" : index === 1 ? 0 : null,
    price: null, distance: null, paymentType: null, bookingSource: null, locations: [],
  }));
  const profile = buildCustomerProfile(bookings, new Date("2026-10-11T12:00:00Z"));
  for (const booking of profile.latestBookings) {
    const source = bookings.find((item) => item.externalId === booking.externalId)!;
    assert.equal(booking.fare, source.fare);
    assert.equal(booking.price, null);
  }
});
