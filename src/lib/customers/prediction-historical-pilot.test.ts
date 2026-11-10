import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateHistoricalPilot, type PilotEnvelope } from "./prediction-historical-pilot";

const history = [1, 2, 3, 4, 5].map((day) => `2026-10-0${day}T08:00:00Z`);
const identity = (count = 5, shared = false) => Array.from({ length: count }, (_, index) => ({ locations: [
  { type: "PICKUP" as const, address: shared ? "aaa" : `home${index % 2}`, zoneName: null },
  { type: "DESTINATION" as const, address: shared ? `destination${index}` : "work", zoneName: null },
] }));
const fixture = (): PilotEnvelope => ({
  dataKind: "SYNTHETIC", sourceDatabase: "postgres", sourceRole: "cabby_ro", readOnly: "on",
  snapshotAt: "2026-10-08T00:00:00Z", coverageStatus: "CURRENT_SNAPSHOT_NOT_POINT_IN_TIME_AUDITED",
  poolSize: 1000, sourceRows: 5, dailyActivity: [{ day: "2026-10-06", bookings: 1 }],
  historyAvailableFrom: "2026-10-01T00:00:00Z", evaluationStart: "2026-10-06T00:00:00Z",
  observedThrough: "2026-10-07T00:00:00Z", checkpointHours: 24,
  customers: [{ key: "private-source-key", bookedAt: [...history], availableAt: [...history], identityHistory: identity() }],
});

test("pilot emits aggregates and preserves synthetic versus historical provenance", () => {
  const result = evaluateHistoricalPilot(fixture());
  assert.equal(result.dataKind, "SYNTHETIC");
  assert.equal(result.state, "DIAGNOSTIC_ONLY_NOT_DEPLOYMENT_APPROVAL");
  assert.equal(result.cohort.evaluatedProfiles, 1);
  assert.equal(result.horizons[2].samples, 1);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("private-source-key"), false);
  assert.equal(serialized.includes("home"), false);
  assert.equal(serialized.includes(history[0]), false);
});

test("shared and poorly evidenced contacts are excluded instead of assumed individual", () => {
  const data = fixture();
  data.customers[0].identityHistory = identity(20, true);
  data.customers.push({ ...data.customers[0], key: "unknown-contact", identityHistory: [{ locations: [] }] });
  data.sourceRows = 10;
  const result = evaluateHistoricalPilot(data);
  assert.equal(result.cohort.sharedProfiles, 1);
  assert.equal(result.cohort.profilesWithoutIdentityEvidence, 1);
  assert.equal(result.cohort.evaluatedProfiles, 0);
  assert.equal(result.horizons[2].top20Precision, null);
});

test("source-role, row limits, coverage claims and missing availability fail closed", () => {
  assert.throws(() => evaluateHistoricalPilot({ ...fixture(), sourceRole: "postgres" }), /source/);
  assert.throws(() => evaluateHistoricalPilot({ ...fixture(), readOnly: "off" }), /source/);
  assert.throws(() => evaluateHistoricalPilot({ ...fixture(), sourceRows: 20_001 }), /size/);
  assert.throws(() => evaluateHistoricalPilot({ ...fixture(), sourceRows: 6 }), /mismatch/);
  assert.throws(() => evaluateHistoricalPilot({ ...fixture(), coverageStatus: "VERIFIED" }), /coverage/);
  assert.throws(() => evaluateHistoricalPilot({ ...fixture(), snapshotAt: "2026-09-01T00:00:00Z" }), /Snapshot/);
  const data = fixture(); delete data.customers[0].availableAt;
  assert.throws(() => evaluateHistoricalPilot(data), /availability/);
});
