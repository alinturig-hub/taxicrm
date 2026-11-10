const HOUR = 3_600_000;
export const FREQUENCY_REFERENCE_VERSION = "FREQUENCY_REFERENCE_V1";
type Instant = string | Date | null;
export type ReferenceBooking = { bookedAtTime: Instant; availableAt: Instant };
function timestamp(value: Instant) {
  if (!value) return null;
  if (typeof value === "string" && !/(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** Pure calculator. Same 28-day frequency comparator as the historical
 * diagnostic; recency is explained, not multiplied by an invented extra weight.
 * It produces ranking indices, never calibrated individual probabilities. */
export function buildBookingFrequencyReference(rows: ReferenceBooking[], options: {
  now: Date; historyAvailableFrom: Date; profileSafeForPersonalisation: boolean;
}) {
  const now = options.now.getTime();
  const coverageStart = options.historyAvailableFrom.getTime();
  if (!Number.isFinite(now) || !Number.isFinite(coverageStart) || coverageStart >= now) throw new Error("Invalid observation coverage");
  const actions = new Map<number, number>();
  let invalidRows = 0;
  let unknownAvailabilityRows = 0;
  let duplicateTimestamps = 0;
  for (const row of rows) {
    const action = timestamp(row.bookedAtTime);
    const available = timestamp(row.availableAt);
    if (action === null) { invalidRows++; continue; }
    if (available === null) { unknownAvailabilityRows++; continue; }
    if (actions.has(action)) duplicateTimestamps++;
    actions.set(action, Math.min(actions.get(action) ?? available, available));
  }
  const known = Array.from(actions, ([action, available]) => ({ action, available }))
    .filter((row) => row.action >= coverageStart && row.action <= now && row.available <= now)
    .map((row) => row.action).sort((a, b) => a - b);
  const countWithin = (days: number) => known.filter((action) => action > now - days * 24 * HOUR).length;
  const recent28 = countWithin(28);
  const exposureHours = Math.min(28 * 24, (now - coverageStart) / HOUR);
  const status = !options.profileSafeForPersonalisation ? "DISABLED" as const : known.length < 5 ? "LEARNING" as const : "READY" as const;
  return {
    model: FREQUENCY_REFERENCE_VERSION, status, generatedAt: options.now.toISOString(),
    historyAvailableFrom: options.historyAvailableFrom.toISOString(),
    knownActionCount: known.length,
    recencyHours: known.length > 0 ? (now - known[known.length - 1]) / HOUR : null,
    recent7: countWithin(7), recent14: countWithin(14), recent28,
    exposureHours, invalidRows, unknownAvailabilityRows, duplicateTimestamps,
    horizons: status !== "READY" ? [] : [6, 12, 24, 48].map((hours) => ({
      hours, windowStartAt: options.now.toISOString(), windowEndAt: new Date(now + hours * HOUR).toISOString(),
      rankingScore: 100 * (1 - Math.exp(-recent28 * hours / exposureHours)),
    })),
    method: "Count distinct, already-known booking actions in (now - 28 days, now], adjusted only for available source coverage. Recency and 7/14-day counts are descriptive evidence, not additional fitted weights.",
    limitations: "Uncalibrated ranking: no exact booking-time estimate, completed-ride prediction or demonstrated retention uplift. Marketing permissions remain separate.",
  };
}
