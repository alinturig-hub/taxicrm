import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedPredictionDisplay as display } from "./prediction-window-display";
test("clips display bounds without mutating the original dates", () => {
  const start = new Date("2026-11-10T07:00:00Z");
  assert.deepEqual(display(start, "2026-11-10T17:00:00Z", "2026-11-10T08:30:00Z", "2026-11-10T14:30:00Z"), { startAt: "2026-11-10T08:30:00.000Z", endAt: "2026-11-10T14:30:00.000Z" });
  assert.equal(start.toISOString(), "2026-11-10T07:00:00.000Z");
});
test("hides non-overlapping suggestions, including one at the exact end", () => {
  for (const start of ["2026-11-10T15:00:00Z", "2026-11-10T14:30:00Z"]) assert.equal(display(start, "2026-11-10T18:00:00Z", "2026-11-10T08:30:00Z", "2026-11-10T14:30:00Z"), null);
});
test("rejects missing, invalid and reversed bounds", () => {
  assert.equal(display(null, "2026-11-10", "2026-11-09", "2026-11-11"), null);
  assert.equal(display("bad", "2026-11-10", "2026-11-09", "2026-11-11"), null);
  assert.equal(display("2026-11-10", "2026-11-09", "2026-11-09", "2026-11-11"), null);
});
test("preserves actual instants across the London clock changes", () => {
  assert.deepEqual(display("2026-10-25T01:30:00+01:00", "2026-10-25T03:00:00Z", "2026-10-25T01:30:00Z", "2026-10-25T06:00:00Z"), { startAt: "2026-10-25T01:30:00.000Z", endAt: "2026-10-25T03:00:00.000Z" });
  assert.deepEqual(display("2026-03-29T00:30:00Z", "2026-03-29T03:00:00+01:00", "2026-03-29T00:00:00Z", "2026-03-29T06:00:00Z"), { startAt: "2026-03-29T00:30:00.000Z", endAt: "2026-03-29T02:00:00.000Z" });
});
