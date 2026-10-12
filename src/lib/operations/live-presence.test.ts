import assert from "node:assert/strict";
import { test } from "node:test";
import { driverPresence, fleetPresence } from "./live-presence";
const now = new Date("2026-10-12T12:00:00Z");
const shift = (status: string, at: string, vehicleId: string | null = "v") => ({
  driverId: "d",
  status,
  startedAt: new Date(at),
  endedAt: status === "ENDED" ? now : null,
  vehicleId,
});
const vehicle = (status: string, at: string) => ({
  id: "v",
  currentDriverId: "d",
  currentStatus: status,
  lastSeenAt: new Date(at),
});
test("a newer ended shift wins over an old active shift even with fresh vehicle telemetry", () => {
  const result = driverPresence(
    [
      shift("ACTIVE", "2026-08-09T12:00:00Z"),
      shift("ENDED", "2026-10-12T08:00:00Z"),
    ],
    [vehicle("Clear", "2026-10-12T11:59:00Z")],
    now,
  );
  assert.equal(result.onShift, 0);
  assert.equal(result.liveConfirmed, 0);
});
test("old open records require fresh matching working telemetry; stale, future, off-duty and unassigned signals do not confirm", () => {
  const shifts = [shift("ACTIVE", "2026-08-09T12:00:00Z")];
  assert.equal(
    driverPresence(shifts, [vehicle("Clear", "2026-10-12T11:58:00Z")], now)
      .liveConfirmed,
    1,
  );
  for (const row of [
    vehicle("Clear", "2026-10-11T12:00:00Z"),
    vehicle("Clear", "2026-10-12T12:01:00Z"),
    vehicle("NotWorking", "2026-10-12T11:59:00Z"),
    vehicle("Unknown", "2026-10-12T11:59:00Z"),
    { ...vehicle("Clear", "2026-10-12T11:59:00Z"), currentDriverId: null },
  ])
    assert.equal(driverPresence(shifts, [row], now).liveConfirmed, 0);
  assert.equal(
    driverPresence(
      [shift("ACTIVE", "2026-10-13T12:00:00Z")],
      [vehicle("Clear", "2026-10-12T11:59:00Z")],
      now,
    ).onShift,
    0,
  );
});
test("stale status is not counted as current clear or busy, unknown status is explicit", () => {
  const result = fleetPresence(
    [
      vehicle("Clear", "2026-10-11T12:00:00Z"),
      vehicle("BusyMeterOff", "2026-10-12T11:59:00Z"),
      vehicle("Unknown", "2026-10-12T11:59:00Z"),
    ],
    now,
  );
  assert.equal(result.clear, 0);
  assert.equal(result.busy, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.live, 2);
  assert.equal(result.stale, 1);
});
