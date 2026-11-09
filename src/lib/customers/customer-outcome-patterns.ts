export type OutcomeJourney = {
  id: string;
  status: string;
  bookedAtTime: Date | null;
  pickupDueTime: Date | null;
  dispatchedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  noFareAt: Date | null;
};

function time(value: Date | null): number | null {
  if (!value || !Number.isFinite(value.getTime())) return null;
  return value.getTime();
}
function medianMinutes(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round((sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) / 60_000);
}

/** Describes current recorded outcomes; it does not infer motive or predict no-shows. */
export function buildOutcomePatterns(rows: OutcomeJourney[], now: Date) {
  const nowMs = time(now);
  if (nowMs === null) throw new Error("Invalid observation time");
  const ids = new Set<string>();
  let completed = 0, cancelled = 0, noFare = 0, undated = 0, excludedFuture = 0, afterPickup = 0;
  const afterBooking: number[] = [], afterDispatch: number[] = [], beforePickup: number[] = [];
  for (const row of rows) {
    if (!row.id || ids.has(row.id)) throw new Error("Journey IDs must be unique");
    ids.add(row.id);
    const status = row.status.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (!["COMPLETED", "CANCELLED", "NO_FARE"].includes(status)) continue;
    const booked = time(row.bookedAtTime);
    const event = time(status === "COMPLETED" ? row.completedAt : status === "CANCELLED" ? row.cancelledAt : row.noFareAt);
    if ((booked !== null && booked > nowMs) || (event !== null && event > nowMs)) { excludedFuture++; continue; }
    if (booked === null && event === null) { undated++; continue; }
    if (status === "COMPLETED") { completed++; continue; }
    if (status === "NO_FARE") { noFare++; continue; }
    cancelled++;
    if (event === null) continue;
    const dispatch = time(row.dispatchedAt), pickup = time(row.pickupDueTime);
    if (booked !== null && event >= booked) afterBooking.push(event - booked);
    if (dispatch !== null && event >= dispatch && (booked === null || dispatch >= booked)) afterDispatch.push(event - dispatch);
    if (pickup !== null && (booked === null || event >= booked)) {
      if (event <= pickup) beforePickup.push(pickup - event);
      else afterPickup++;
    }
  }
  const total = completed + cancelled + noFare;
  const pct = (n: number) => total ? Number((100 * n / total).toFixed(1)) : null;
  return {
    observedAt: now.toISOString(), completed, cancelled, noFare, total,
    cancellationPercent: pct(cancelled), noFarePercent: pct(noFare),
    afterBookingMedianMinutes: medianMinutes(afterBooking), afterBookingSamples: afterBooking.length,
    afterDispatchMedianMinutes: medianMinutes(afterDispatch), afterDispatchSamples: afterDispatch.length,
    beforePickupMedianMinutes: medianMinutes(beforePickup), beforePickupSamples: beforePickup.length,
    cancellationAfterPickupCount: afterPickup, undatedExcluded: undated, futureExcluded: excludedFuture,
  };
}
export function outcomePatternsForProfile(rows: OutcomeJourney[], identityType: string, now: Date) {
  return identityType === "SHARED_BOOKING_POINT" ? null : buildOutcomePatterns(rows, now);
}
