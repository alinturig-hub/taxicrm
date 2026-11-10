import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_KPI_POLICY, evaluateBookingKpis, explicitBookingMode, distribution, summariseBookingKpis, summariseDriverKpis, type BookingTiming } from "./booking-kpis";
const at = (time: string) => new Date(`2026-10-22T${time}:00Z`);
const now = at("12:00");
const base: BookingTiming = { provider: "SYNTHETIC", externalId: "1", status: "COMPLETED", mode: "ASAP", requestedAt: at("05:55") };
const evaluate = (extra: Partial<BookingTiming>) => evaluateBookingKpis({ ...base, ...extra }, now);
test("ASAP owner examples: 06:10 in target, 06:15 five minutes late", () => {
  assert.equal(evaluate({ arrivedAt: at("06:10") }).arrivalStatus, "ON_TIME");
  const late = evaluate({ arrivedAt: at("06:15") });
  assert.equal(late.arrivalStatus, "LATE"); assert.equal(late.lateSeconds, 300);
});
test("ASAP does not use the desired pickup or a live ETA as a confirmed promise", () => {
  assert.equal(evaluate({ dueAt: at("06:20"), arrivedAt: at("06:15") }).arrivalStatus, "LATE");
  assert.equal(evaluate({ promisedArrivalAt: at("06:20"), arrivedAt: at("06:15") }).arrivalStatus, "ON_TIME");
  assert.equal(evaluate({ promisedArrivalAt: at("05:00"), arrivedAt: at("06:15") }).arrivalStatus, "UNKNOWN");
});
test("prebook ideal, required advance, at-due and actual lateness stay distinct", () => {
  for (const [time, expected] of [["05:55", "IDEAL"], ["05:59", "ON_TIME"], ["06:00", "AT_DUE_WITHOUT_LEAD"], ["06:01", "LATE"]]) {
    assert.equal(evaluate({ mode: "PREBOOK", requestedAt: at("04:00"), dueAt: at("06:00"), arrivedAt: at(time) }).arrivalStatus, expected);
  }
});
test("prebook early arrival is not attributed to passenger boarding delay", () => {
  const r = evaluate({ mode: "PREBOOK", dueAt: at("06:00"), arrivedAt: at("05:55"), pobAt: at("06:03") });
  assert.equal(r.metrics.arrivalToPobSeconds, 480);
  assert.equal(r.metrics.earlyArrivalWaitSeconds, 300);
  assert.equal(r.metrics.boardingAfterDueSeconds, 180);
});
test("early boarding and late driver arrival use max(arrival, due) with no negative waiting", () => {
  const early = evaluate({ mode: "PREBOOK", dueAt: at("06:00"), arrivedAt: at("05:55"), pobAt: at("05:58") });
  assert.equal(early.metrics.boardingAfterDueSeconds, 0);
  assert.equal(early.metrics.earlyArrivalWaitSeconds, 180);
  const late = evaluate({ mode: "PREBOOK", dueAt: at("06:00"), arrivedAt: at("06:10"), pobAt: at("06:12") });
  assert.equal(late.metrics.boardingAfterDueSeconds, 120);
});
test("explicit zero is a sample; no POB and invalid chronology are unknown", () => {
  assert.equal(evaluate({ arrivedAt: at("06:00"), pobAt: at("06:00") }).metrics.arrivalToPobSeconds, 0);
  assert.equal(evaluate({ arrivedAt: at("06:00") }).metrics.arrivalToPobSeconds, null);
  const reversed = evaluate({ arrivedAt: at("06:01"), pobAt: at("06:00") });
  assert.equal(reversed.metrics.arrivalToPobSeconds, null);
  assert.equal(reversed.arrivalStatus, "UNKNOWN");
  assert.ok(reversed.issues.includes("journey:inconsistent_order"));
});
test("future and invalid source events do not become historical observations", () => {
  assert.equal(evaluate({ arrivedAt: at("13:00"), pobAt: at("13:02") }).metrics.arrivalToPobSeconds, null);
  assert.ok(evaluate({ arrivedAt: new Date(NaN) }).issues.includes("arrived:invalid_time"));
});
test("unconfirmed booking modes are not inferred from booking lead time", () => {
  assert.equal(explicitBookingMode("ASAP", "PREBOOK"), "UNKNOWN");
  assert.equal(explicitBookingMode("pre-booked"), "PREBOOK");
  assert.equal(explicitBookingMode("Normal", "1"), "UNKNOWN");
  const r = evaluate({ mode: "UNKNOWN", arrivedAt: at("06:10"), pobAt: at("06:12") });
  assert.equal(r.arrivalStatus, "UNKNOWN");
  assert.equal(r.metrics.arrivalToPobSeconds, 120);
  assert.equal(r.metrics.boardingAfterDueSeconds, null);
});
test("invalid prebooking schedule withholds adjusted boarding observations", () => {
  const r = evaluate({ mode: "PREBOOK", dueAt: at("04:00"), arrivedAt: at("06:10"), pobAt: at("06:12") });
  assert.equal(r.arrivalStatus, "UNKNOWN"); assert.equal(r.metrics.boardingAfterDueSeconds, null);
});
test("dispatch and acceptance components are measured independently from arrival service target", () => {
  const r = evaluate({ dispatchedAt: at("06:00"), acceptedAt: at("06:01"), arrivedAt: at("06:10") });
  assert.equal(r.metrics.requestToDispatchSeconds, 300);
  assert.equal(r.metrics.dispatchToAcceptSeconds, 60);
  assert.equal(r.metrics.acceptToArrivalSeconds, 540);
  assert.equal(r.driverAttributable, false);
});
const assignment = { provider: "SYNTHETIC", driverId: "001", verified: true, from: at("05:55"), until: at("07:00") };
test("movement needs explicit telemetry and verified assignment; GPS absence never means stationary", () => {
  const acceptedAt = at("06:00"), arrivedAt = at("06:12");
  assert.equal(evaluate({ assignment, acceptedAt, arrivedAt }).movementReview, null);
  const movement = { firstConfirmedAt: at("06:05"), readyToDepartAt: acceptedAt, evidence: "ASSIGNMENT_SCOPED_TELEMETRY" as const, context: "READY" as const };
  const r = evaluate({ assignment, acceptedAt, arrivedAt, movement });
  assert.equal(r.metrics.acceptToMovementSeconds, 300); assert.equal(r.movementReview, true);
  assert.equal(evaluate({ acceptedAt, arrivedAt, movement }).metrics.acceptToMovementSeconds, null);
  assert.equal(evaluate({ assignment, acceptedAt, arrivedAt, movement: { ...movement, context: "SCHEDULED_WAIT" } }).movementReview, null);
});
test("reassigned, provider-mismatched or out-of-cycle driver evidence is unattributed", () => {
  assert.equal(evaluate({ assignment: { ...assignment, provider: "OTHER" }, arrivedAt: at("06:10") }).driverAttributable, false);
  assert.equal(evaluate({ assignment: { ...assignment, until: at("06:00") }, arrivedAt: at("06:10") }).driverAttributable, false);
  const r = evaluate({ assignment, acceptedAt: at("06:00"), arrivedAt: at("06:10"), movement: { firstConfirmedAt: at("06:15"), readyToDepartAt: at("06:00"), evidence: "ASSIGNMENT_SCOPED_TELEMETRY", context: "READY" } });
  assert.equal(r.metrics.acceptToMovementSeconds, null);
});
test("censored ongoing waits and no fare outcomes are excluded from completed boarding averages", () => {
  const ongoing = evaluate({ status: "ARRIVED", arrivedAt: at("11:55") });
  assert.equal(ongoing.metrics.waitingNowSeconds, 300);
  const noFare = evaluate({ status: "NO_FARE", arrivedAt: at("11:55") });
  assert.equal(noFare.metrics.waitingNowSeconds, null);
  assert.equal(noFare.metrics.arrivalToPobSeconds, null);
  const contradiction = evaluate({ status: "NO_FARE", arrivedAt: at("06:00"), pobAt: at("06:03") });
  assert.equal(contradiction.metrics.boardingAfterDueSeconds, null);
});
test("DST repeated London clock hour uses UTC elapsed instants", () => {
  const r = evaluateBookingKpis({ ...base, requestedAt: new Date("2026-10-25T00:55:00Z"), arrivedAt: new Date("2026-10-25T01:10:00Z") }, new Date("2026-10-25T02:00:00Z"));
  assert.equal(r.metrics.requestToArrivalSeconds, 900);
  assert.equal(r.arrivalStatus, "ON_TIME");
});
test("statistics expose zero vs missing, median, P90 and sample count", () => {
  assert.deepEqual(distribution([null, 0, 60, 120, 300, NaN]), { samples: 4, averageSeconds: 120, medianSeconds: 90, p90Seconds: 300 });
  assert.equal(distribution([]).averageSeconds, null);
});
test("retry duplicates do not inflate samples; conflicting facts are withheld", () => {
  const a = evaluate({ arrivedAt: at("06:00"), pobAt: at("06:02") });
  assert.equal(summariseBookingKpis([a, a]).bookings, 1);
  const b = evaluate({ arrivedAt: at("06:01"), pobAt: at("06:02") });
  const summary = summariseBookingKpis([a, b]);
  assert.equal(summary.conflictingBookings, 1); assert.equal(summary.metrics.arrivalToPob.samples, 0);
});
test("provider namespace and driver identity remain separate; no arbitrary driver rating", () => {
  const a = evaluate({ assignment, arrivedAt: at("06:00") });
  const b = evaluateBookingKpis({ ...base, provider: "OTHER", arrivedAt: at("06:00") }, now);
  assert.equal(summariseBookingKpis([a, b]).bookings, 2);
  assert.equal(summariseDriverKpis([a, b]).length, 1);
  assert.equal(summariseDriverKpis([a, { ...a, driverKey: "OTHER_DRIVER" }]).length, 0);
});
test("policy can be configured and rejects invalid thresholds", () => {
  const policy = { ...DEFAULT_KPI_POLICY, version: "synthetic-v2", asapTargetSeconds: 600 };
  assert.equal(evaluateBookingKpis({ ...base, arrivedAt: at("06:06") }, now, policy).arrivalStatus, "LATE");
  assert.throws(() => evaluateBookingKpis(base, now, { ...policy, asapTargetSeconds: NaN }));
});

test("no fare waiting is a distinct terminal observation, never a completed boarding sample", () => {
  const result = evaluate({ status: "NO_FARE", arrivedAt: at("06:00"), noFareAt: at("06:05") });
  assert.equal(result.metrics.arrivalToNoFareSeconds, 300);
  assert.equal(result.metrics.arrivalToPobSeconds, null);
  assert.equal(summariseBookingKpis([result]).metrics.arrivalToNoFare.samples, 1);
});
