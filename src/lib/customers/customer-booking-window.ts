export type BookingWindowBooking = {
  bookedAtTime?: Date | string | null;
  pickupDueTime?: Date | string | null;
};

type HorizonHours = 6 | 12 | 24 | 48;

type CalibrationBand = {
  minimumScore: number;
  maximumScore: number;
  observedRate: number;
  samples: number;
};

const HOUR_MS = 60 * 60 * 1000;
const MINIMUM_HISTORY = 5;

const HORIZONS: HorizonHours[] = [
  6,
  12,
  24,
  48,
];

const CALIBRATION: Record<
  HorizonHours,
  CalibrationBand[]
> = {
  6: [
    {
      minimumScore: 0,
      maximumScore: 20,
      observedRate: 9.92,
      samples: 4689,
    },
    {
      minimumScore: 20,
      maximumScore: 40,
      observedRate: 22.86,
      samples: 2017,
    },
    {
      minimumScore: 40,
      maximumScore: 60,
      observedRate: 44.86,
      samples: 292,
    },
    {
      minimumScore: 60,
      maximumScore: 80,
      observedRate: 89.47,
      samples: 19,
    },
    {
      minimumScore: 80,
      maximumScore: 101,
      observedRate: 89.47,
      samples: 19,
    },
  ],
  12: [
    {
      minimumScore: 0,
      maximumScore: 20,
      observedRate: 17,
      samples: 3271,
    },
    {
      minimumScore: 20,
      maximumScore: 40,
      observedRate: 31.19,
      samples: 2828,
    },
    {
      minimumScore: 40,
      maximumScore: 60,
      observedRate: 50.9,
      samples: 831,
    },
    {
      minimumScore: 60,
      maximumScore: 80,
      observedRate: 80.46,
      samples: 87,
    },
    {
      minimumScore: 80,
      maximumScore: 101,
      observedRate: 80.46,
      samples: 87,
    },
  ],
  24: [
    {
      minimumScore: 0,
      maximumScore: 20,
      observedRate: 31.85,
      samples: 1777,
    },
    {
      minimumScore: 20,
      maximumScore: 40,
      observedRate: 44.09,
      samples: 2828,
    },
    {
      minimumScore: 40,
      maximumScore: 60,
      observedRate: 57.57,
      samples: 2015,
    },
    {
      minimumScore: 60,
      maximumScore: 80,
      observedRate: 75.57,
      samples: 397,
    },
    {
      minimumScore: 80,
      maximumScore: 101,
      observedRate: 75.57,
      samples: 397,
    },
  ],
  48: [
    {
      minimumScore: 0,
      maximumScore: 20,
      observedRate: 54.36,
      samples: 1102,
    },
    {
      minimumScore: 20,
      maximumScore: 40,
      observedRate: 61.83,
      samples: 1792,
    },
    {
      minimumScore: 40,
      maximumScore: 60,
      observedRate: 71.96,
      samples: 2850,
    },
    {
      minimumScore: 60,
      maximumScore: 80,
      observedRate: 85.26,
      samples: 1269,
    },
    {
      minimumScore: 80,
      maximumScore: 101,
      observedRate: 100,
      samples: 4,
    },
  ],
};

const londonPartsFormatter =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    hour: "2-digit",
    hour12: false,
  });

function timestamp(
  value: Date | string | null | undefined,
) {
  if (!value) {
    return null;
  }

  const result =
    value instanceof Date
      ? value.getTime()
      : new Date(value).getTime();

  return Number.isFinite(result)
    ? result
    : null;
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

function round(
  value: number,
  decimals = 1,
) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) /
    factor;
}

function londonSlot(value: Date) {
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

  return {
    key: [
      weekday,
      Math.floor(hour / 3) * 3,
    ].join(":"),
    weekday,
    hour:
      Math.floor(hour / 3) * 3,
  };
}

