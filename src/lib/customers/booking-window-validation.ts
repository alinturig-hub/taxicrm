import { buildCustomerBookingWindow } from "./customer-booking-window";
import { BOOKING_PREDICTION_MODEL_VERSION, BOOKING_WINDOW_IMPLEMENTATION_REVISION } from "./booking-prediction-model";

const HOUR = 3_600_000;
const HORIZONS = [6, 12, 24, 48] as const;

export type ValidationCustomer = {
  /** Pseudonymous identifier; never included in the report. */
  key: string;
  safeForPersonalisation: boolean;
  bookedAt: string[];
};

export type ValidationInput = {
  dataKind: "SYNTHETIC" | "HISTORICAL";
  historyAvailableFrom: string;
  evaluationStart: string;
  /** End of verified ingestion coverage, NOT the last booking timestamp. */
  observedThrough: string;
  checkpointHours: number;
  customers: ValidationCustomer[];
};

type Evaluation = { score: number; positive: boolean };

function instant(value: string) {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error("Timestamps must include an explicit UTC offset");
  }
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error("Invalid timestamp");
  return result;
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

/** Fractional boundary ties prevent arbitrary customer ordering from improving metrics. */
function topFifth(rows: Evaluation[]) {
  const target = rows.length * 0.2;
  const ranked = [...rows].sort((a, b) => b.score - a.score);
  let selected = 0;
  let hits = 0;
  for (let offset = 0; offset < ranked.length && selected < target;) {
    let end = offset + 1;
    while (end < ranked.length && ranked[end].score === ranked[offset].score) end++;
    const size = end - offset;
    const take = Math.min(size, target - selected);
    const positive = ranked.slice(offset, end).filter((row) => row.positive).length;
    hits += positive * take / size;
    selected += take;
    offset = end;
  }
  return { selected, hits };
}

function summarize(rows: Evaluation[], selected: number, hits: number) {
  const positives = rows.filter((row) => row.positive).length;
  const baseRate = ratio(positives, rows.length);
  const precision = ratio(hits, selected);
  return {
    samples: rows.length,
    positives,
    baseRate,
    top20SelectedWeight: selected,
    top20HitsWeight: hits,
    top20Precision: precision,
    top20Recall: ratio(hits, positives),
    top20Lift: baseRate && precision !== null ? precision / baseRate : null,
    scoreBands: [0, 20, 40, 60, 80].map((minimum) => {
      const band = rows.filter((row) => row.score >= minimum && row.score < minimum + 20 + (minimum === 80 ? 1 : 0));
      const hitsInBand = band.filter((row) => row.positive).length;
      return { minimum, maximum: minimum + 20, samples: band.length, positives: hitsInBand, observedRate: ratio(hitsInBand, band.length) };
    }),
  };
}

