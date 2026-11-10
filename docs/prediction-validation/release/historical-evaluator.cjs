"use strict";

// src/lib/customers/customer-identity.ts
function normalize(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}
function isSharedBookingPoint(bookings) {
  if (bookings.length < 20) return false;
  const pickupCounts = /* @__PURE__ */ new Map();
  const destinations = /* @__PURE__ */ new Set();
  for (const booking of bookings) {
    for (const location of booking.locations) {
      if (location.type === "PICKUP") {
        const key = normalize(location.zoneName || location.address);
        if (key) pickupCounts.set(key, (pickupCounts.get(key) ?? 0) + 1);
      } else if (location.type === "DESTINATION") {
        const key = normalize(location.address);
        if (key) destinations.add(key);
      }
    }
  }
  const topPickupCount = Math.max(0, ...Array.from(pickupCounts.values()));
  return topPickupCount / bookings.length >= 0.6 && destinations.size >= 10;
}

// src/lib/customers/booking-prediction-model.ts
var BOOKING_PREDICTION_MODEL_VERSION = "HAZARD_SLOT_V2";
var BOOKING_WINDOW_IMPLEMENTATION_REVISION = "BOUNDED_LONDON_SLOTS_2026_11_10";

// src/lib/customers/customer-booking-window.ts
var HOUR_MS = 60 * 60 * 1e3;
var MINIMUM_HISTORY = 5;
var HORIZONS = [
  6,
  12,
  24,
  48
];
var CALIBRATION = {
  6: [
    {
      minimumScore: 0,
      maximumScore: 20,
      observedRate: 9.92,
      samples: 4689
    },
    {
      minimumScore: 20,
      maximumScore: 40,
      observedRate: 22.86,
      samples: 2017
    },
    {
      minimumScore: 40,
      maximumScore: 60,
      observedRate: 44.86,
      samples: 292
    },
    {
      minimumScore: 60,
      maximumScore: 80,
      observedRate: 89.47,
      samples: 19
    },
    {
      minimumScore: 80,
      maximumScore: 101,
      observedRate: 89.47,
      samples: 19
    }
  ],
  12: [
    {
      minimumScore: 0,
      maximumScore: 20,
      observedRate: 17,
      samples: 3271
    },
    {
      minimumScore: 20,
      maximumScore: 40,
      observedRate: 31.19,
      samples: 2828
    },
    {
      minimumScore: 40,
      maximumScore: 60,
      observedRate: 50.9,
      samples: 831
    },
    {
      minimumScore: 60,
      maximumScore: 80,
      observedRate: 80.46,
      samples: 87
    },
    {
      minimumScore: 80,
      maximumScore: 101,
      observedRate: 80.46,
      samples: 87
    }
  ],
  24: [
    {
      minimumScore: 0,
      maximumScore: 20,
      observedRate: 31.85,
      samples: 1777
    },
    {
      minimumScore: 20,
      maximumScore: 40,
      observedRate: 44.09,
      samples: 2828
    },
    {
      minimumScore: 40,
      maximumScore: 60,
      observedRate: 57.57,
      samples: 2015
    },
    {
      minimumScore: 60,
      maximumScore: 80,
      observedRate: 75.57,
      samples: 397
    },
    {
      minimumScore: 80,
      maximumScore: 101,
      observedRate: 75.57,
      samples: 397
    }
  ],
  48: [
    {
      minimumScore: 0,
      maximumScore: 20,
      observedRate: 54.36,
      samples: 1102
    },
    {
      minimumScore: 20,
      maximumScore: 40,
      observedRate: 61.83,
      samples: 1792
    },
    {
      minimumScore: 40,
      maximumScore: 60,
      observedRate: 71.96,
      samples: 2850
    },
    {
      minimumScore: 60,
      maximumScore: 80,
      observedRate: 85.26,
      samples: 1269
    },
    {
      minimumScore: 80,
      maximumScore: 101,
      observedRate: 100,
      samples: 4
    }
  ]
};
var londonPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "long",
  hour: "2-digit",
  hour12: false
});
function timestamp(value) {
  if (!value) {
    return null;
  }
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}
function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort(
    (first, second) => first - second
  );
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
function londonSlot(value) {
  const parts = londonPartsFormatter.formatToParts(
    value
  );
  const weekday = parts.find(
    (part) => part.type === "weekday"
  )?.value ?? "Unknown";
  const rawHour = Number(
    parts.find(
      (part) => part.type === "hour"
    )?.value ?? 0
  );
  const hour = rawHour === 24 ? 0 : rawHour;
  return {
    key: [
      weekday,
      Math.floor(hour / 3) * 3
    ].join(":"),
    weekday,
    hour: Math.floor(hour / 3) * 3
  };
}
function gapHazard(history, now, horizonHours) {
  const gaps = history.slice(1).map(
    (value, index) => (value - history[index]) / HOUR_MS
  ).filter((value) => value > 0).slice(-20);
  const elapsedHours = (now - history[history.length - 1]) / HOUR_MS;
  const atRisk = gaps.filter(
    (gap) => gap > elapsedHours
  );
  const hits = atRisk.filter(
    (gap) => gap <= elapsedHours + horizonHours
  ).length;
  if (gaps.length < 4 || atRisk.length === 0) {
    return {
      score: 0,
      elapsedHours,
      medianGapHours: median(gaps),
      atRiskSamples: atRisk.length,
      matchingSamples: hits
    };
  }
  const probability = (hits + 1) / (atRisk.length + 2);
  const evidenceStrength = Math.min(
    1,
    atRisk.length / 8
  );
  return {
    score: Math.min(
      100,
      probability * 100 * (0.65 + evidenceStrength * 0.35)
    ),
    elapsedHours,
    medianGapHours: median(gaps),
    atRiskSamples: atRisk.length,
    matchingSamples: hits
  };
}
function weeklyWindow(history, now, horizonHours) {
  const counts = /* @__PURE__ */ new Map();
  for (const value of history) {
    const slot = londonSlot(
      new Date(value)
    );
    counts.set(
      slot.key,
      (counts.get(slot.key) ?? 0) + 1
    );
  }
  const windowEnd = now + horizonHours * HOUR_MS;
  const segments = [];
  for (let cursor = now; cursor < windowEnd; ) {
    const slot = londonSlot(new Date(cursor));
    const segmentEnd = Math.min(
      windowEnd,
      (Math.floor(cursor / HOUR_MS) + 1) * HOUR_MS
    );
    const previous = segments[segments.length - 1];
    if (previous?.key === slot.key) {
      previous.endAt = new Date(segmentEnd);
    } else {
      segments.push({
        key: slot.key,
        count: counts.get(slot.key) ?? 0,
        startAt: new Date(cursor),
        endAt: new Date(segmentEnd),
        weekday: slot.weekday,
        hour: slot.hour
      });
    }
    cursor = segmentEnd;
  }
  let best = null;
  for (const segment of segments) {
    if (segment.count > 0 && (!best || segment.count > best.count)) {
      best = segment;
    }
  }
  const share = best ? best.count / history.length : 0;
  return {
    score: Math.min(
      100,
      share * 200
    ),
    historicalMatches: best?.count ?? 0,
    sharePercent: round(share * 100),
    startAt: best?.startAt ?? null,
    endAt: best?.endAt ?? null,
    weekday: best?.weekday ?? null,
    hour: best?.hour ?? null
  };
}
function level(score) {
  if (score >= 60) {
    return "HIGH";
  }
  if (score >= 40) {
    return "ELEVATED";
  }
  if (score >= 20) {
    return "MODERATE";
  }
  return "LOW";
}
function calibration(horizon, score) {
  return CALIBRATION[horizon].find(
    (band) => score >= band.minimumScore && score < band.maximumScore
  ) ?? CALIBRATION[horizon][0];
}
function evidenceConfidence(historyCount, atRiskSamples, weeklyMatches) {
  return Math.round(
    Math.min(
      95,
      Math.min(
        40,
        historyCount * 2
      ) + Math.min(
        35,
        atRiskSamples * 5
      ) + Math.min(
        20,
        weeklyMatches * 4
      )
    )
  );
}
function buildCustomerBookingWindow(bookings, {
  now = /* @__PURE__ */ new Date(),
  profileSafeForPersonalisation = true
} = {}) {
  const nowTimestamp = now.getTime();
  const actions = Array.from(
    new Set(
      bookings.map(
        (booking) => timestamp(
          booking.bookedAtTime
        )
      ).filter(
        (value) => value !== null && value <= nowTimestamp
      )
    )
  ).sort(
    (first, second) => first - second
  );
  const leadMinutes = bookings.map((booking) => {
    const bookedAt = timestamp(
      booking.bookedAtTime
    );
    const pickupAt = timestamp(
      booking.pickupDueTime
    );
    return bookedAt !== null && bookedAt <= nowTimestamp && pickupAt !== null && pickupAt >= bookedAt ? (pickupAt - bookedAt) / 6e4 : null;
  }).filter(
    (value) => value !== null
  );
  const medianLeadMinutes = leadMinutes.length > 0 ? round(
    median(leadMinutes)
  ) : null;
  if (!profileSafeForPersonalisation) {
    return {
      status: "DISABLED",
      model: BOOKING_PREDICTION_MODEL_VERSION,
      analysedBookings: actions.length,
      primaryHorizonHours: 24,
      horizons: [],
      strongestUpcomingWindow: null,
      medianLeadMinutes,
      leadTimeSamples: leadMinutes.length,
      message: "Booking-window prediction is disabled for shared or non-individual profiles.",
      explanation: [
        "No individual prediction is produced because this profile may represent more than one person."
      ]
    };
  }
  if (actions.length < MINIMUM_HISTORY) {
    return {
      status: "LEARNING",
      model: BOOKING_PREDICTION_MODEL_VERSION,
      analysedBookings: actions.length,
      primaryHorizonHours: 24,
      horizons: [],
      strongestUpcomingWindow: null,
      medianLeadMinutes,
      leadTimeSamples: leadMinutes.length,
      message: "More booking history is required.",
      explanation: [
        `Only ${actions.length} booking actions are available; at least ${MINIMUM_HISTORY} are required.`
      ]
    };
  }
  const horizons = HORIZONS.map(
    (horizonHours) => {
      const hazard = gapHazard(
        actions,
        nowTimestamp,
        horizonHours
      );
      const weekly = weeklyWindow(
        actions,
        nowTimestamp,
        horizonHours
      );
      const score = round(
        hazard.score * 0.7 + weekly.score * 0.3
      );
      const benchmark = calibration(
        horizonHours,
        score
      );
      return {
        horizonHours,
        score,
        level: level(score),
        evidenceConfidence: evidenceConfidence(
          actions.length,
          hazard.atRiskSamples,
          weekly.historicalMatches
        ),
        observedBenchmarkRate: benchmark.observedRate,
        calibrationSamples: benchmark.samples,
        windowStartAt: now.toISOString(),
        windowEndAt: new Date(
          nowTimestamp + horizonHours * HOUR_MS
        ).toISOString(),
        gapHazardScore: round(hazard.score),
        weeklySlotScore: round(weekly.score),
        elapsedSinceLastHours: round(
          hazard.elapsedHours
        ),
        medianGapHours: round(
          hazard.medianGapHours
        ),
        atRiskSamples: hazard.atRiskSamples,
        strongestSlot: {
          startAt: weekly.startAt?.toISOString() ?? null,
          endAt: weekly.endAt?.toISOString() ?? null,
          weekday: weekly.weekday,
          hour: weekly.hour,
          historicalMatches: weekly.historicalMatches,
          sharePercent: weekly.sharePercent
        }
      };
    }
  );
  const primary = horizons.find(
    (item) => item.horizonHours === 24
  );
  const strongestUpcomingWindow = [...horizons].filter(
    (item) => item.strongestSlot.startAt !== null
  ).sort(
    (first, second) => second.score - first.score || first.horizonHours - second.horizonHours
  )[0]?.strongestSlot ?? null;
  return {
    status: "READY",
    model: BOOKING_PREDICTION_MODEL_VERSION,
    analysedBookings: actions.length,
    primaryHorizonHours: 24,
    primaryScore: primary?.score ?? 0,
    primaryLevel: primary?.level ?? "LOW",
    primaryObservedBenchmarkRate: primary?.observedBenchmarkRate ?? 0,
    primaryEvidenceConfidence: primary?.evidenceConfidence ?? 0,
    horizons,
    strongestUpcomingWindow,
    medianLeadMinutes,
    leadTimeSamples: leadMinutes.length,
    message: "The booking-action window combines conditional booking gaps with repeated London weekday and time patterns.",
    explanation: [
      "The primary operational window is the next 24 hours.",
      "Scores rank booking signals; evidence strength is not a probability. Historical benchmark rates have not been revalidated for the corrected windows or current customer population.",
      "The model uses booking timestamps only; it does not use protected locations, medical information, financial eligibility or inferred personal traits."
    ]
  };
}

