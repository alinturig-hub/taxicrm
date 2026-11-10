import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCustomerBookingWindow } from "./customer-booking-window";
import { validateBookingWindows, type ValidationInput } from "./booking-window-validation";

const history = [1, 2, 3, 4, 5].map((day) => `2026-10-0${day}T08:00:00Z`);
const base = (): ValidationInput => ({
  dataKind: "SYNTHETIC",
  historyAvailableFrom: "2026-10-01T00:00:00Z",
  evaluationStart: "2026-10-06T00:00:00Z",
  observedThrough: "2026-10-07T00:00:00Z",
  checkpointHours: 24,
  customers: [{ key: "synthetic-a", safeForPersonalisation: true, bookedAt: [...history] }],
});
const h24 = (input: ValidationInput) => validateBookingWindows(input).horizons.find((horizon) => horizon.horizonHours === 24)!;

test("retains a customer who never returns instead of stopping at their last booking", () => {
  const result = h24(base());
  assert.equal(result.model.samples, 1);
  assert.equal(result.model.positives, 0);
  assert.equal(result.model.baseRate, 0);
  assert.equal(result.model.top20Lift, null);
});

test("censors incomplete horizons against a global observation end", () => {
  const result = validateBookingWindows(base());
  assert.equal(result.horizons[2].model.samples, 1);
  assert.equal(result.horizons[3].model.samples, 0);
  assert.equal(result.horizons[3].censoredSnapshots, 1);
});

test("uses (cutoff, horizon end] for labels and never learns from future actions", () => {
  const negative = base();
  const positive = base();
  positive.customers[0].bookedAt.push(positive.observedThrough);
  const before = h24(negative).model;
  const after = h24(positive).model;
  assert.equal(after.positives, 1);
  assert.deepEqual(before.scoreBands.map((band) => band.samples), after.scoreBands.map((band) => band.samples));
  const atCutoff = base();
  atCutoff.customers[0].bookedAt.push(atCutoff.evaluationStart);
  assert.equal(h24(atCutoff).model.positives, 0);
});

test("calls the production score without substituting the old backtest score", () => {
  const input = base();
  const prediction = buildCustomerBookingWindow(history.map((bookedAtTime) => ({ bookedAtTime })), { now: new Date(input.evaluationStart) });
  const score = prediction.horizons.find((row) => row.horizonHours === 24)!.score;
  const report = h24(input).model;
  assert.equal(report.scoreBands.find((band) => score >= band.minimum && (score < band.maximum || band.maximum === 100))!.samples, 1);
});

test("handles sparse and unsafe profiles and removes duplicate action timestamps", () => {
  const input = base();
  input.customers[0].bookedAt.push(history[0]);
  input.customers.push({ key: "sparse", safeForPersonalisation: true, bookedAt: history.slice(0, 4) });
  input.customers.push({ key: "shared", safeForPersonalisation: false, bookedAt: history });
  const report = validateBookingWindows(input);
  assert.equal(report.duplicateActionsRemoved, 1);
  assert.equal(report.excludedUnsafeProfiles, 1);
  assert.equal(report.horizons[2].learningSnapshots, 1);
  assert.equal(report.horizons[2].model.samples, 1);
});

test("rank ties are independent of input order and do not claim artificial lift", () => {
  const input = base();
  input.customers = Array.from({ length: 10 }, (_, index) => ({
    key: `synthetic-${index}`, safeForPersonalisation: true,
    bookedAt: [...history, ...(index < 2 ? [input.observedThrough] : [])],
  }));
  const report = h24(input);
  assert.equal(report.model.top20Precision, 0.2);
  assert.equal(report.model.top20Lift, 1);
  assert.equal(report.frequencyBaseline.top20Lift, 1);
  input.customers.reverse();
  assert.deepEqual(h24(input), report);
});

test("continues evaluating subsequent negative checkpoints after the last event", () => {
  const input = base();
  input.observedThrough = "2026-10-10T00:00:00Z";
  assert.equal(h24(input).model.samples, 4);
  assert.equal(h24(input).model.positives, 0);
});

