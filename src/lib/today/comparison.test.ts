import assert from "node:assert/strict";
import { test } from "node:test";
import { comparisonDelta, yesterdayAtLondonClock } from "./comparison";

test("yesterday preserves London local time across clock changes", () => {
  for (const [now, expected] of [
    ["2026-10-25T12:15:12.345Z", "2026-10-24T11:15:12.345Z"],
    ["2026-03-29T12:15:00Z", "2026-03-28T13:15:00.000Z"],
    ["2026-10-26T01:30:00Z", "2026-10-25T00:30:00.000Z"],
    ["2026-03-30T00:30:00Z", "2026-03-29T01:30:00.000Z"],
    ["2026-01-01T00:00:00Z", "2025-12-31T00:00:00.000Z"],
  ])
    assert.equal(yesterdayAtLondonClock(new Date(now)).toISOString(), expected);
  assert.throws(() => yesterdayAtLondonClock(new Date("invalid")), /Invalid/);
});

test("zero baseline never produces an invented percentage or infinity", () => {
  assert.deepEqual(comparisonDelta(100, 0), { delta: 100, percent: null });
  assert.deepEqual(comparisonDelta(0, 0), { delta: 0, percent: null });
  assert.deepEqual(comparisonDelta(120, 100), { delta: 20, percent: 20 });
  assert.deepEqual(comparisonDelta(0, 100), { delta: -100, percent: -100 });
});
