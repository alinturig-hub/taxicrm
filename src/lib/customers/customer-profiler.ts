type ProfileLocation = {
  type: "PICKUP" | "DESTINATION";
  address: string;
  zoneName: string | null;
};

export type ProfileBooking = {
  externalId: string;
  status: string;
  bookedAtTime: Date | null;
  pickupDueTime: Date | null;
  completedAt: Date | null;
  price: unknown;
  distance: unknown;
  paymentType: string | null;
  bookingSource: string | null;
  locations: ProfileLocation[];
};

type CountedValue = {
  label: string;
  count: number;
  percentage: number;
};

const dayFormatter = new Intl.DateTimeFormat(
  "en-GB",
  {
    timeZone: "Europe/London",
    weekday: "long",
  },
);

const hourFormatter = new Intl.DateTimeFormat(
  "en-GB",
  {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  },
);

function numberValue(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function percentage(value: number, total: number) {
  return total > 0
    ? Number(((value / total) * 100).toFixed(1))
    : 0;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(
    0,
    (to.getTime() - from.getTime()) /
      86_400_000,
  );
}

function normalizePlace(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function rankedValues(
  values: Array<string | null | undefined>,
  total: number,
  limit = 5,
): CountedValue[] {
  const counts = new Map<string, number>();

  for (const rawValue of values) {
    const value = rawValue?.trim();

    if (!value) {
      continue;
    }

    counts.set(
      value,
      (counts.get(value) ?? 0) + 1,
    );
  }

  return Array.from(counts.entries())
    .sort((first, second) => {
      const difference = second[1] - first[1];

      return difference !== 0
        ? difference
        : first[0].localeCompare(second[0]);
    })
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      percentage: percentage(count, total),
    }));
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort(
    (first, second) => first - second,
  );
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function buildCustomerProfile(
  bookings: ProfileBooking[],
  now = new Date(),
) {
  const orderedBookings = [...bookings].sort(
    (first, second) =>
      (
        second.pickupDueTime ??
        second.bookedAtTime ??
        new Date(0)
      ).getTime() -
      (
        first.pickupDueTime ??
        first.bookedAtTime ??
        new Date(0)
      ).getTime(),
  );

  const totalBookings = orderedBookings.length;
  const completed = orderedBookings.filter(
    (booking) =>
      booking.status.toUpperCase() === "COMPLETED",
  );
  const cancelled = orderedBookings.filter(
    (booking) =>
      booking.status.toUpperCase() === "CANCELLED",
  );
  const noFare = orderedBookings.filter(
    (booking) =>
      booking.status.toUpperCase() === "NO_FARE",
  );
  const rejected = orderedBookings.filter(
    (booking) =>
      booking.status.toUpperCase() === "REJECTED",
  );

  const totalSpent = completed.reduce(
    (sum, booking) =>
      sum + Math.max(numberValue(booking.price), 0),
    0,
  );

  const datedBookings = orderedBookings
    .map(
      (booking) =>
        booking.pickupDueTime ??
        booking.bookedAtTime,
    )
    .filter((value): value is Date => value !== null)
    .sort(
      (first, second) =>
        first.getTime() - second.getTime(),
    );

  const gaps = datedBookings
    .slice(1)
    .map((date, index) =>
      daysBetween(datedBookings[index], date),
    )
    .filter((gap) => gap > 0);

  const medianGapDays = median(gaps);
  const firstBookingAt =
    datedBookings[0] ?? null;
  const lastBookingAt =
    datedBookings[datedBookings.length - 1] ?? null;
  const daysSinceLastBooking = lastBookingAt
    ? daysBetween(lastBookingAt, now)
    : null;

  const pickupPlaces = orderedBookings
    .map((booking) =>
      booking.locations.find(
        (location) => location.type === "PICKUP",
      ),
    )
    .filter(
      (
        location,
      ): location is ProfileLocation =>
        location !== undefined,
    );

  const destinationPlaces = orderedBookings
    .map((booking) =>
      booking.locations.find(
        (location) =>
          location.type === "DESTINATION",
      ),
    )
    .filter(
      (
        location,
      ): location is ProfileLocation =>
        location !== undefined,
    );

  const topPickups = rankedValues(
    pickupPlaces.map(
      (location) =>
        location.zoneName || location.address,
    ),
    totalBookings,
    10,
  );

  const topDestinations = rankedValues(
    destinationPlaces.map(
      (location) =>
        location.zoneName || location.address,
    ),
    totalBookings,
    10,
  );

  const uniqueDestinations = new Set(
    destinationPlaces.map((location) =>
      normalizePlace(location.address),
    ),
  ).size;

  const topPickupShare =
    topPickups[0]?.percentage ?? 0;

  const sharedBookingPoint =
    totalBookings >= 20 &&
    topPickupShare >= 60 &&
    uniqueDestinations >= 10;

  const identityType = sharedBookingPoint
    ? "SHARED_BOOKING_POINT"
    : totalBookings >= 5
      ? "LIKELY_INDIVIDUAL"
      : "INSUFFICIENT_DATA";

  const identityConfidence = sharedBookingPoint
    ? Math.min(
        98,
        Math.round(
          60 +
            topPickupShare * 0.25 +
            Math.min(uniqueDestinations, 30) * 0.5,
        ),
      )
    : Math.min(
        95,
        Math.round(35 + totalBookings * 4),
      );

  const days = rankedValues(
    datedBookings.map((date) =>
      dayFormatter.format(date),
    ),
    datedBookings.length,
    7,
  );

  const hours = rankedValues(
    datedBookings.map((date) => {
      const rawHour = Number(
        hourFormatter.format(date),
      );
      const hour = rawHour === 24 ? 0 : rawHour;

      return `${String(hour).padStart(2, "0")}:00`;
    }),
    datedBookings.length,
    24,
  );

  const paymentMethods = rankedValues(
    orderedBookings.map(
      (booking) => booking.paymentType,
    ),
    totalBookings,
  );

  const bookingChannels = rankedValues(
    orderedBookings.map(
      (booking) => booking.bookingSource,
    ),
    totalBookings,
  );

  let lifecycle = "NEW";

  if (
    daysSinceLastBooking !== null &&
    daysSinceLastBooking >
      Math.max(30, medianGapDays * 3)
  ) {
    lifecycle = "DORMANT";
  } else if (
    daysSinceLastBooking !== null &&
    daysSinceLastBooking >
      Math.max(14, medianGapDays * 1.8)
  ) {
    lifecycle = "AT_RISK";
  } else if (
    totalBookings >= 20 &&
    percentage(completed.length, totalBookings) >= 80
  ) {
    lifecycle = "LOYAL";
  } else if (totalBookings >= 5) {
    lifecycle = "ACTIVE";
  }

  const insights: Array<{
    type: "FACT" | "INFERENCE";
    title: string;
    detail: string;
    confidence: number;
  }> = [];

  if (sharedBookingPoint) {
    insights.push({
      type: "INFERENCE",
      title: "Likely shared booking point",
      detail:
        `${topPickupShare}% of bookings start from the same area and travel to ${uniqueDestinations} different destinations. This profile may represent multiple passengers.`,
      confidence: identityConfidence,
    });
  }

  if (days[0]) {
    insights.push({
      type: "FACT",
      title: "Most active day",
      detail:
        `${days[0].label} accounts for ${days[0].percentage}% of observed bookings.`,
      confidence: 100,
    });
  }

  if (hours[0]) {
    insights.push({
      type: "FACT",
      title: "Most active booking hour",
      detail:
        `${hours[0].label} is the most frequent pickup window with ${hours[0].count} bookings.`,
      confidence: 100,
    });
  }

  if (paymentMethods[0]) {
    insights.push({
      type: "FACT",
      title: "Preferred payment",
      detail:
        `${paymentMethods[0].label} is used for ${paymentMethods[0].percentage}% of bookings.`,
      confidence: 100,
    });
  }

  const opportunities: Array<{
    action: string;
    reason: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
  }> = [];

  if (sharedBookingPoint) {
    opportunities.push({
      action: "Treat as a business or shared booking point",
      reason:
        "Avoid personal predictions and provide fast repeat-booking tools for the pickup location.",
      priority: "HIGH",
    });
  } else if (lifecycle === "DORMANT") {
    opportunities.push({
      action: "Consider a gentle reactivation message",
      reason:
        "The customer has exceeded their normal interval between bookings.",
      priority: "MEDIUM",
    });
  } else if (days[0] && hours[0]) {
    opportunities.push({
      action:
        `Offer a quick-book reminder near ${hours[0].label} on ${days[0].label}`,
      reason:
        "This is the strongest observed booking window.",
      priority: "LOW",
    });
  }

  if (
    percentage(cancelled.length, totalBookings) >= 25
  ) {
    opportunities.push({
      action: "Review cancellation pattern before promotions",
      reason:
        `${percentage(cancelled.length, totalBookings)}% of bookings were cancelled.`,
      priority: "HIGH",
    });
  }

  return {
    overview: {
      totalBookings,
      completed: completed.length,
      cancelled: cancelled.length,
      noFare: noFare.length,
      rejected: rejected.length,
      completionRate: percentage(
        completed.length,
        totalBookings,
      ),
      cancellationRate: percentage(
        cancelled.length,
        totalBookings,
      ),
      noFareRate: percentage(
        noFare.length,
        totalBookings,
      ),
      totalSpent: Number(totalSpent.toFixed(2)),
      averageCompletedValue:
        completed.length > 0
          ? Number(
              (totalSpent / completed.length).toFixed(2),
            )
          : 0,
      firstBookingAt,
      lastBookingAt,
      daysSinceLastBooking:
        daysSinceLastBooking === null
          ? null
          : Number(daysSinceLastBooking.toFixed(1)),
      medianGapDays: Number(medianGapDays.toFixed(1)),
    },
    classification: {
      lifecycle,
      identityType,
      identityConfidence,
      profileSafeForPersonalisation:
        !sharedBookingPoint && totalBookings >= 5,
    },
    behaviour: {
      days,
      hours,
      paymentMethods,
      bookingChannels,
    },
    places: {
      topPickups,
      topDestinations,
      uniqueDestinations,
    },
    insights,
    opportunities,
    latestBookings: orderedBookings.slice(0, 10),
  };
}
