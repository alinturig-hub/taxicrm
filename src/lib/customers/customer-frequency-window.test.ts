import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCustomerBookingWindow as build } from "./customer-booking-window";
const now = new Date("2026-11-10T12:00:00Z");
const rows = Array.from({ length: 5 }, (_, i) => {
  const at = new Date(now.getTime() - (i + 1) * 86_400_000);
  return { bookedAtTime: at, createdAt: at, pickupDueTime: new Date(at.getTime() + 30 * 60_000) };
});
test("live contract carries frequency scores without fabricated calibration or exact times", () => {
  const result = build(rows, { now });
  assert.equal(result.status, "READY");
  assert.equal(result.model, "FREQUENCY_REFERENCE_V1");
  assert.equal(result.primaryObservedBenchmarkRate, null);
  assert.equal(result.strongestUpcomingWindow, null);
  assert.equal(result.frequencyEvidence.recent28, 5);
  assert.equal(result.medianLeadMinutes, 30);
  for (const horizon of result.horizons) {
    assert.equal(horizon.observedBenchmarkRate, null);
    assert.equal(horizon.calibrationSamples, 0);
    assert.equal(horizon.strongestSlot.startAt, null);
    assert.equal(horizon.score, Math.round(100 * (1 - Math.exp(-5 * horizon.horizonHours / 672)) * 100) / 100);
  }
});
test("missing and later import timestamps cannot become current ranking evidence", () => {
  assert.equal(build(rows.map((row) => ({ bookedAtTime: row.bookedAtTime, pickupDueTime: row.pickupDueTime })), { now }).status, "LEARNING");
  const later = { bookedAtTime: new Date("2026-11-10T11:00:00Z"), createdAt: new Date("2026-11-11T12:00:00Z") };
  assert.deepEqual(build([...rows, later], { now }).horizons, build(rows, { now }).horizons);
  assert.equal(build(rows, { now, profileSafeForPersonalisation: false }).status, "DISABLED");
});