function gapHazard(
  history: number[],
  now: number,
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

  const elapsedHours =
    (
      now -
      history[history.length - 1]
    ) / HOUR_MS;

  const atRisk = gaps.filter(
    (gap) => gap > elapsedHours,
  );

  const hits = atRisk.filter(
    (gap) =>
      gap <=
      elapsedHours + horizonHours,
  ).length;

  if (
    gaps.length < 4 ||
    atRisk.length === 0
  ) {
    return {
      score: 0,
      elapsedHours,
      medianGapHours:
        median(gaps),
      atRiskSamples:
        atRisk.length,
      matchingSamples: hits,
    };
  }

  const probability =
    (hits + 1) /
    (atRisk.length + 2);

  const evidenceStrength =
    Math.min(
      1,
      atRisk.length / 8,
    );

  return {
    score: Math.min(
      100,
      probability *
        100 *
        (
          0.65 +
          evidenceStrength * 0.35
        ),
    ),
    elapsedHours,
    medianGapHours:
      median(gaps),
    atRiskSamples:
      atRisk.length,
    matchingSamples: hits,
  };
}

function weeklyWindow(
  history: number[],
  now: number,
  horizonHours: number,
) {
  const counts =
    new Map<string, number>();

  for (const value of history) {
    const slot =
      londonSlot(
        new Date(value),
      );

    counts.set(
      slot.key,
      (counts.get(slot.key) ?? 0) + 1,
    );
  }

  const firstCandidate =
    new Date(now);

  firstCandidate.setUTCMinutes(
    0,
    0,
    0,
  );

  if (
    firstCandidate.getTime() < now
  ) {
    firstCandidate.setUTCHours(
      firstCandidate.getUTCHours() + 1,
    );
  }

  let best:
    {
      count: number;
      startAt: Date;
      weekday: string;
      hour: number;
    } | null = null;

  for (
    let offset = 0;
    offset <= horizonHours;
    offset += 1
  ) {
    const candidate = new Date(
      firstCandidate.getTime() +
        offset * HOUR_MS,
    );

    const slot =
      londonSlot(candidate);

    const count =
      counts.get(slot.key) ?? 0;

    if (
      !best ||
      count > best.count
    ) {
      best = {
        count,
        startAt: candidate,
        weekday: slot.weekday,
        hour: slot.hour,
      };
    }
  }

  const share =
    best
      ? best.count / history.length
      : 0;

  return {
    score: Math.min(
      100,
      share * 200,
    ),
    historicalMatches:
      best?.count ?? 0,
    sharePercent:
      round(share * 100),
    startAt:
      best?.startAt ?? null,
    endAt:
      best
        ? new Date(
            best.startAt.getTime() +
              3 * HOUR_MS,
          )
        : null,
    weekday:
      best?.weekday ?? null,
    hour:
      best?.hour ?? null,
  };
}

function level(score: number) {
  if (score >= 60) {
    return "HIGH" as const;
  }

  if (score >= 40) {
    return "ELEVATED" as const;
  }

  if (score >= 20) {
    return "MODERATE" as const;
  }

  return "LOW" as const;
}

function calibration(
  horizon: HorizonHours,
  score: number,
) {
  return (
    CALIBRATION[horizon].find(
      (band) =>
        score >=
          band.minimumScore &&
        score <
          band.maximumScore,
    ) ??
    CALIBRATION[horizon][0]
  );
}

function evidenceConfidence(
  historyCount: number,
  atRiskSamples: number,
  weeklyMatches: number,
) {
  return Math.round(
    Math.min(
      95,
      Math.min(
        40,
        historyCount * 2,
      ) +
        Math.min(
          35,
          atRiskSamples * 5,
        ) +
        Math.min(
          20,
          weeklyMatches * 4,
        ),
    ),
  );
}