test("rejects unbounded, ambiguous or inconsistent inputs", () => {
  assert.throws(() => validateBookingWindows({ ...base(), evaluationStart: "2026-10-06T00:00:00" }), /offset/);
  assert.throws(() => validateBookingWindows({ ...base(), checkpointHours: 0 }), /Checkpoint/);
  assert.throws(() => validateBookingWindows({ ...base(), observedThrough: "2026-09-01T00:00:00Z" }), /interval/);
  const future = base(); future.customers[0].bookedAt.push("2027-01-01T00:00:00Z");
  assert.throws(() => validateBookingWindows(future), /coverage/);
  const duplicate = base(); duplicate.customers.push(duplicate.customers[0]);
  assert.throws(() => validateBookingWindows(duplicate), /unique/);
  assert.throws(() => validateBookingWindows(base(), 0), /limit/);
  assert.throws(() => validateBookingWindows({ ...base(), observedThrough: "2026-10-10T00:00:00Z" }, 1), /limit exceeded/);
});

test("aggregated report contains no customer identifiers or action lists", () => {
  const report = JSON.stringify(validateBookingWindows(base()));
  assert.equal(report.includes("synthetic-a"), false);
  assert.equal(report.includes(history[0]), false);
});

test("excludes the previously out-of-horizon matching slot", () => {
  const input: ValidationInput = {
    dataKind: "SYNTHETIC",
    historyAvailableFrom: "2026-10-01T00:00:00Z",
    evaluationStart: "2026-11-09T08:30:00Z",
    observedThrough: "2026-11-09T14:30:00Z",
    checkpointHours: 24,
    customers: [{ key: "synthetic-monday", safeForPersonalisation: true, bookedAt: [
      "2026-10-05T15:00:00Z", "2026-10-12T15:00:00Z", "2026-10-19T15:00:00Z",
      "2026-10-26T15:00:00Z", "2026-11-02T15:00:00Z",
    ] }],
  };
  assert.equal(validateBookingWindows(input).horizons[0].matchingSlotsOutsideHorizon, 0);
  const forecast = buildCustomerBookingWindow(input.customers[0].bookedAt.map((bookedAtTime) => ({ bookedAtTime })), { now: new Date(input.evaluationStart) });
  assert.equal(forecast.horizons[0].strongestSlot.startAt, null);
  assert.equal(forecast.horizons[0].weeklySlotScore, 0);
});

test("backfilled rows cannot become training history before their first database availability", () => {
  const input = base();
  input.customers[0].availableAt = [...history];
  input.customers[0].availableAt[4] = "2026-10-07T00:00:00Z";
  const result = validateBookingWindows(input);
  assert.equal(result.horizons[2].learningSnapshots, 1);
  assert.equal(result.horizons[2].model.samples, 0);
  assert.equal(result.profilesWithAvailability, 1);
  assert.equal(result.lateImportedActions, 1);
});

test("duplicate actions use the earliest availability and mismatched availability is rejected", () => {
  const input = base();
  input.customers[0].bookedAt.push(history[4]);
  input.customers[0].availableAt = [...history, "2026-10-07T00:00:00Z"];
  assert.equal(h24(input).model.samples, 1);
  input.customers[0].availableAt.pop();
  assert.throws(() => validateBookingWindows(input), /align/);
});

test("overlapping hits remain separate snapshots but count a returning profile once", () => {
  const input = base();
  input.checkpointHours = 6;
  input.observedThrough = "2026-10-08T00:00:00Z";
  input.customers[0].bookedAt.push("2026-10-07T00:00:00Z");
  const result = h24(input);
  assert.equal(result.model.samples, 5);
  assert.equal(result.model.positives, 4);
  assert.equal(result.positiveProfiles, 1);
  assert.equal(result.evaluatedProfiles, 1);
});

test("reports recency segments from the same scored snapshots without dropping dormant negatives", () => {
  const input = base();
  input.historyAvailableFrom = "2026-01-01T00:00:00Z";
  input.customers[0].segment = "RECENT_60D";
  input.customers[0].bookedAt.push("2026-10-06T08:00:00Z");
  input.customers.push({ key: "old-contact", safeForPersonalisation: true, segment: "DORMANT_181D_PLUS", bookedAt: [1, 2, 3, 4, 5].map((day) => `2026-03-0${day}T08:00:00Z`) });
  const result = validateBookingWindows(input);
  const main = result.horizons[2];
  assert.equal(main.model.samples, 2);
  assert.equal(main.positiveProfiles, 1);
  assert.equal(result.segments.length, 2);
  assert.equal(result.segments.find((item) => item.segment === "DORMANT_181D_PLUS")!.horizons[2].model.positives, 0);
  assert.equal(result.segments.reduce((sum, item) => sum + item.horizons[2].model.samples, 0), main.model.samples);
  assert.equal(result.segments.reduce((sum, item) => sum + item.horizons[2].model.positives, 0), main.model.positives);
});
