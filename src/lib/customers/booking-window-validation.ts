import { buildCustomerBookingWindow } from "./customer-booking-window";
import { BOOKING_PREDICTION_MODEL_VERSION, BOOKING_WINDOW_IMPLEMENTATION_REVISION } from "./booking-prediction-model";

const HOUR = 3_600_000;
const HORIZONS = [6, 12, 24, 48] as const;
export const VALIDATION_SEGMENTS = ["RECENT_60D", "IDLE_61_180D", "DORMANT_181D_PLUS"] as const;
export type ValidationSegment = typeof VALIDATION_SEGMENTS[number];

export type ValidationCustomer = {
  /** Pseudonymous identifier; never included in the report. */
  key: string;
  safeForPersonalisation: boolean;
  bookedAt: string[];
  /** First database availability, aligned with bookedAt. Omit only for synthetic/assumed histories. */
  availableAt?: string[];
  segment?: ValidationSegment;
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

function createBuckets() {
  return HORIZONS.map((horizonHours) => ({
    horizonHours, model: [] as Evaluation[], frequency: [] as Evaluation[],
    selected: 0, modelHits: 0, frequencyHits: 0, censored: 0, learning: 0, slotsOutsideHorizon: 0,
    evaluatedProfiles: new Set<number>(), positiveProfiles: new Set<number>(),
  }));
}
type Buckets = ReturnType<typeof createBuckets>;
function reportBuckets(buckets: Buckets) {
  return buckets.map((bucket) => ({
    horizonHours: bucket.horizonHours, censoredSnapshots: bucket.censored,
    learningSnapshots: bucket.learning, matchingSlotsOutsideHorizon: bucket.slotsOutsideHorizon,
    evaluatedProfiles: bucket.evaluatedProfiles.size, positiveProfiles: bucket.positiveProfiles.size,
    model: summarize(bucket.model, bucket.selected, bucket.modelHits),
    frequencyBaseline: summarize(bucket.frequency, bucket.selected, bucket.frequencyHits),
  }));
}
type EvaluationGroup = { buckets: Buckets; profiles: number };

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
  let profilesWithAvailability = 0;
  let lateImportedActions = 0;
  const timelines: Array<{ events: Array<{ time: number; available: number }>; segment?: ValidationSegment }> = [];
  const overall: EvaluationGroup = { buckets: createBuckets(), profiles: 0 };
  const groups = new Map<ValidationSegment, EvaluationGroup>();
  for (const customer of input.customers) {
    if (!customer.key || keys.has(customer.key)) throw new Error("Customer keys must be unique and nonempty");
    keys.add(customer.key);
    if (typeof customer.safeForPersonalisation !== "boolean") throw new Error("Explicit profile safety is required");
    if (customer.segment !== undefined && !VALIDATION_SEGMENTS.includes(customer.segment)) throw new Error("Invalid cohort segment");
    const actions = customer.bookedAt.map(instant);
    if (customer.availableAt && customer.availableAt.length !== actions.length) throw new Error("Availability must align with actions");
    const availability = customer.availableAt?.map(instant) ?? actions;
    if (actions.some((value) => value < historyStart || value > end)) throw new Error("Action outside verified coverage");
    if (!customer.safeForPersonalisation) {
      excludedUnsafeProfiles++;
      continue;
    }
    if (customer.availableAt) profilesWithAvailability++;
    const firstAvailable = new Map<number, number>();
    actions.forEach((time, index) => {
      const available = availability[index];
      firstAvailable.set(time, Math.min(firstAvailable.get(time) ?? available, available));
    });
    const unique = Array.from(firstAvailable, ([time, available]) => ({ time, available })).sort((a, b) => a.time - b.time);
    lateImportedActions += unique.filter((row) => row.available > row.time + 24 * HOUR).length;
    duplicateActionsRemoved += actions.length - unique.length;
    timelines.push({ events: unique, segment: customer.segment });
    overall.profiles++;
    if (customer.segment) {
      const group = groups.get(customer.segment) ?? { buckets: createBuckets(), profiles: 0 };
      group.profiles++;
      groups.set(customer.segment, group);
    }
  }

  const evaluationGroups = [overall, ...Array.from(groups.values())];
  let forecasts = 0;
  let checkpoints = 0;
  // Scoring candidates share the same clock; dormant customers remain in the cohort.
  for (let cutoff = start; cutoff < end; cutoff += input.checkpointHours * HOUR) {
    checkpoints++;
    if (checkpoints > maximumForecasts) throw new Error("Evaluation limit exceeded; narrow the interval");
    const batches = new Map(evaluationGroups.map((group) => [group,
      group.buckets.map(() => ({ model: [] as Evaluation[], frequency: [] as Evaluation[] })),
    ]));
    for (let profileIndex = 0; profileIndex < timelines.length; profileIndex++) {
      const { events: timeline, segment } = timelines[profileIndex];
      const targets = segment ? [overall, groups.get(segment)!] : [overall];
      const history = timeline.filter((row) => row.time <= cutoff && row.available <= cutoff).map((row) => row.time);
      const available = overall.buckets.some((bucket) => cutoff + bucket.horizonHours * HOUR <= end);
      if (!available) {
        targets.forEach((group) => group.buckets.forEach((bucket) => bucket.censored++));
        continue;
      }
      if (++forecasts > maximumForecasts) throw new Error("Evaluation limit exceeded; narrow the cohort or interval");
      const prediction = buildCustomerBookingWindow(history.map((time) => ({ bookedAtTime: new Date(time) })), { now: new Date(cutoff) });
      for (let index = 0; index < overall.buckets.length; index++) {
        const bucket = overall.buckets[index];
        const windowEnd = cutoff + bucket.horizonHours * HOUR;
        if (windowEnd > end) { targets.forEach((group) => group.buckets[index].censored++); continue; }
        if (prediction.status !== "READY") { targets.forEach((group) => group.buckets[index].learning++); continue; }
        const horizon = prediction.horizons.find((item) => item.horizonHours === bucket.horizonHours)!;
        const slot = horizon.strongestSlot;
        if (slot.historicalMatches > 0 && slot.startAt && slot.endAt &&
          (Date.parse(slot.startAt) < cutoff || Date.parse(slot.endAt) > windowEnd)) {
          targets.forEach((group) => group.buckets[index].slotsOutsideHorizon++);
        }
        // Label is future-only: (cutoff, windowEnd], including no-return negatives.
        const positive = timeline.some((row) => row.time > cutoff && row.time <= windowEnd);
        const recent = history.filter((time) => time > cutoff - 28 * 24 * HOUR).length;
        const exposureHours = Math.min(28 * 24, (cutoff - historyStart) / HOUR);
        const score = exposureHours > 0 ? 100 * (1 - Math.exp(-recent * bucket.horizonHours / exposureHours)) : 0;
        for (const group of targets) {
          batches.get(group)![index].model.push({ score: horizon.score, positive });
          batches.get(group)![index].frequency.push({ score, positive });
          group.buckets[index].evaluatedProfiles.add(profileIndex);
          if (positive) group.buckets[index].positiveProfiles.add(profileIndex);
        }
      }
    }
    evaluationGroups.forEach((group) => group.buckets.forEach((bucket, index) => {
      const batch = batches.get(group)![index];
      const modelTop = topFifth(batch.model);
      const baselineTop = topFifth(batch.frequency);
      bucket.model.push(...batch.model);
      bucket.frequency.push(...batch.frequency);
      bucket.selected += modelTop.selected;
      bucket.modelHits += modelTop.hits;
      bucket.frequencyHits += baselineTop.hits;
    }));
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
    profilesWithAvailability,
    profilesWithAssumedAvailability: timelines.length - profilesWithAvailability,
    lateImportedActions,
    horizons: reportBuckets(overall.buckets),
    segments: VALIDATION_SEGMENTS.flatMap((segment) => {
      const group = groups.get(segment);
      return group ? [{ segment, profiles: group.profiles, horizons: reportBuckets(group.buckets) }] : [];
    }),
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