export function buildCustomerBookingWindow(
  bookings: BookingWindowBooking[],
  {
    now = new Date(),
    profileSafeForPersonalisation = true,
  }: {
    now?: Date;
    profileSafeForPersonalisation?: boolean;
  } = {},
) {
  const nowTimestamp =
    now.getTime();

  const actions = Array.from(
    new Set(
      bookings
        .map(
          (booking) =>
            timestamp(
              booking.bookedAtTime,
            ),
        )
        .filter(
          (value): value is number =>
            value !== null &&
            value <= nowTimestamp,
        ),
    ),
  ).sort(
    (first, second) =>
      first - second,
  );

  const leadMinutes = bookings
    .map((booking) => {
      const bookedAt =
        timestamp(
          booking.bookedAtTime,
        );

      const pickupAt =
        timestamp(
          booking.pickupDueTime,
        );

      return (
        bookedAt !== null &&
        pickupAt !== null &&
        pickupAt >= bookedAt
      )
        ? (
            pickupAt -
            bookedAt
          ) / 60_000
        : null;
    })
    .filter(
      (value): value is number =>
        value !== null,
    );

  const medianLeadMinutes =
    leadMinutes.length > 0
      ? round(
          median(leadMinutes),
        )
      : null;

  if (!profileSafeForPersonalisation) {
    return {
      status: "DISABLED" as const,
      model: "HAZARD_SLOT_V1",
      analysedBookings:
        actions.length,
      primaryHorizonHours: 24,
      horizons: [],
      strongestUpcomingWindow: null,
      medianLeadMinutes,
      leadTimeSamples:
        leadMinutes.length,
      message:
        "Booking-window prediction is disabled for shared or non-individual profiles.",
      explanation: [
        "No individual prediction is produced because this profile may represent more than one person.",
      ],
    };
  }

  if (
    actions.length <
    MINIMUM_HISTORY
  ) {
    return {
      status: "LEARNING" as const,
      model: "HAZARD_SLOT_V1",
      analysedBookings:
        actions.length,
      primaryHorizonHours: 24,
      horizons: [],
      strongestUpcomingWindow: null,
      medianLeadMinutes,
      leadTimeSamples:
        leadMinutes.length,
      message:
        "More booking history is required.",
      explanation: [
        `Only ${actions.length} booking actions are available; at least ${MINIMUM_HISTORY} are required.`,
      ],
    };
  }

  const horizons = HORIZONS.map(
    (horizonHours) => {
      const hazard =
        gapHazard(
          actions,
          nowTimestamp,
          horizonHours,
        );

      const weekly =
        weeklyWindow(
          actions,
          nowTimestamp,
          horizonHours,
        );

      const score = round(
        hazard.score * 0.7 +
          weekly.score * 0.3,
      );

      const benchmark =
        calibration(
          horizonHours,
          score,
        );

      return {
        horizonHours,
        score,
        level: level(score),
        evidenceConfidence:
          evidenceConfidence(
            actions.length,
            hazard.atRiskSamples,
            weekly.historicalMatches,
          ),
        observedBenchmarkRate:
          benchmark.observedRate,
        calibrationSamples:
          benchmark.samples,
        windowStartAt:
          now.toISOString(),
        windowEndAt:
          new Date(
            nowTimestamp +
              horizonHours *
                HOUR_MS,
          ).toISOString(),
        gapHazardScore:
          round(hazard.score),
        weeklySlotScore:
          round(weekly.score),
        elapsedSinceLastHours:
          round(
            hazard.elapsedHours,
          ),
        medianGapHours:
          round(
            hazard.medianGapHours,
          ),
        atRiskSamples:
          hazard.atRiskSamples,
        strongestSlot: {
          startAt:
            weekly.startAt
              ?.toISOString() ??
            null,
          endAt:
            weekly.endAt
              ?.toISOString() ??
            null,
          weekday:
            weekly.weekday,
          hour:
            weekly.hour,
          historicalMatches:
            weekly.historicalMatches,
          sharePercent:
            weekly.sharePercent,
        },
      };
    },
  );

  const primary =
    horizons.find(
      (item) =>
        item.horizonHours === 24,
    );

  const strongestUpcomingWindow =
    [...horizons]
      .filter(
        (item) =>
          item.strongestSlot.startAt !==
          null,
      )
      .sort(
        (first, second) =>
          second.score - first.score ||
          first.horizonHours -
            second.horizonHours,
      )[0]?.strongestSlot ?? null;

  return {
    status: "READY" as const,
    model: "HAZARD_SLOT_V1",
    analysedBookings:
      actions.length,
    primaryHorizonHours: 24,
    primaryScore:
      primary?.score ?? 0,
    primaryLevel:
      primary?.level ?? "LOW",
    primaryObservedBenchmarkRate:
      primary
        ?.observedBenchmarkRate ?? 0,
    primaryEvidenceConfidence:
      primary
        ?.evidenceConfidence ?? 0,
    horizons,
    strongestUpcomingWindow,
    medianLeadMinutes,
    leadTimeSamples:
      leadMinutes.length,
    message:
      "The booking-action window combines conditional booking gaps with repeated London weekday and time patterns.",
    explanation: [
      "The primary operational window is the next 24 hours.",
      "Observed benchmark rates come from chronological per-customer holdout testing and are not guarantees for an individual booking.",
      "The model uses booking timestamps only; it does not use protected locations, medical information, financial eligibility or inferred personal traits.",
    ],
  };
}
