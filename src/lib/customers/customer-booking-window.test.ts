import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCustomerBookingWindow } from "./customer-booking-window";

const forecast = (history: string[], now: string) => buildCustomerBookingWindow(
  history.map((bookedAtTime) => ({ bookedAtTime })), { now: new Date(now) },
);
const mondays = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"];
const tuesdays = ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03"];

test("excludes a slot beginning beyond the six-hour horizon from a fractional-hour checkpoint", () => {
  const result = forecast(mondays.map((day) => `${day}T15:00:00Z`), "2026-11-09T08:30:00Z");
  assert.equal(result.horizons[0].strongestSlot.startAt, null);
  assert.equal(result.horizons[0].weeklySlotScore, 0);
});

test("includes the remaining portion of a matching current slot", () => {
  const result = forecast(tuesdays.map((day) => `${day}T07:00:00Z`), "2026-11-10T08:30:00Z");
  assert.equal(result.horizons[0].strongestSlot.startAt, "2026-11-10T08:30:00.000Z");
  assert.equal(result.horizons[0].strongestSlot.endAt, "2026-11-10T09:00:00.000Z");
  assert.equal(result.horizons[0].strongestSlot.historicalMatches, 5);
});

test("clips the end of a matching slot to the forecast horizon", () => {
  const result = forecast(mondays.map((day) => `${day}T12:00:00Z`), "2026-11-09T08:30:00Z");
  assert.equal(result.horizons[0].strongestSlot.startAt, "2026-11-09T12:00:00.000Z");
  assert.equal(result.horizons[0].strongestSlot.endAt, "2026-11-09T14:30:00.000Z");
});

test("does not include a slot starting exactly at the horizon end", () => {
  const result = forecast(mondays.map((day) => `${day}T15:00:00Z`), "2026-11-09T09:00:00Z");
  assert.equal(result.horizons[0].strongestSlot.startAt, null);
});

test("ends the spring London midnight slot at its real boundary after the skipped hour", () => {
  const history = ["2026-03-22", "2026-03-15", "2026-03-08", "2026-03-01", "2026-02-22"].map((day) => `${day}T00:30:00Z`);
  const slot = forecast(history, "2026-03-29T00:30:00Z").horizons[0].strongestSlot;
  assert.equal(slot.hour, 0);
  assert.equal(slot.startAt, "2026-03-29T00:30:00.000Z");
  assert.equal(slot.endAt, "2026-03-29T02:00:00.000Z");
});

test("keeps the repeated autumn hour inside the same contiguous London slot", () => {
  const history = ["2026-10-18", "2026-10-11", "2026-10-04", "2026-09-27", "2026-09-20"].map((day) => `${day}T00:30:00Z`);
  const full = forecast(history, "2026-10-24T23:00:00Z").horizons[0].strongestSlot;
  assert.equal(full.startAt, "2026-10-24T23:00:00.000Z");
  assert.equal(full.endAt, "2026-10-25T03:00:00.000Z");
  for (const now of ["2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z"]) {
    assert.equal(forecast(history, now).horizons[0].strongestSlot.endAt, "2026-10-25T03:00:00.000Z");
  }
});

test("all matching windows remain bounded across DST, midnight and partial hours", () => {
  const history = mondays.map((day) => `${day}T12:00:00Z`);
  for (const now of ["2026-11-09T08:30:19Z", "2026-11-08T23:59:59Z", "2026-03-29T00:30:00Z", "2026-10-25T00:30:00Z"]) {
    const earlier = history.map((time) => new Date(Date.parse(time) - 365 * 86_400_000).toISOString());
    for (const horizon of forecast(earlier, now).horizons) {
      const slot = horizon.strongestSlot;
      if (slot.startAt && slot.endAt) {
        assert.ok(Date.parse(slot.startAt) >= Date.parse(now));
        assert.ok(Date.parse(slot.endAt) <= Date.parse(horizon.windowEndAt));
        assert.ok(Date.parse(slot.endAt) > Date.parse(slot.startAt));
      }
    }
  }
});

test("future rows do not alter scores or windows, and duplicate actions do not inflate evidence", () => {
  const history = mondays.map((day) => `${day}T12:00:00Z`);
  const now = "2026-11-09T08:30:00Z";
  const expected = forecast(history, now);
  assert.deepEqual(forecast([...history, history[0], "2026-11-10T12:00:00Z"], now), expected);
});

test("keeps insufficient history and shared profiles disabled for individual forecasts", () => {
  assert.equal(forecast(mondays.slice(0, 4).map((day) => `${day}T12:00:00Z`), "2026-11-09T08:30:00Z").status, "LEARNING");
  const result = buildCustomerBookingWindow(mondays.map((day) => ({ bookedAtTime: `${day}T12:00:00Z` })), {
    now: new Date("2026-11-09T08:30:00Z"), profileSafeForPersonalisation: false,
  });
  assert.equal(result.status, "DISABLED");
  assert.deepEqual(result.horizons, []);
});
