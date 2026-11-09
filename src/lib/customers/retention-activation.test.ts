import assert from "node:assert/strict";
import { test } from "node:test";
import { earlyRetentionProgress, retentionForCustomerProfile, type RetentionJourney } from "./retention-activation";
const now = new Date("2026-11-25T12:00:00Z");
const journey = (id: string, status: string, at: string | null): RetentionJourney => ({id, status, completedAt: at ? new Date(at) : null});
test("counts only completed journeys in the first 7 and 14 elapsed days", () => {
  const rows = [journey("a", "COMPLETED", "2026-11-01T12:00:00Z"), journey("b", "COMPLETED", "2026-11-02T12:00:00Z"), journey("c", "COMPLETED", "2026-11-03T12:00:00Z"), journey("d", "COMPLETED", "2026-11-07T12:00:00Z"), journey("e", "COMPLETED", "2026-11-09T12:00:00Z"), journey("f", "COMPLETED", "2026-11-15T12:00:00Z"), journey("g", "CANCELLED", "2026-11-04T12:00:00Z"), journey("h", "NO_FARE", "2026-11-05T12:00:00Z")];
  const result = earlyRetentionProgress(rows, now);
  assert.equal(result.completedWithin7Days, 4);
  assert.equal(result.completedWithin14Days, 5);
  assert.equal(result.reached5Within7Days, false);
  assert.equal(result.reached5Within14Days, true);
});
test("future and undated completions cannot fabricate activation", () => {
  const rows = [journey("a", "COMPLETED", "2026-11-20T12:00:00Z"), journey("b", "COMPLETED", null), journey("c", "COMPLETED", "2026-12-01T12:00:00Z")];
  const result = earlyRetentionProgress(rows, now);
  assert.equal(result.datedCompleted, 1);
  assert.equal(result.undatedCompleted, 1);
  assert.equal(result.evidenceIncomplete, true);
  assert.equal(result.reached5Within14Days, null);
});
test("rejects duplicate identities rather than counting a journey twice", () => {
  assert.throws(() => earlyRetentionProgress([journey("a", "COMPLETED", null), journey("a", "COMPLETED", null)], now), /unique/);
});
test("shared booking points do not receive individual retention progress", () => {
  assert.equal(retentionForCustomerProfile([journey("a", "COMPLETED", "2026-11-01T12:00:00Z")], "SHARED_BOOKING_POINT", now), null);
  assert.notEqual(retentionForCustomerProfile([journey("a", "COMPLETED", "2026-11-01T12:00:00Z")], "LIKELY_INDIVIDUAL", now), null);
});
