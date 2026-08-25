type BookingAction = {
  customerId: string;
  bookedAtTime: Date;
};

type SignalName =
  | "CADENCE"
  | "WEEKLY_SLOT"
  | "GAP_HAZARD"
  | "COMBINED"
  | "HAZARD_SLOT";

type Evaluation = {
  score: number;
  positive: boolean;
};

type SignalMetrics = {
  signal: SignalName;
  samples: number;
  positives: number;
  baseRate: number;
  top20Samples: number;
  top20Hits: number;
  top20Precision: number;
  top20Recall: number;
  top20Lift: number;
  calibrationBands: Array<{
    minimumScore: number;
    maximumScore: number;
    samples: number;
    positives: number;
    observedRate: number;
  }>;
};

type HorizonResult = {
  horizonHours: number;
  signals: SignalMetrics[];
};

const CHECKPOINT_HOURS = 6;
const MINIMUM_HISTORY = 5;
const RECENT_GAP_LIMIT = 10;
const HOUR_MS = 60 * 60 * 1000;

const londonPartsFormatter =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });

function round(
  value: number,
  decimals = 2,
) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) /
    factor;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort(
    (first, second) =>
      first - second,
  );

  const middle =
    Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (
        sorted[middle - 1] +
        sorted[middle]
      ) / 2
    : sorted[middle];
}

function londonWeeklySlot(
  value: Date,
) {
  const parts =
    londonPartsFormatter.formatToParts(
      value,
    );

  const weekday =
    parts.find(
      (part) =>
        part.type === "weekday",
    )?.value ?? "Unknown";

  const rawHour = Number(
    parts.find(
      (part) => part.type === "hour",
    )?.value ?? 0,
  );

  const hour =
    rawHour === 24 ? 0 : rawHour;

  return [
    weekday,
    Math.floor(hour / 3) * 3,
  ].join(":");
}

function cadenceScore(
  history: number[],
  cutoff: number,
) {
  const gaps = history
    .slice(1)
    .map(
      (value, index) =>
        (
          value -
          history[index]
        ) / HOUR_MS,
    )
    .filter((value) => value > 0)
    .slice(-RECENT_GAP_LIMIT);

  const medianGap = median(gaps);

  if (medianGap <= 0) {
    return 0;
  }

  const deviations = gaps.map(
    (gap) =>
      Math.abs(gap - medianGap),
  );

  const regularity = Math.max(
    0,
    1 -
      Math.min(
        median(deviations) /
          medianGap,
        1,
      ),
  );

  const elapsed =
    (
      cutoff -
      history[history.length - 1]
    ) / HOUR_MS;

  const distance =
    Math.abs(
      elapsed - medianGap,
    );

  const proximity = Math.max(
    0,
    1 -
      distance /
        Math.max(
          medianGap * 1.5,
          CHECKPOINT_HOURS,
        ),
  );

  const sampleStrength =
    Math.min(
      1,
      gaps.length / 8,
    );

  return Math.min(
    100,
    proximity * 70 +
      regularity * 20 +
      sampleStrength * 10,
  );
}

function gapHazardScore(
  history: number[],
  cutoff: number,
  horizonHours: number,
) {
  const gaps = history
    .slice(1)
    .map(
      (value, index) =>
        (
          value -
          history[index]
        ) / HOUR_MS,
    )
    .filter((value) => value > 0)
    .slice(-20);

  if (gaps.length < 4) {
    return 0;
  }

  const elapsed =
    (
      cutoff -
      history[history.length - 1]
    ) / HOUR_MS;

  const atRisk = gaps.filter(
    (gap) => gap > elapsed,
  );

  const hits = atRisk.filter(
    (gap) =>
      gap <=
      elapsed + horizonHours,
  ).length;

  if (atRisk.length === 0) {
    return 0;
  }

  const probability =
    (hits + 1) /
    (atRisk.length + 2);

  const evidenceStrength =
    Math.min(
      1,
      atRisk.length / 8,
    );

  return Math.min(
    100,
    probability *
      100 *
      (
        0.65 +
        evidenceStrength * 0.35
      ),
  );
}

