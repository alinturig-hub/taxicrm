import { buildBookingFrequencyReference } from "./booking-frequency-reference";

export type BookingWindowBooking = {
  bookedAtTime?: Date | string | null;
  pickupDueTime?: Date | string | null;
  createdAt?: Date | string | null;
};
const SOURCE_START = new Date("2018-08-10T00:00:00Z");
const HOUR = 3_600_000;
function time(value: Date | string | null | undefined) {
  const parsed = value instanceof Date ? value.getTime() : value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}
function level(score: number) {
  return score >= 60 ? "HIGH" as const : score >= 40 ? "ELEVATED" as const : score >= 20 ? "MODERATE" as const : "LOW" as const;
}

/** Live contract adapter. Frequency ranks actions; it does not estimate an exact
 * booking time or reuse the old model's calibration as a new probability. */
export function buildCustomerBookingWindow(bookings: BookingWindowBooking[], {
  now = new Date(), profileSafeForPersonalisation = true,
}: { now?: Date; profileSafeForPersonalisation?: boolean } = {}) {
  const reference = buildBookingFrequencyReference(bookings.map((booking) => ({
    bookedAtTime: booking.bookedAtTime ?? null, availableAt: booking.createdAt ?? null,
  })), { now, historyAvailableFrom: SOURCE_START, profileSafeForPersonalisation });
  const known = bookings.filter((booking) => {
    const action = time(booking.bookedAtTime), available = time(booking.createdAt);
    return action !== null && available !== null && action <= now.getTime() && available <= now.getTime() && action >= SOURCE_START.getTime();
  });
  const actions = Array.from(new Set(known.map((booking) => time(booking.bookedAtTime)!))).sort((a, b) => a - b);
  const gaps = actions.slice(1).map((at, index) => (at - actions[index]) / HOUR);
  const leadMinutes = known.flatMap((booking) => {
    const booked = time(booking.bookedAtTime)!, pickup = time(booking.pickupDueTime);
    return pickup !== null && pickup >= booked ? [(pickup - booked) / 60_000] : [];
  });
  const horizons = reference.horizons.map((item) => ({
    horizonHours: item.hours, score: Math.round(item.rankingScore * 100) / 100, level: level(item.rankingScore),
    evidenceConfidence: 0, observedBenchmarkRate: null, calibrationSamples: 0,
    windowStartAt: item.windowStartAt, windowEndAt: item.windowEndAt,
    gapHazardScore: 0, weeklySlotScore: 0, elapsedSinceLastHours: reference.recencyHours ?? 0,
    medianGapHours: median(gaps) ?? 0, atRiskSamples: 0,
    strongestSlot: { startAt: null, endAt: null, weekday: null, hour: null, historicalMatches: 0, sharePercent: 0 },
  }));
  const primary = horizons.find((item) => item.horizonHours === 24);
  return {
    status: reference.status, model: reference.model, analysedBookings: reference.knownActionCount,
    primaryHorizonHours: 24, primaryScore: primary?.score ?? 0, primaryLevel: primary?.level ?? "LOW" as const,
    primaryObservedBenchmarkRate: null, primaryEvidenceConfidence: 0,
    horizons, strongestUpcomingWindow: null, medianLeadMinutes: median(leadMinutes), leadTimeSamples: leadMinutes.length,
    frequencyEvidence: { recent7: reference.recent7, recent14: reference.recent14, recent28: reference.recent28, recencyHours: reference.recencyHours, unknownAvailabilityRows: reference.unknownAvailabilityRows, invalidRows: reference.invalidRows },
    message: reference.status === "DISABLED" ? "Individual ranking is disabled for shared or non-individual profiles."
      : reference.status === "LEARNING" ? "At least five known booking actions with import timestamps are needed."
      : "Booking activity in the last 28 days provides a ranking signal. This is not a calibrated probability or an exact booking-time prediction.",
    explanation: [
      "Counts include distinct booking actions already available at calculation time; completed-trip retention is tracked separately.",
      "Seven- and fourteen-day counts and time since the last action are descriptive context, not additional tuned weights.",
      "The source history begins on 10 August 2018 as verified in the source inventory; recent-frequency exposure is capped at 28 days.",
      "No calibrated benchmark or specific time slot is available for this model. Legacy model history remains separate.",
    ],
  };
}
