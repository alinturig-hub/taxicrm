import type { ProfileBooking } from "@/lib/customers/customer-profiler";
import type { CustomerRhythm } from "@/lib/customers/customer-rhythm";

export type CustomerRelationshipQuality = {
  status: "READY" | "LEARNING";
  score: number | null;
  level:
    | "STRONG"
    | "ESTABLISHED"
    | "DEVELOPING"
    | "NEEDS_ATTENTION"
    | "LEARNING";
  completedBookings: number;
  completionRate: number;
  cancellationRate: number;
  noFareRate: number;
  relationshipAgeDays: number | null;
  daysSinceLastBooking: number | null;
  strengths: string[];
  attentionSignals: string[];
  explanation: string[];
};

function percentage(value: number, total: number) {
  return total > 0
    ? Number(((value / total) * 100).toFixed(1))
    : 0;
}

function bookingTime(booking: ProfileBooking) {
  return (
    booking.pickupDueTime ??
    booking.bookedAtTime ??
    booking.completedAt
  );
}

function clamp(value: number) {
  return Math.max(
    0,
    Math.min(100, Math.round(value)),
  );
}

export function buildCustomerRelationshipQuality(
  bookings: ProfileBooking[],
  rhythm?: CustomerRhythm,
  now = new Date(),
): CustomerRelationshipQuality {
  const historical = bookings
    .filter((booking) => {
      const time = bookingTime(booking);

      return time && time <= now;
    })
    .sort((first, second) => {
      return (
        bookingTime(first)!.getTime() -
        bookingTime(second)!.getTime()
      );
    });

  const total = historical.length;
  const completed = historical.filter(
    (booking) =>
      booking.status.toUpperCase() ===
      "COMPLETED",
  ).length;
  const cancelled = historical.filter(
    (booking) =>
      booking.status.toUpperCase() ===
      "CANCELLED",
  ).length;
  const noFare = historical.filter(
    (booking) =>
      booking.status
        .toUpperCase()
        .replace(/[^A-Z]/g, "") ===
      "NOFARE",
  ).length;

  const completionRate = percentage(
    completed,
    total,
  );
  const cancellationRate = percentage(
    cancelled,
    total,
  );
  const noFareRate = percentage(noFare, total);

  const firstTime = historical[0]
    ? bookingTime(historical[0])
    : null;
  const lastBooking =
    historical.length > 0
      ? historical[historical.length - 1]
      : null;

  const lastTime = lastBooking
    ? bookingTime(lastBooking)
    : null;

  const relationshipAgeDays =
    firstTime && lastTime
      ? Number(
          (
            (
              lastTime.getTime() -
              firstTime.getTime()
            ) / 86_400_000
          ).toFixed(1),
        )
      : null;

  const daysSinceLastBooking = lastTime
    ? Number(
        (
          Math.max(
            0,
            now.getTime() -
              lastTime.getTime(),
          ) / 86_400_000
        ).toFixed(1),
      )
    : null;

  if (total < 3) {
    return {
      status: "LEARNING",
      score: null,
      level: "LEARNING",
      completedBookings: completed,
      completionRate,
      cancellationRate,
      noFareRate,
      relationshipAgeDays,
      daysSinceLastBooking,
      strengths: [],
      attentionSignals: [],
      explanation: [
        "At least 3 historical bookings are required to assess relationship quality.",
      ],
    };
  }

  const outcomePoints =
    completionRate * 0.45;
  const depthPoints =
    Math.min(total / 20, 1) * 20;
  const tenurePoints =
    Math.min(
      (relationshipAgeDays ?? 0) / 180,
      1,
    ) * 15;

  const expectedGapDays =
    rhythm?.typicalIntervalHours
      ? rhythm.typicalIntervalHours / 24
      : null;

  let recencyPoints = 10;

  if (
    daysSinceLastBooking !== null &&
    expectedGapDays !== null &&
    expectedGapDays > 0
  ) {
    const overdueRatio =
      daysSinceLastBooking /
      expectedGapDays;

    recencyPoints =
      overdueRatio <= 1.5
        ? 20
        : overdueRatio <= 3
          ? 10
          : 0;
  } else if (
    daysSinceLastBooking !== null
  ) {
    recencyPoints =
      daysSinceLastBooking <= 14
        ? 20
        : daysSinceLastBooking <= 45
          ? 10
          : 0;
  }

  const cancellationPenalty =
    Math.min(cancellationRate * 0.2, 20);
  const noFarePenalty =
    Math.min(noFareRate * 0.1, 10);

  const score = clamp(
    outcomePoints +
      depthPoints +
      tenurePoints +
      recencyPoints -
      cancellationPenalty -
      noFarePenalty,
  );

  const strengths: string[] = [];
  const attentionSignals: string[] = [];
  const explanation: string[] = [
    `${total} historical bookings were evaluated.`,
    `${completionRate}% were completed.`,
    `Relationship depth contributes ${Math.round(depthPoints)} of 20 points.`,
    `Recent activity contributes ${Math.round(recencyPoints)} of 20 points.`,
  ];

  if (completionRate >= 80) {
    strengths.push(
      "High historical completion rate",
    );
  }

  if (total >= 20) {
    strengths.push(
      "Substantial booking history",
    );
  }

  if (
    relationshipAgeDays !== null &&
    relationshipAgeDays >= 90
  ) {
    strengths.push(
      "Established relationship over time",
    );
  }

  if (
    rhythm?.frequencyTrend === "INCREASING"
  ) {
    strengths.push(
      "Booking frequency is increasing",
    );
  }

  if (cancellationRate >= 25) {
    attentionSignals.push(
      "Cancellation rate is materially above the customer baseline target",
    );
  }

  if (noFareRate >= 15) {
    attentionSignals.push(
      "No-fare outcomes should be reviewed operationally",
    );
  }

  if (
    rhythm?.frequencyTrend === "DECLINING"
  ) {
    attentionSignals.push(
      "Recent booking frequency is declining",
    );
  }

  if (
    rhythm?.scheduleStatus === "OVERDUE" &&
    rhythm.overdueHours >= 48
  ) {
    attentionSignals.push(
      "The usual booking interval has been exceeded",
    );
  }

  const needsAttention =
    attentionSignals.length > 0 &&
    (
      rhythm?.frequencyTrend ===
        "DECLINING" ||
      recencyPoints === 0 ||
      cancellationRate >= 35
    );

  const level =
    needsAttention
      ? "NEEDS_ATTENTION"
      : score >= 75
        ? "STRONG"
        : score >= 55
          ? "ESTABLISHED"
          : "DEVELOPING";

  explanation.push(
    "The score measures observed relationship strength, not personal worth or creditworthiness.",
  );

  return {
    status: "READY",
    score,
    level,
    completedBookings: completed,
    completionRate,
    cancellationRate,
    noFareRate,
    relationshipAgeDays,
    daysSinceLastBooking,
    strengths,
    attentionSignals,
    explanation,
  };
}
