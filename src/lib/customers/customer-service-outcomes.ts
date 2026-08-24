export type ServiceOutcomeBooking = {
  externalId: string;
  status: string;
  bookedAtTime?: Date | string | null;
  pickupDueTime?: Date | string | null;
};

export type CustomerServiceOutcomes = {
  status: "READY" | "LEARNING";
  level:
    | "STABLE"
    | "MONITOR"
    | "REVIEW"
    | "URGENT_REVIEW"
    | "LEARNING";
  confidence: number;
  concludedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  rejectedBookings: number;
  noFareBookings: number;
  overallAdverseRate: number;
  recentWindowSize: number;
  recentAdverseOutcomes: number;
  recentAdverseRate: number;
  previousAdverseRate: number | null;
  changePercentagePoints: number | null;
  consecutiveAdverseOutcomes: number;
  dominantAdverseOutcome:
    | "CANCELLED"
    | "REJECTED"
    | "NO_FARE"
    | null;
  serviceRecoveryRecommended: boolean;
  signals: string[];
  explanation: string[];
};

const finalStatuses = new Set([
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "NO_FARE",
]);

const adverseStatuses = new Set([
  "CANCELLED",
  "REJECTED",
  "NO_FARE",
]);

function normaliseStatus(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function timestamp(
  value: Date | string | null | undefined,
) {
  if (!value) {
    return 0;
  }

  const result =
    value instanceof Date
      ? value.getTime()
      : new Date(value).getTime();

  return Number.isFinite(result)
    ? result
    : 0;
}

function percentage(
  value: number,
  total: number,
) {
  return total > 0
    ? Number(
        ((value / total) * 100).toFixed(1),
      )
    : 0;
}

export function buildCustomerServiceOutcomes(
  bookings: ServiceOutcomeBooking[],
): CustomerServiceOutcomes {
  const concluded = bookings
    .map((booking) => ({
      externalId: booking.externalId,
      status:
        normaliseStatus(booking.status),
      time: timestamp(
        booking.pickupDueTime ??
          booking.bookedAtTime,
      ),
    }))
    .filter(
      (booking) =>
        finalStatuses.has(booking.status),
    )
    .sort(
      (first, second) =>
        second.time - first.time ||
        second.externalId.localeCompare(
          first.externalId,
        ),
    );

  const countStatus = (status: string) =>
    concluded.filter(
      (booking) =>
        booking.status === status,
    ).length;

  const completedBookings =
    countStatus("COMPLETED");
  const cancelledBookings =
    countStatus("CANCELLED");
  const rejectedBookings =
    countStatus("REJECTED");
  const noFareBookings =
    countStatus("NO_FARE");

  const totalAdverse =
    cancelledBookings +
    rejectedBookings +
    noFareBookings;

  const recent = concluded.slice(0, 10);
  const previous = concluded.slice(10);

  const recentAdverseOutcomes =
    recent.filter(
      (booking) =>
        adverseStatuses.has(
          booking.status,
        ),
    ).length;

  const previousAdverseOutcomes =
    previous.filter(
      (booking) =>
        adverseStatuses.has(
          booking.status,
        ),
    ).length;

  let consecutiveAdverseOutcomes = 0;

  for (const booking of concluded) {
    if (
      !adverseStatuses.has(
        booking.status,
      )
    ) {
      break;
    }

    consecutiveAdverseOutcomes += 1;
  }

  const recentAdverseRate =
    percentage(
      recentAdverseOutcomes,
      recent.length,
    );

  const previousAdverseRate =
    previous.length >= 5
      ? percentage(
          previousAdverseOutcomes,
          previous.length,
        )
      : null;

  const changePercentagePoints =
    previousAdverseRate === null
      ? null
      : Number(
          (
            recentAdverseRate -
            previousAdverseRate
          ).toFixed(1),
        );

  const adverseCounts = [
    {
      status: "CANCELLED" as const,
      count: cancelledBookings,
    },
    {
      status: "REJECTED" as const,
      count: rejectedBookings,
    },
    {
      status: "NO_FARE" as const,
      count: noFareBookings,
    },
  ].sort(
    (first, second) =>
      second.count - first.count,
  );

  const dominantAdverseOutcome =
    adverseCounts[0]?.count
      ? adverseCounts[0].status
      : null;

  const ready = concluded.length >= 5;

  let level:
    CustomerServiceOutcomes["level"] =
      ready ? "STABLE" : "LEARNING";

  if (ready) {
    if (
      consecutiveAdverseOutcomes >= 3 ||
      (
        recent.length >= 5 &&
        recentAdverseRate >= 60
      )
    ) {
      level = "URGENT_REVIEW";
    } else if (
      (
        changePercentagePoints !== null &&
        changePercentagePoints >= 20 &&
        recentAdverseOutcomes >= 2
      ) ||
      recentAdverseRate >= 40
    ) {
      level = "REVIEW";
    } else if (
      consecutiveAdverseOutcomes >= 2 ||
      recentAdverseRate >= 25
    ) {
      level = "MONITOR";
    }
  }

  const confidence = ready
    ? Math.min(
        95,
        Math.round(
          45 +
          Math.min(
            concluded.length,
            25,
          ) * 2,
        ),
      )
    : Math.min(
        49,
        concluded.length * 9,
      );

  const signals: string[] = [];

  if (consecutiveAdverseOutcomes > 0) {
    signals.push(
      `${consecutiveAdverseOutcomes} consecutive concluded bookings have an adverse outcome.`,
    );
  }

  if (
    changePercentagePoints !== null &&
    Math.abs(
      changePercentagePoints,
    ) >= 10
  ) {
    signals.push(
      `The recent adverse outcome rate changed by ${changePercentagePoints > 0 ? "+" : ""}${changePercentagePoints} percentage points versus earlier concluded bookings.`,
    );
  }

  if (dominantAdverseOutcome) {
    signals.push(
      `${dominantAdverseOutcome.toLowerCase().replace("_", " ")} is the most frequent recorded adverse outcome.`,
    );
  }

  if (signals.length === 0) {
    signals.push(
      "No material recent service outcome disruption was detected.",
    );
  }

  return {
    status: ready
      ? "READY"
      : "LEARNING",
    level,
    confidence,
    concludedBookings:
      concluded.length,
    completedBookings,
    cancelledBookings,
    rejectedBookings,
    noFareBookings,
    overallAdverseRate:
      percentage(
        totalAdverse,
        concluded.length,
      ),
    recentWindowSize:
      recent.length,
    recentAdverseOutcomes,
    recentAdverseRate,
    previousAdverseRate,
    changePercentagePoints,
    consecutiveAdverseOutcomes,
    dominantAdverseOutcome,
    serviceRecoveryRecommended:
      level === "REVIEW" ||
      level === "URGENT_REVIEW",
    signals,
    explanation: [
      "Only concluded bookings are evaluated: completed, cancelled, rejected and no fare.",
      "Active, accepted, arrived, passenger-on-board, created and future bookings are not treated as adverse outcomes.",
      "A disruption signal requests operational review and does not assign fault to the customer.",
      "The result must not be used for pricing, service denial or financial eligibility decisions.",
    ],
  };
}