function weeklySlotScore(
  history: number[],
  cutoff: number,
  horizonHours: number,
) {
  const counts =
    new Map<string, number>();

  for (const timestamp of history) {
    const slot =
      londonWeeklySlot(
        new Date(timestamp),
      );

    counts.set(
      slot,
      (counts.get(slot) ?? 0) + 1,
    );
  }

  let strongestShare = 0;

  for (
    let offset = 0;
    offset <= horizonHours;
    offset += 1
  ) {
    const slot =
      londonWeeklySlot(
        new Date(
          cutoff +
            offset * HOUR_MS,
        ),
      );

    strongestShare = Math.max(
      strongestShare,
      (counts.get(slot) ?? 0) /
        history.length,
    );
  }

  return Math.min(
    100,
    strongestShare * 200,
  );
}

function metrics(
  signal: SignalName,
  evaluations: Evaluation[],
): SignalMetrics {
  const samples = evaluations.length;

  const positives =
    evaluations.filter(
      (item) => item.positive,
    ).length;

  const ranked = [...evaluations].sort(
    (first, second) =>
      second.score - first.score,
  );

  const top20Samples =
    samples === 0
      ? 0
      : Math.max(
          1,
          Math.ceil(samples * 0.2),
        );

  const top =
    ranked.slice(0, top20Samples);

  const top20Hits =
    top.filter(
      (item) => item.positive,
    ).length;

  const baseRate =
    samples === 0
      ? 0
      : positives / samples;

  const calibrationBands = [
    [0, 20],
    [20, 40],
    [40, 60],
    [60, 80],
    [80, 100],
  ].map(
    ([minimumScore, maximumScore]) => {
      const band =
        evaluations.filter(
          (item) =>
            item.score >= minimumScore &&
            (
              maximumScore === 100
                ? item.score <=
                  maximumScore
                : item.score <
                  maximumScore
            ),
        );

      const bandPositives =
        band.filter(
          (item) => item.positive,
        ).length;

      return {
        minimumScore,
        maximumScore,
        samples: band.length,
        positives: bandPositives,
        observedRate:
          band.length === 0
            ? 0
            : round(
                (
                  bandPositives /
                  band.length
                ) * 100,
              ),
      };
    },
  );

  const top20Precision =
    top20Samples === 0
      ? 0
      : top20Hits / top20Samples;

  const top20Recall =
    positives === 0
      ? 0
      : top20Hits / positives;

  return {
    signal,
    samples,
    positives,
    baseRate:
      round(baseRate * 100),
    top20Samples,
    top20Hits,
    top20Precision:
      round(
        top20Precision * 100,
      ),
    top20Recall:
      round(top20Recall * 100),
    top20Lift:
      baseRate === 0
        ? 0
        : round(
            top20Precision /
              baseRate,
          ),
    calibrationBands,
  };
}