// src/lib/customers/booking-window-validation.ts
var HOUR = 36e5;
var HORIZONS2 = [6, 12, 24, 48];
var VALIDATION_SEGMENTS = ["RECENT_60D", "IDLE_61_180D", "DORMANT_181D_PLUS"];
function createBuckets() {
  return HORIZONS2.map((horizonHours) => ({
    horizonHours,
    model: [],
    frequency: [],
    selected: 0,
    modelHits: 0,
    frequencyHits: 0,
    censored: 0,
    learning: 0,
    slotsOutsideHorizon: 0,
    evaluatedProfiles: /* @__PURE__ */ new Set(),
    positiveProfiles: /* @__PURE__ */ new Set()
  }));
}
function reportBuckets(buckets) {
  return buckets.map((bucket) => ({
    horizonHours: bucket.horizonHours,
    censoredSnapshots: bucket.censored,
    learningSnapshots: bucket.learning,
    matchingSlotsOutsideHorizon: bucket.slotsOutsideHorizon,
    evaluatedProfiles: bucket.evaluatedProfiles.size,
    positiveProfiles: bucket.positiveProfiles.size,
    model: summarize(bucket.model, bucket.selected, bucket.modelHits),
    frequencyBaseline: summarize(bucket.frequency, bucket.selected, bucket.frequencyHits)
  }));
}
function instant(value) {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error("Timestamps must include an explicit UTC offset");
  }
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error("Invalid timestamp");
  return result;
}
function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}
function topFifth(rows) {
  const target = rows.length * 0.2;
  const ranked = [...rows].sort((a, b) => b.score - a.score);
  let selected = 0;
  let hits = 0;
  for (let offset = 0; offset < ranked.length && selected < target; ) {
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
function summarize(rows, selected, hits) {
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
    })
  };
}
function validateBookingWindows(input, maximumForecasts = 1e5) {
  if (input.dataKind !== "SYNTHETIC" && input.dataKind !== "HISTORICAL") throw new Error("Explicit data kind is required");
  const historyStart = instant(input.historyAvailableFrom);
  const start = instant(input.evaluationStart);
  const end = instant(input.observedThrough);
  if (historyStart > start || start >= end) throw new Error("Invalid observation interval");
  if (!Number.isInteger(input.checkpointHours) || input.checkpointHours < 1 || input.checkpointHours > 168) {
    throw new Error("Checkpoint hours must be an integer from 1 to 168");
  }
  if (!Number.isInteger(maximumForecasts) || maximumForecasts < 1) throw new Error("Invalid forecast limit");
  const keys = /* @__PURE__ */ new Set();
  let duplicateActionsRemoved = 0;
  let excludedUnsafeProfiles = 0;
  let profilesWithAvailability = 0;
  let lateImportedActions = 0;
  const timelines = [];
  const overall = { buckets: createBuckets(), profiles: 0 };
  const groups = /* @__PURE__ */ new Map();
  for (const customer of input.customers) {
    if (!customer.key || keys.has(customer.key)) throw new Error("Customer keys must be unique and nonempty");
    keys.add(customer.key);
    if (typeof customer.safeForPersonalisation !== "boolean") throw new Error("Explicit profile safety is required");
    if (customer.segment !== void 0 && !VALIDATION_SEGMENTS.includes(customer.segment)) throw new Error("Invalid cohort segment");
    const actions = customer.bookedAt.map(instant);
    if (customer.availableAt && customer.availableAt.length !== actions.length) throw new Error("Availability must align with actions");
    const availability = customer.availableAt?.map(instant) ?? actions;
    if (actions.some((value) => value < historyStart || value > end)) throw new Error("Action outside verified coverage");
    if (!customer.safeForPersonalisation) {
      excludedUnsafeProfiles++;
      continue;
    }
    if (customer.availableAt) profilesWithAvailability++;
    const firstAvailable = /* @__PURE__ */ new Map();
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
  for (let cutoff = start; cutoff < end; cutoff += input.checkpointHours * HOUR) {
    checkpoints++;
    if (checkpoints > maximumForecasts) throw new Error("Evaluation limit exceeded; narrow the interval");
    const batches = new Map(evaluationGroups.map((group) => [
      group,
      group.buckets.map(() => ({ model: [], frequency: [] }))
    ]));
    for (let profileIndex = 0; profileIndex < timelines.length; profileIndex++) {
      const { events: timeline, segment } = timelines[profileIndex];
      const targets = segment ? [overall, groups.get(segment)] : [overall];
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
        if (windowEnd > end) {
          targets.forEach((group) => group.buckets[index].censored++);
          continue;
        }
        if (prediction.status !== "READY") {
          targets.forEach((group) => group.buckets[index].learning++);
          continue;
        }
        const horizon = prediction.horizons.find((item) => item.horizonHours === bucket.horizonHours);
        const slot = horizon.strongestSlot;
        if (slot.historicalMatches > 0 && slot.startAt && slot.endAt && (Date.parse(slot.startAt) < cutoff || Date.parse(slot.endAt) > windowEnd)) {
          targets.forEach((group) => group.buckets[index].slotsOutsideHorizon++);
        }
        const positive = timeline.some((row) => row.time > cutoff && row.time <= windowEnd);
        const recent = history.filter((time) => time > cutoff - 28 * 24 * HOUR).length;
        const exposureHours = Math.min(28 * 24, (cutoff - historyStart) / HOUR);
        const score = exposureHours > 0 ? 100 * (1 - Math.exp(-recent * bucket.horizonHours / exposureHours)) : 0;
        for (const group of targets) {
          batches.get(group)[index].model.push({ score: horizon.score, positive });
          batches.get(group)[index].frequency.push({ score, positive });
          group.buckets[index].evaluatedProfiles.add(profileIndex);
          if (positive) group.buckets[index].positiveProfiles.add(profileIndex);
        }
      }
    }
    evaluationGroups.forEach((group) => group.buckets.forEach((bucket, index) => {
      const batch = batches.get(group)[index];
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
    target: "NEW_BOOKING_ACTION",
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
      "The target is a booking action, regardless of eventual completion, cancellation or no-fare; this does not predict completed rides or campaign uplift."
    ]
  };
}

// src/lib/customers/prediction-historical-pilot.ts
function evaluateHistoricalPilot(envelope) {
  if (envelope.sourceDatabase !== "postgres" || envelope.sourceRole !== "cabby_ro" || envelope.readOnly !== "on") throw new Error("Invalid analytical source");
  if (!Number.isInteger(envelope.sourceRows) || envelope.sourceRows > 2e4 || envelope.sourceRows < 1) throw new Error("Invalid source size");
  if (!Number.isInteger(envelope.poolSize) || envelope.poolSize < 1 || envelope.poolSize > 2e3) throw new Error("Invalid pool size");
  if (!Array.isArray(envelope.customers) || envelope.customers.length > 100 || envelope.customers.length === 0) throw new Error("Invalid cohort");
  if (envelope.coverageStatus !== "CURRENT_SNAPSHOT_NOT_POINT_IN_TIME_AUDITED") throw new Error("Unexpected source coverage claim");
  if (envelope.samplingDesign !== void 0 && !["LEGACY_RANDOM_DAILY", "STRATIFIED_RECENCY_50_30_20_6H_V1"].includes(envelope.samplingDesign)) throw new Error("Unknown sampling design");
  if (envelope.samplingDesign === "STRATIFIED_RECENCY_50_30_20_6H_V1" && envelope.checkpointHours !== 6) throw new Error("Stratified design requires six-hour checkpoints");
  const snapshot = Date.parse(envelope.snapshotAt);
  if (!Number.isFinite(snapshot) || snapshot < Date.parse(envelope.observedThrough)) throw new Error("Snapshot precedes observation end");
  let profilesWithoutIdentityEvidence = 0;
  let sharedProfiles = 0;
  let rows = 0;
  const customers = envelope.customers.map((profile) => {
    if (!profile.availableAt || profile.availableAt.length !== profile.bookedAt.length || profile.availableAt.some((at) => Date.parse(at) > snapshot)) throw new Error("Invalid source availability");
    rows += profile.bookedAt.length;
    if (rows > 2e4) throw new Error("Too many source rows");
    const evidence = profile.identityHistory;
    if (!Array.isArray(evidence) || evidence.length > 2e4) throw new Error("Invalid identity evidence");
    const complete = evidence.filter(
      (booking) => booking.locations.some((item) => item.type === "PICKUP" && item.address) && booking.locations.some((item) => item.type === "DESTINATION" && item.address)
    ).length;
    const sufficient = evidence.length >= 5 && complete / evidence.length >= 0.8;
    const shared = isSharedBookingPoint(evidence);
    const start = Date.parse(envelope.evaluationStart);
    const known = profile.bookedAt.map((at, index) => ({ time: Date.parse(at), available: Date.parse(profile.availableAt[index]) })).filter((row) => row.time <= start && row.available <= start);
    if (known.length === 0) throw new Error("No known pre-period history");
    const lastKnown = Math.max(...known.map((row) => row.time));
    const segment = lastKnown >= start - 60 * 864e5 ? "RECENT_60D" : lastKnown >= start - 180 * 864e5 ? "IDLE_61_180D" : "DORMANT_181D_PLUS";
    if (profile.segment && profile.segment !== segment) throw new Error("Recency segment inconsistent with pre-period history");
    if (!sufficient) profilesWithoutIdentityEvidence++;
    if (shared) sharedProfiles++;
    return { key: profile.key, bookedAt: profile.bookedAt, availableAt: profile.availableAt, segment, safeForPersonalisation: sufficient && !shared };
  });
  if (rows !== envelope.sourceRows) throw new Error("Source row count mismatch");
  const report = validateBookingWindows({ ...envelope, customers }, 6e3);
  const compactHorizons = (horizons) => horizons.map((horizon) => ({
    hours: horizon.horizonHours,
    samples: horizon.model.samples,
    positives: horizon.model.positives,
    evaluatedProfiles: horizon.evaluatedProfiles,
    positiveProfiles: horizon.positiveProfiles,
    baseRate: horizon.model.baseRate,
    top20Precision: horizon.model.top20Precision,
    top20Recall: horizon.model.top20Recall,
    top20Lift: horizon.model.top20Lift,
    baselinePrecision: horizon.frequencyBaseline.top20Precision,
    baselineLift: horizon.frequencyBaseline.top20Lift,
    learningSnapshots: horizon.learningSnapshots,
    censoredSnapshots: horizon.censoredSnapshots,
    outsideHorizon: horizon.matchingSlotsOutsideHorizon
  }));
  return {
    state: "DIAGNOSTIC_ONLY_NOT_DEPLOYMENT_APPROVAL",
    dataKind: report.dataKind,
    model: report.model,
    implementationRevision: report.implementationRevision,
    samplingDesign: envelope.samplingDesign ?? "LEGACY_RANDOM_DAILY",
    checkpointHours: report.checkpointHours,
    source: { database: "postgres", role: "cabby_ro", readOnly: true, snapshotAt: new Date(snapshot).toISOString() },
    period: { evaluationStart: report.evaluationStart, observedThrough: report.observedThrough },
    cohort: { poolSize: envelope.poolSize, selectedProfiles: report.inputCustomers, evaluatedProfiles: report.eligibleProfiles, excludedProfiles: report.inputCustomers - report.eligibleProfiles, sharedProfiles, profilesWithoutIdentityEvidence, sourceRows: rows, lateImportedActionsInEvaluatedProfiles: report.lateImportedActions, duplicateActionsRemoved: report.duplicateActionsRemoved },
    dailyActivity: envelope.dailyActivity.map((day) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.day) || !Number.isInteger(day.bookings) || day.bookings < 0) throw new Error("Invalid daily count");
      return { day: day.day, bookings: day.bookings };
    }),
    horizons: compactHorizons(report.horizons),
    segments: report.segments.map((segment) => ({ segment: segment.segment, profiles: segment.profiles, horizons: compactHorizons(segment.horizons) })),
    limitations: [
      "Bounded pilot, not a full-population or independent calibration study; repeated customer snapshots are dependent.",
      "Diagnostic recency quotas do not represent population proportions. Segment ranks are evaluated separately; the design was revised after inspecting the initial pilot.",
      "Database creation times prevent training on rows not yet imported. Later timestamp corrections and identity merges cannot be reconstructed from this snapshot.",
      "Daily source activity is diagnostic and does not prove complete historical ingestion. Marketing permissions and sending remain separate.",
      "Missing-time/unlinked bookings are outside individual scoring. Location-evidence coverage is a conservative pilot filter, not a production rule change."
    ]
  };
}

// scripts/prediction-historical-pilot.ts
var import_node_worker_threads = require("node:worker_threads");
async function main() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 3e7) throw new Error("Source stream too large");
    chunks.push(buffer);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const result = await new Promise((resolve, reject) => {
    const worker = new import_node_worker_threads.Worker(__filename, { workerData: data, env: {}, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 128 } });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("Pilot computation exceeded 45 seconds"));
    }, 45e3);
    worker.once("message", (report) => {
      clearTimeout(timer);
      resolve(report);
    });
    worker.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Pilot worker failed"));
    });
    worker.once("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error("Pilot worker exited"));
      }
    });
  });
  console.log(JSON.stringify(result, null, 2));
}
if (!import_node_worker_threads.isMainThread) {
  import_node_worker_threads.parentPort.postMessage(evaluateHistoricalPilot(import_node_worker_threads.workerData));
} else main().catch(() => {
  console.error("HISTORICAL_PILOT_FAILED: source, size, timestamps or quality checks failed; no partial report emitted.");
  process.exitCode = 1;
});
