import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hackneyPeriod,
  normaliseBadge,
  summariseHackneyDrivers,
} from "./hackney-performance";

test("London periods include the selected local dates and follow DST", () => {
  const spring = hackneyPeriod("2026-03-29", "2026-03-29");
  assert.equal(spring.from.toISOString(), "2026-03-29T00:00:00.000Z");
  assert.equal(spring.to.toISOString(), "2026-03-29T23:00:00.000Z");
  const autumn = hackneyPeriod("2026-10-25", "2026-10-25");
  assert.equal(autumn.to.getTime() - autumn.from.getTime(), 25 * 3600000);
  const summer = hackneyPeriod("2026-07-01", "2026-07-31");
  assert.equal(summer.from.toISOString(), "2026-06-30T23:00:00.000Z");
  assert.equal(summer.to.toISOString(), "2026-07-31T23:00:00.000Z");
});

test("London date filters reject invalid, reversed and unbounded ranges", () => {
  for (const [from, to] of [
    ["2026-02-30", "2026-03-01"],
    ["2026-02-01", "2026-01-01"],
    ["2025-01-01", "2027-01-01"],
    ["July 1", "2026-07-01"],
  ]) {
    assert.throws(() => hackneyPeriod(from, to));
  }
  assert.doesNotThrow(() => hackneyPeriod("2024-02-29", "2024-02-29"));
});

test("badge association preserves identifiers and never guesses ambiguous identities", () => {
  const driver = (id: string, badgeNumber: string) => ({
    id,
    badgeNumber,
    fullName: `Synthetic ${id}`,
    forename: null,
    surname: null,
  });
  const booking = (badge: string | null) => ({
    driverBadgeNumber: badge,
    status: "COMPLETED",
    fare: null,
  });
  const report = summariseHackneyDrivers(
    [
      booking(" 001a "),
      booking("1A"),
      booking("DUP"),
      booking(null),
      booking("   "),
    ],
    [driver("one", "001A"), driver("dup1", "dup"), driver("dup2", "DUP")],
  );
  assert.equal(normaliseBadge(" 001a "), "001A");
  assert.equal(
    report.drivers.find((row) => row.badge === "001A")?.driverId,
    "one",
  );
  assert.equal(
    report.drivers.find((row) => row.badge === "DUP")?.driverId,
    null,
  );
  assert.deepEqual(report.quality, {
    missingBadge: 2,
    unmatchedBadge: 1,
    ambiguousBadge: 1,
  });
  assert.equal(report.totals.total, 5);
});

test("missing fares and empty periods are not represented as zero-value completed work", () => {
  const report = summariseHackneyDrivers(
    [
      { driverBadgeNumber: null, status: "COMPLETED", fare: 0 },
      { driverBadgeNumber: null, status: "COMPLETED", fare: null },
      { driverBadgeNumber: null, status: "COMPLETED", fare: "12.34" },
      { driverBadgeNumber: null, status: "CANCELLED", fare: 99 },
      { driverBadgeNumber: null, status: "NO_FARE", fare: 99 },
      { driverBadgeNumber: null, status: "UNKNOWN", fare: null },
    ],
    [],
  );
  assert.equal(report.totals.recordedFare, 12.34);
  assert.equal(report.totals.completedWithoutFare, 1);
  assert.equal(report.totals.completionRate, 50);
  assert.equal(report.totals.cancelled, 1);
  assert.equal(report.totals.noFare, 1);
  assert.equal(report.totals.otherStatuses, 1);
  assert.equal(summariseHackneyDrivers([], []).totals.completionRate, null);
});