export function backtestCustomerBookingWindows(
  actions: BookingAction[],
  horizons = [6, 12, 24, 48],
  evaluationStart?: Date,
  customerHoldoutFraction?: number,
): {
  customersEvaluated: number;
  checkpointHours: number;
  minimumHistory: number;
  evaluationStart: string | null;
  customerHoldoutFraction:
    number | null;
  horizons: HorizonResult[];
} {
  const evaluationStartTimestamp =
    evaluationStart?.getTime() ?? null;

  const safeCustomerHoldoutFraction =
    typeof customerHoldoutFraction ===
        "number" &&
      customerHoldoutFraction > 0 &&
      customerHoldoutFraction <= 0.5
      ? customerHoldoutFraction
      : null;

  const byCustomer =
    new Map<string, number[]>();

  for (const action of actions) {
    const timestamp =
      action.bookedAtTime.getTime();

    if (!Number.isFinite(timestamp)) {
      continue;
    }

    const existing =
      byCustomer.get(
        action.customerId,
      ) ?? [];

    existing.push(timestamp);

    byCustomer.set(
      action.customerId,
      existing,
    );
  }

  const customerTimelines =
    Array.from(
      byCustomer.values(),
    )
      .map((timestamps) =>
        Array.from(
          new Set(timestamps),
        ).sort(
          (first, second) =>
            first - second,
        ),
      )
      .filter(
        (timestamps) =>
          timestamps.length >
          MINIMUM_HISTORY,
      );

  const results = horizons.map(
    (horizonHours) => {
      const cadence:
        Evaluation[] = [];
      const weekly:
        Evaluation[] = [];
      const hazard:
        Evaluation[] = [];
      const combined:
        Evaluation[] = [];
      const hazardSlot:
        Evaluation[] = [];

      for (
        const timestamps
        of customerTimelines
      ) {
        let historyEnd =
          MINIMUM_HISTORY;

        let cutoff =
          timestamps[
            MINIMUM_HISTORY - 1
          ] +
          CHECKPOINT_HOURS *
            HOUR_MS;

        const finalObservedBooking =
          timestamps[
            timestamps.length - 1
          ];

        const customerEvaluationStart =
          safeCustomerHoldoutFraction ===
          null
            ? null
            : timestamps[
                Math.max(
                  MINIMUM_HISTORY,
                  Math.floor(
                    timestamps.length *
                      (
                        1 -
                        safeCustomerHoldoutFraction
                      ),
                  ),
                )
              ];

        while (
          cutoff <
          finalObservedBooking
        ) {
          while (
            historyEnd <
              timestamps.length &&
            timestamps[historyEnd] <=
              cutoff
          ) {
            historyEnd += 1;
          }

          const history =
            timestamps.slice(
              0,
              historyEnd,
            );

          const nextBooking =
            timestamps[historyEnd];

          if (!nextBooking) {
            break;
          }

          const positive =
            nextBooking <=
            cutoff +
              horizonHours *
                HOUR_MS;

          const cadenceValue =
            cadenceScore(
              history,
              cutoff,
            );

          const weeklyValue =
            weeklySlotScore(
              history,
              cutoff,
              horizonHours,
            );

          const hazardValue =
            gapHazardScore(
              history,
              cutoff,
              horizonHours,
            );

          const afterGlobalStart =
            evaluationStartTimestamp ===
              null ||
            cutoff >=
              evaluationStartTimestamp;

          const afterCustomerStart =
            customerEvaluationStart ===
              null ||
            cutoff >=
              customerEvaluationStart;

          const includeEvaluation =
            afterGlobalStart &&
            afterCustomerStart;

          if (includeEvaluation) {
            cadence.push({
              score: cadenceValue,
              positive,
            });

            weekly.push({
              score: weeklyValue,
              positive,
            });

            hazard.push({
              score: hazardValue,
              positive,
            });

            combined.push({
              score:
                cadenceValue * 0.7 +
                weeklyValue * 0.3,
              positive,
            });

            hazardSlot.push({
              score:
                hazardValue * 0.7 +
                weeklyValue * 0.3,
              positive,
            });
          }

          cutoff +=
            CHECKPOINT_HOURS *
            HOUR_MS;
        }
      }

      return {
        horizonHours,
        signals: [
          metrics(
            "CADENCE",
            cadence,
          ),
          metrics(
            "WEEKLY_SLOT",
            weekly,
          ),
          metrics(
            "GAP_HAZARD",
            hazard,
          ),
          metrics(
            "COMBINED",
            combined,
          ),
          metrics(
            "HAZARD_SLOT",
            hazardSlot,
          ),
        ],
      };
    },
  );

  return {
    customersEvaluated:
      customerTimelines.length,
    checkpointHours:
      CHECKPOINT_HOURS,
    minimumHistory:
      MINIMUM_HISTORY,
    evaluationStart:
      evaluationStart?.toISOString() ??
      null,
    customerHoldoutFraction:
      safeCustomerHoldoutFraction,
    horizons: results,
  };
}