/** Offline evaluation only: calls the model implementation in this checkout; never sends or persists. */
export function validateBookingWindows(input: ValidationInput, maximumForecasts = 100_000) {
  if (input.dataKind !== "SYNTHETIC" && input.dataKind !== "HISTORICAL") throw new Error("Explicit data kind is required");
  const historyStart = instant(input.historyAvailableFrom);
  const start = instant(input.evaluationStart);
  const end = instant(input.observedThrough);
  if (historyStart > start || start >= end) throw new Error("Invalid observation interval");
  if (!Number.isInteger(input.checkpointHours) || input.checkpointHours < 1 || input.checkpointHours > 168) {
    throw new Error("Checkpoint hours must be an integer from 1 to 168");
  }
  if (!Number.isInteger(maximumForecasts) || maximumForecasts < 1) throw new Error("Invalid forecast limit");
  const keys = new Set<string>();
  let duplicateActionsRemoved = 0;
  let excludedUnsafeProfiles = 0;
  const timelines: number[][] = [];
  for (const customer of input.customers) {
    if (!customer.key || keys.has(customer.key)) throw new Error("Customer keys must be unique and nonempty");
    keys.add(customer.key);
    if (typeof customer.safeForPersonalisation !== "boolean") throw new Error("Explicit profile safety is required");
    const actions = customer.bookedAt.map(instant);
    if (actions.some((value) => value < historyStart || value > end)) throw new Error("Action outside verified coverage");
    if (!customer.safeForPersonalisation) {
      excludedUnsafeProfiles++;
      continue;
    }
    const unique = Array.from(new Set(actions)).sort((a, b) => a - b);
    duplicateActionsRemoved += actions.length - unique.length;
    timelines.push(unique);
  }

  const buckets = HORIZONS.map((horizonHours) => ({
    horizonHours, model: [] as Evaluation[], frequency: [] as Evaluation[],
    selected: 0, modelHits: 0, frequencyHits: 0, censored: 0, learning: 0, slotsOutsideHorizon: 0,
  }));
  let forecasts = 0;
  let checkpoints = 0;
  // Scoring candidates share the same clock; dormant customers remain in the cohort.
  for (let cutoff = start; cutoff < end; cutoff += input.checkpointHours * HOUR) {
    checkpoints++;
    if (checkpoints > maximumForecasts) throw new Error("Evaluation limit exceeded; narrow the interval");
    const atCheckpoint = buckets.map(() => ({ model: [] as Evaluation[], frequency: [] as Evaluation[] }));
    for (const timeline of timelines) {
      const history = timeline.filter((time) => time <= cutoff);
      const available = buckets.some((bucket) => cutoff + bucket.horizonHours * HOUR <= end);
      if (!available) {
        buckets.forEach((bucket) => bucket.censored++);
        continue;
      }
      if (++forecasts > maximumForecasts) throw new Error("Evaluation limit exceeded; narrow the cohort or interval");
      const prediction = buildCustomerBookingWindow(history.map((time) => ({ bookedAtTime: new Date(time) })), { now: new Date(cutoff) });
      for (let index = 0; index < buckets.length; index++) {
        const bucket = buckets[index];
        const windowEnd = cutoff + bucket.horizonHours * HOUR;
        if (windowEnd > end) { bucket.censored++; continue; }
        if (prediction.status !== "READY") { bucket.learning++; continue; }
        const horizon = prediction.horizons.find((item) => item.horizonHours === bucket.horizonHours)!;
        const slot = horizon.strongestSlot;
        if (slot.historicalMatches > 0 && slot.startAt && slot.endAt &&
          (Date.parse(slot.startAt) < cutoff || Date.parse(slot.endAt) > windowEnd)) {
          bucket.slotsOutsideHorizon++;
        }
        // Label is future-only: (cutoff, windowEnd], including no-return negatives.
        const positive = timeline.some((time) => time > cutoff && time <= windowEnd);
        atCheckpoint[index].model.push({ score: horizon.score, positive });
        const recent = history.filter((time) => time > cutoff - 28 * 24 * HOUR).length;
        const exposureHours = Math.min(28 * 24, (cutoff - historyStart) / HOUR);
        const score = exposureHours > 0 ? 100 * (1 - Math.exp(-recent * bucket.horizonHours / exposureHours)) : 0;
        atCheckpoint[index].frequency.push({ score, positive });
      }
    }
    buckets.forEach((bucket, index) => {
      const batch = atCheckpoint[index];
      const modelTop = topFifth(batch.model);
      const baselineTop = topFifth(batch.frequency);
      bucket.model.push(...batch.model);
      bucket.frequency.push(...batch.frequency);
      bucket.selected += modelTop.selected;
      bucket.modelHits += modelTop.hits;
      bucket.frequencyHits += baselineTop.hits;
    });
  }
  return {
    dataKind: input.dataKind,
    model: BOOKING_PREDICTION_MODEL_VERSION,
    implementationRevision: BOOKING_WINDOW_IMPLEMENTATION_REVISION,
    target: "NEW_BOOKING_ACTION" as const,
    historyAvailableFrom: input.historyAvailableFrom,
    evaluationStart: input.evaluationStart,
    observedThrough: input.observedThrough,
    checkpointHours: input.checkpointHours,
    checkpoints,
    inputCustomers: input.customers.length,
    eligibleProfiles: timelines.length,
    excludedUnsafeProfiles,
    duplicateActionsRemoved,
    horizons: buckets.map((bucket) => ({
      horizonHours: bucket.horizonHours,
      censoredSnapshots: bucket.censored,
      learningSnapshots: bucket.learning,
      matchingSlotsOutsideHorizon: bucket.slotsOutsideHorizon,
      model: summarize(bucket.model, bucket.selected, bucket.modelHits),
      frequencyBaseline: summarize(bucket.frequency, bucket.selected, bucket.frequencyHits),
    })),
    limitations: [
      "Scores are ranking signals, not individual probabilities. Existing static calibration is not refitted or validated by this report.",
      "Top 20% is ranked separately at each checkpoint; boundary ties use fractional weights.",
      "Overlapping horizons and repeated customers are dependent observations; sample counts are not independent people.",
      "Coverage and historical identity safety must be verified externally; this input cannot prove complete ingestion or historical linkage.",
      "Historical timestamps alone do not prove point-in-time availability: backfilled bookings, later corrections and identity merges require a source audit.",
      "The target is a booking action, regardless of eventual completion, cancellation or no-fare; this does not predict completed rides or campaign uplift.",
    ],
  };
}
