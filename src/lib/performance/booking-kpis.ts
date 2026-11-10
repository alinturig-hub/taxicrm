/** Source instants only. Never use webhook receipt time, GPS absence or import time. */
export type BookingMode = "ASAP" | "PREBOOK" | "UNKNOWN";
export type KpiPolicy = { version: string; asapTargetSeconds: number; prebookIdealLeadSeconds: number; prebookRequiredLeadSeconds: number; movementReviewSeconds: number; minProfileSamples: number };
export const DEFAULT_KPI_POLICY: Readonly<KpiPolicy> = Object.freeze({
  version: "pickup-service-v1",
  asapTargetSeconds: 15 * 60,
  prebookIdealLeadSeconds: 5 * 60,
  prebookRequiredLeadSeconds: 60,
  movementReviewSeconds: 5 * 60,
  minProfileSamples: 5,
});
export type BookingTiming = {
  provider: string;
  externalId: string;
  status: string;
  mode: BookingMode;
  requestedAt?: Date | null;
  dueAt?: Date | null;
  dispatchedAt?: Date | null;
  acceptedAt?: Date | null;
  arrivedAt?: Date | null;
  pobAt?: Date | null;
  noFareAt?: Date | null;
  // Set only from a versioned, customer-confirmed promise, not a changing live ETA.
  promisedArrivalAt?: Date | null;
  movement?: {
    firstConfirmedAt: Date;
    evidence: "ASSIGNMENT_SCOPED_TELEMETRY";
    readyToDepartAt: Date;
    context: "READY" | "PREVIOUS_TRIP" | "SCHEDULED_WAIT" | "UNKNOWN";
  } | null;
  assignment?: {
    provider: string;
    driverId: string;
    verified: boolean;
    from: Date;
    until?: Date | null;
  } | null;
};
export function explicitBookingMode(...values: Array<string | null | undefined>): BookingMode {
  const modes = new Set<BookingMode>();
  for (const raw of values) {
    const value = raw?.toUpperCase().replace(/[\s_-]/g, "");
    if (value === "ASAP") modes.add("ASAP");
    if (value === "PREBOOK" || value === "PREBOOKED") modes.add("PREBOOK");
  }
  return modes.size === 1 ? Array.from(modes)[0] : "UNKNOWN";
}
const valid = (value: Date | null | undefined): value is Date => value instanceof Date && Number.isFinite(value.getTime());
const seconds = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 1000;
export function evaluateBookingKpis(input: BookingTiming, now = new Date(), policy: KpiPolicy = DEFAULT_KPI_POLICY) {
  if (!valid(now) || !policy.version || !Number.isFinite(policy.asapTargetSeconds) || policy.asapTargetSeconds <= 0 ||
    !Number.isFinite(policy.prebookRequiredLeadSeconds) || policy.prebookRequiredLeadSeconds < 0 ||
    !Number.isFinite(policy.prebookIdealLeadSeconds) || policy.prebookIdealLeadSeconds < policy.prebookRequiredLeadSeconds ||
    !Number.isFinite(policy.movementReviewSeconds) || policy.movementReviewSeconds < 0 ||
    !Number.isInteger(policy.minProfileSamples) || policy.minProfileSamples < 1) throw Error("Invalid KPI policy or observation time.");
  const status = input.status.trim().toUpperCase();
  const issues: string[] = [];
  const read = (value: Date | null | undefined, label: string): Date | null => {
    if (value == null) return null;
    if (!valid(value)) { issues.push(`${label}:invalid_time`); return null; }
    if (value > now) { issues.push(`${label}:future_time`); return null; }
    return value;
  };
  const requested = read(input.requestedAt, "requested"),
    dispatched = read(input.dispatchedAt, "dispatched"),
    accepted = read(input.acceptedAt, "accepted"),
    arrived = read(input.arrivedAt, "arrived"), pob = read(input.pobAt, "pob");
  // Scheduled/promise deadlines may legitimately be in the future.
  const scheduled = valid(input.dueAt) ? input.dueAt : null;
  const promised = valid(input.promisedArrivalAt) ? input.promisedArrivalAt : null;
  if (input.dueAt != null && !scheduled) issues.push("due:invalid_time");
  if (input.promisedArrivalAt != null && !promised) issues.push("promise:invalid_time");
  const duration = (from: Date | null, to: Date | null, name: string): number | null => {
    if (!from || !to) return null;
    if (to < from) { issues.push(`${name}:reversed_time`); return null; }
    return seconds(from, to);
  };
  const requestToDispatch = duration(requested, dispatched, "request_to_dispatch");
  const dispatchToAccept = duration(dispatched, accepted, "dispatch_to_accept");
  const acceptToArrival = duration(accepted, arrived, "accept_to_arrival");
  const requestToArrival = duration(requested, arrived, "request_to_arrival");
  let arrivalToPob = duration(arrived, pob, "arrival_to_pob");
  // Contradictory upstream chronology is reviewable, not a zero-minute sample.
  const chain = [requested, dispatched, accepted, arrived, pob].filter((d): d is Date => d !== null);
  const chronological = chain.every((time, i) => !i || time >= chain[i - 1]);
  if (!chronological) issues.push("journey:inconsistent_order");
  const prebookScheduleValid = !!scheduled && (!requested || scheduled >= requested);
  if (input.mode === "PREBOOK" && !prebookScheduleValid) issues.push("schedule:missing_or_before_request");
  const promiseValid = !!promised && !!requested && promised >= requested;
  if (promised && !promiseValid) issues.push("promise:before_or_without_request");
  const deadline = input.mode === "ASAP"
    ? (input.promisedArrivalAt != null ? (promiseValid ? promised : null) : requested ? new Date(requested.getTime() + policy.asapTargetSeconds * 1000) : null)
    : input.mode === "PREBOOK" && prebookScheduleValid ? scheduled : null;
  let arrivalStatus: "UNKNOWN" | "IDEAL" | "ON_TIME" | "AT_DUE_WITHOUT_LEAD" | "LATE" = "UNKNOWN";
  let lateSeconds: number | null = null;
  if (arrived && deadline && chronological) {
    lateSeconds = Math.max(0, seconds(deadline, arrived));
    if (arrived > deadline) arrivalStatus = "LATE";
    else if (input.mode === "PREBOOK") {
      const lead = seconds(arrived, deadline);
      arrivalStatus = lead >= policy.prebookIdealLeadSeconds ? "IDEAL" : lead >= policy.prebookRequiredLeadSeconds ? "ON_TIME" : "AT_DUE_WITHOUT_LEAD";
    } else arrivalStatus = "ON_TIME";
  }
  // POB can be early. Do not call scheduled early waiting passenger lateness.
  let earlyArrivalWait: number | null = null, boardingAfterDue: number | null = null;
  if (!chronological || (input.mode === "PREBOOK" && !prebookScheduleValid)) arrivalToPob = null;
  if (arrivalToPob !== null && arrived && pob) {
    if (input.mode === "PREBOOK" && scheduled) {
      earlyArrivalWait = Math.max(0, seconds(arrived, new Date(Math.min(pob.getTime(), scheduled.getTime()))));
      boardingAfterDue = Math.max(0, seconds(new Date(Math.max(arrived.getTime(), scheduled.getTime())), pob));
    } else if (input.mode === "ASAP") {
      earlyArrivalWait = 0;
      boardingAfterDue = arrivalToPob;
    }
  }
  if (pob && (status === "NO_FARE" || status === "REJECTED" || status.startsWith("CANCELLED"))) {
    issues.push("pob:conflicts_with_terminal_outcome");
    arrivalToPob = null; earlyArrivalWait = null; boardingAfterDue = null;
  }
  const assignment = input.assignment;
  const driverTimes = [dispatched, accepted, arrived, pob].filter((d): d is Date => !!d);
  const driverAttributable = !!(assignment?.verified && assignment.driverId.trim() && assignment.provider === input.provider && valid(assignment.from) &&
    (!assignment.until || (valid(assignment.until) && assignment.until >= assignment.from)) && driverTimes.length && chronological &&
    driverTimes.every(d => d >= assignment.from && (!assignment.until || d <= assignment.until)));
  let acceptToMovement: number | null = null, movementReview: boolean | null = null;
  const movement = input.movement;
  if (movement && movement.evidence === "ASSIGNMENT_SCOPED_TELEMETRY" && driverAttributable && accepted) {
    const first = read(movement.firstConfirmedAt, "movement"), ready = read(movement.readyToDepartAt, "ready_to_depart");
    if (first && ready && first >= accepted && (!arrived || first <= arrived) && first >= assignment!.from && (!assignment!.until || first <= assignment!.until)) {
      acceptToMovement = duration(accepted, first, "accept_to_movement");
      if (movement.context === "READY" && ready >= accepted && ready <= first) movementReview = seconds(ready, first) >= policy.movementReviewSeconds;
    } else issues.push("movement:inconsistent_or_outside_assignment");
  }
  // No POB is a censored observation, never an invented completed wait.
  const noFare = read(input.noFareAt, "no_fare");
  const arrivalToNoFare = status === "NO_FARE" && chronological && !input.pobAt ? duration(arrived, noFare, "arrival_to_no_fare") : null;
  const waitingNowSeconds = arrived && !input.pobAt && chronological && !["COMPLETED", "NO_FARE", "CANCELLED", "REJECTED"].includes(status) && !status.startsWith("CANCELLED_")
    ? seconds(arrived, now) : null;
  return {
    policyVersion: policy.version, policy: { ...policy }, bookingKey: JSON.stringify([input.provider, input.externalId]),
    mode: input.mode, arrivalStatus, deadline: deadline?.toISOString() ?? null,
    deadlineBasis: input.mode === "ASAP" && input.promisedArrivalAt != null ? "CONFIRMED_PROMISE" : input.mode === "ASAP" ? "ASAP_SERVICE_TARGET" : input.mode === "PREBOOK" ? "SCHEDULED_PICKUP" : "UNKNOWN",
    lateSeconds, driverAttributable, driverKey: driverAttributable ? JSON.stringify([assignment!.provider, assignment!.driverId]) : null,
    // This flags a review; telemetry cannot prove intent or assign fault.
    movementReview, issues,
    metrics: {
      requestToDispatchSeconds: chronological ? requestToDispatch : null,
      dispatchToAcceptSeconds: chronological ? dispatchToAccept : null,
      acceptToArrivalSeconds: chronological ? acceptToArrival : null,
      requestToArrivalSeconds: chronological ? requestToArrival : null,
      acceptToMovementSeconds: acceptToMovement,
      arrivalToPobSeconds: arrivalToPob,
      earlyArrivalWaitSeconds: earlyArrivalWait,
      boardingAfterDueSeconds: boardingAfterDue,
      arrivalToNoFareSeconds: arrivalToNoFare,
      waitingNowSeconds,
    },
  };
}
export type BookingKpis = ReturnType<typeof evaluateBookingKpis>;
export function distribution(values: Array<number | null>) {
  const ordered = values.filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const n = ordered.length;
  return {
    samples: n,
    averageSeconds: n ? ordered.reduce((a, b) => a + b, 0) / n : null,
    medianSeconds: n ? n % 2 ? ordered[Math.floor(n / 2)] : (ordered[n / 2 - 1] + ordered[n / 2]) / 2 : null,
    p90Seconds: n ? ordered[Math.ceil(n * .9) - 1] : null,
  };
}
/** Deduplicate by provider + booking reference. Conflicting repeats are withheld. */
export function summariseBookingKpis(rows: BookingKpis[], policy: KpiPolicy = DEFAULT_KPI_POLICY) {
  const unique = new Map<string, BookingKpis>(), conflicts = new Set<string>();
  for (const row of rows) {
    const existing = unique.get(row.bookingKey);
    if (JSON.stringify(row.policy) !== JSON.stringify(policy) || row.policyVersion !== policy.version || (existing && JSON.stringify(existing) !== JSON.stringify(row))) conflicts.add(row.bookingKey);
    else unique.set(row.bookingKey, row);
  }
  const selected = Array.from(unique.values()).filter(row => !conflicts.has(row.bookingKey));
  const outcomes = { ideal: 0, onTime: 0, atDueWithoutLead: 0, late: 0, unknown: 0 };
  for (const row of selected) outcomes[({ IDEAL: "ideal", ON_TIME: "onTime", AT_DUE_WITHOUT_LEAD: "atDueWithoutLead", LATE: "late", UNKNOWN: "unknown" } as const)[row.arrivalStatus]]++;
  const eligible = selected.length - outcomes.unknown;
  const metrics = {
    requestToDispatch: distribution(selected.map(r => r.metrics.requestToDispatchSeconds)),
    acceptToArrival: distribution(selected.map(r => r.metrics.acceptToArrivalSeconds)),
    earlyScheduledWait: distribution(selected.map(r => r.metrics.earlyArrivalWaitSeconds)),
    lateness: distribution(selected.map(r => r.lateSeconds)),
    requestToArrival: distribution(selected.map(r => r.metrics.requestToArrivalSeconds)),
    dispatchToAccept: distribution(selected.map(r => r.metrics.dispatchToAcceptSeconds)),
    acceptToMovement: distribution(selected.map(r => r.driverAttributable ? r.metrics.acceptToMovementSeconds : null)),
    arrivalToPob: distribution(selected.map(r => r.metrics.arrivalToPobSeconds)),
    arrivalToNoFare: distribution(selected.map(r => r.metrics.arrivalToNoFareSeconds)),
    boardingAfterDue: distribution(selected.map(r => r.metrics.boardingAfterDueSeconds)),
  };
  const byMode = (["ASAP", "PREBOOK", "UNKNOWN"] as const).map(mode => {
    const cohort = selected.filter(row => row.mode === mode);
    const measurable = cohort.filter(row => row.arrivalStatus !== "UNKNOWN");
    return {
      mode, bookings: cohort.length, arrivalSamples: measurable.length,
      onTimeRate: measurable.length ? measurable.filter(row => row.arrivalStatus !== "LATE").length / measurable.length * 100 : null
    };
  });
  return {
    policyVersion: policy.version, byMode, bookings: selected.length, conflictingBookings: conflicts.size, outcomes,
    arrivalSamples: eligible, onTimeRate: eligible ? (outcomes.ideal + outcomes.onTime + outcomes.atDueWithoutLead) / eligible * 100 : null,
    advanceTargetRate: eligible ? (outcomes.ideal + outcomes.onTime) / eligible * 100 : null,
    driverAttributedBookings: selected.filter(r => r.driverAttributable).length,
    movementReviewSamples: selected.filter(r => r.movementReview !== null).length,
    movementReviews: selected.filter(r => r.movementReview === true).length,
    metrics,
    boardingProfileStatus: metrics.boardingAfterDue.samples >= policy.minProfileSamples ? "OBSERVED_SAMPLE" as const : "INSUFFICIENT_DATA" as const,
  };
}

/** Attributed observations are not fault scores; never group on badge/name alone. */
export function summariseDriverKpis(rows: BookingKpis[], policy: KpiPolicy = DEFAULT_KPI_POLICY) {
  const groups = new Map<string, BookingKpis[]>();
  const variants = new Map<string, Set<string>>();
  for (const row of rows) variants.set(row.bookingKey, new Set([...Array.from(variants.get(row.bookingKey) ?? []), JSON.stringify(row)]));
  for (const row of rows) {
    if ((variants.get(row.bookingKey)?.size ?? 0) > 1) continue;
    if (!row.driverAttributable || !row.driverKey) continue;
    groups.set(row.driverKey, [...(groups.get(row.driverKey) ?? []), row]);
  }
  return Array.from(groups, ([driverKey, bookings]) => ({ driverKey, ...summariseBookingKpis(bookings, policy) }));
}
