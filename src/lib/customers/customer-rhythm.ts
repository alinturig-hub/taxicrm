import type { ProfileBooking } from "@/lib/customers/customer-profiler";

function bookingDate(booking: ProfileBooking) {
  return (
    booking.pickupDueTime ??
    booking.bookedAtTime
  );
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
    ? (sorted[middle - 1] +
        sorted[middle]) /
        2
    : sorted[middle];
}

function round(
  value: number,
  decimals = 1,
) {
  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
}

function locationLabel(
  booking: ProfileBooking,
  type: "PICKUP" | "DESTINATION",
) {
  const location = booking.locations.find(
    (item) => item.type === type,
  );

  return (
    location?.zoneName?.trim() ||
    location?.address?.trim() ||
    null
  );
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

export function buildCustomerRhythm(
  bookings: ProfileBooking[],
  now = new Date(),
) {
  const historical = bookings
    .map((booking) => ({
      booking,
      date: bookingDate(booking),
    }))
    .filter(
      (
        item,
      ): item is {
        booking: ProfileBooking;
        date: Date;
      } =>
        item.date !== null &&
        item.date.getTime() <= now.getTime(),
    )
    .sort(
      (first, second) =>
        first.date.getTime() -
        second.date.getTime(),
    );

  if (historical.length < 5) {
    return {
      status: "LEARNING" as const,
      rhythmType: "LEARNING" as const,
      regularityScore: null,
      typicalIntervalHours: null,
      typicalIntervalLabel: "Learning",
      nextExpectedAt: null,
      scheduleStatus: "LEARNING" as const,
      overdueHours: 0,
      recent30Days: 0,
      previous30Days: 0,
      frequencyChangePercent: null,
      frequencyTrend: "LEARNING" as const,
      commutePattern: null,
      explanation: [
        `Only ${historical.length} historical bookings are available; at least 5 are required.`,
      ],
    };
  }

  const gaps = historical
    .slice(1)
    .map(
      (item, index) =>
        (
          item.date.getTime() -
          historical[index].date.getTime()
        ) / 3_600_000,
    )
    .filter((gap) => gap >= 0.25);

  const typicalIntervalHours =
    median(gaps);

  const deviations = gaps.map((gap) =>
    Math.abs(
      gap - typicalIntervalHours,
    ),
  );

  const medianDeviation =
    median(deviations);

  const regularity =
    typicalIntervalHours > 0
      ? Math.max(
          0,
          1 -
            Math.min(
              medianDeviation /
                typicalIntervalHours,
              1,
            ),
        )
      : 0;

  const regularityScore =
    Math.round(regularity * 100);

  const rhythmType =
    historical.length >= 8 &&
    regularityScore >= 65
      ? "REGULAR"
      : regularityScore >= 35
        ? "SEMI_REGULAR"
        : "OCCASIONAL";

  const lastBooking =
    historical[historical.length - 1].date;

  const nextExpectedAt =
    typicalIntervalHours > 0
      ? new Date(
          lastBooking.getTime() +
            typicalIntervalHours *
              3_600_000,
        )
      : null;

  const differenceHours =
    nextExpectedAt
      ? (
          now.getTime() -
          nextExpectedAt.getTime()
        ) / 3_600_000
      : 0;

  const dueTolerance =
    Math.max(
      2,
      typicalIntervalHours * 0.25,
    );

  const scheduleStatus =
    !nextExpectedAt
      ? "LEARNING"
      : differenceHours >
          dueTolerance
        ? "OVERDUE"
        : differenceHours >=
            -dueTolerance
          ? "DUE"
          : "ON_TRACK";

  const recentBoundary = new Date(
    now.getTime() -
      30 * 86_400_000,
  );

  const previousBoundary = new Date(
    now.getTime() -
      60 * 86_400_000,
  );

  const recent30Days =
    historical.filter(
      (item) =>
        item.date >= recentBoundary,
    ).length;

  const previous30Days =
    historical.filter(
      (item) =>
        item.date >= previousBoundary &&
        item.date < recentBoundary,
    ).length;

  const frequencyChangePercent =
    previous30Days > 0
      ? round(
          (
            (recent30Days -
              previous30Days) /
            previous30Days
          ) * 100,
        )
      : recent30Days > 0
        ? null
        : 0;

  const frequencyTrend =
    frequencyChangePercent === null
      ? "NEW_BASELINE"
      : frequencyChangePercent >= 20
        ? "INCREASING"
        : frequencyChangePercent <= -20
          ? "DECLINING"
          : "STABLE";

  const routeCounts = new Map<
    string,
    {
      pickup: string;
      destination: string;
      count: number;
      weekdayCount: number;
    }
  >();

  const weekdayFormatter =
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
    });

  for (const item of historical) {
    const pickup = locationLabel(
      item.booking,
      "PICKUP",
    );
    const destination = locationLabel(
      item.booking,
      "DESTINATION",
    );

    if (!pickup || !destination) {
      continue;
    }

    const key =
      `${normalize(pickup)}|||${normalize(destination)}`;

    const weekday =
      weekdayFormatter.format(item.date);

    const isWeekday =
      weekday !== "Sat" &&
      weekday !== "Sun";

    const current =
      routeCounts.get(key);

    if (current) {
      current.count += 1;
      current.weekdayCount +=
        isWeekday ? 1 : 0;
    } else {
      routeCounts.set(key, {
        pickup,
        destination,
        count: 1,
        weekdayCount:
          isWeekday ? 1 : 0,
      });
    }
  }

  const strongestRoute =
    Array.from(
      routeCounts.values(),
    ).sort(
      (first, second) =>
        second.count - first.count,
    )[0] ?? null;

  const routeShare =
    strongestRoute
      ? strongestRoute.count /
        historical.length
      : 0;

  const weekdayShare =
    strongestRoute &&
    strongestRoute.count > 0
      ? strongestRoute.weekdayCount /
        strongestRoute.count
      : 0;

  const commutePattern =
    strongestRoute &&
    strongestRoute.count >= 4 &&
    routeShare >= 0.2 &&
    weekdayShare >= 0.6
      ? {
          detected: true,
          pickup:
            strongestRoute.pickup,
          destination:
            strongestRoute.destination,
          observations:
            strongestRoute.count,
          sharePercent:
            round(routeShare * 100),
          weekdayPercent:
            round(
              weekdayShare * 100,
            ),
          confidence: Math.min(
            95,
            Math.round(
              40 +
                routeShare * 35 +
                weekdayShare * 20 +
                Math.min(
                  strongestRoute.count,
                  15,
                ),
            ),
          ),
        }
      : null;

  const typicalIntervalLabel =
    typicalIntervalHours < 24
      ? `${round(typicalIntervalHours)} hours`
      : `${round(typicalIntervalHours / 24)} days`;

  const explanation = [
    `${historical.length} historical bookings were evaluated.`,
    `Typical interval between bookings: ${typicalIntervalLabel}.`,
    `Regularity score: ${regularityScore}/100 (${rhythmType.toLowerCase().replace("_", " ")}).`,
    frequencyChangePercent === null
      ? `${recent30Days} bookings establish a new recent 30-day baseline.`
      : `Recent frequency changed by ${frequencyChangePercent > 0 ? "+" : ""}${frequencyChangePercent}% versus the previous 30 days.`,
  ];

  return {
    status: "READY" as const,
    rhythmType,
    regularityScore,
    typicalIntervalHours:
      round(typicalIntervalHours),
    typicalIntervalLabel,
    nextExpectedAt:
      nextExpectedAt?.toISOString() ??
      null,
    scheduleStatus,
    overdueHours:
      scheduleStatus === "OVERDUE"
        ? round(
            Math.max(
              differenceHours,
              0,
            ),
          )
        : 0,
    recent30Days,
    previous30Days,
    frequencyChangePercent,
    frequencyTrend,
    commutePattern,
    explanation,
  };
}

export type CustomerRhythm =
  ReturnType<typeof buildCustomerRhythm>;

