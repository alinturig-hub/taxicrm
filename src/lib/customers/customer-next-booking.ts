import type { ProfileBooking } from "@/lib/customers/customer-profiler";

const londonPartsFormatter =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    hour: "2-digit",
    hour12: false,
  });

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function bookingDate(booking: ProfileBooking) {
  return (
    booking.pickupDueTime ??
    booking.bookedAtTime
  );
}

function londonSlot(date: Date) {
  const parts =
    londonPartsFormatter.formatToParts(date);

  const day =
    parts.find(
      (part) => part.type === "weekday",
    )?.value ?? "";

  const rawHour = Number(
    parts.find(
      (part) => part.type === "hour",
    )?.value ?? 0,
  );

  const hour =
    rawHour === 24 ? 0 : rawHour;

  return {
    day,
    hour:
      Math.floor(hour / 3) * 3,
  };
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

function round(value: number) {
  return Math.round(value);
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

function mostFrequent(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(
      value,
      (counts.get(value) ?? 0) + 1,
    );
  }

  return Array.from(counts.entries()).sort(
    (first, second) =>
      second[1] - first[1] ||
      first[0].localeCompare(second[0]),
  )[0] ?? null;
}

function nextSlotDate(
  day: string,
  hour: number,
  now: Date,
) {
  const targetDay = DAYS.indexOf(day);

  if (targetDay < 0) {
    return null;
  }

  const candidate = new Date(now);
  candidate.setUTCMinutes(0, 0, 0);
  candidate.setUTCHours(
    candidate.getUTCHours() + 1,
  );

  for (
    let offset = 0;
    offset < 24 * 14;
    offset += 1
  ) {
    const slot = londonSlot(candidate);

    if (
      slot.day === day &&
      slot.hour === hour
    ) {
      return new Date(candidate);
    }

    candidate.setUTCHours(
      candidate.getUTCHours() + 1,
    );
  }

  return null;
}

export function buildNextBookingPrediction(
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
      signalStrength: "LEARNING" as const,
      needScore: null,
      confidence: Math.min(
        35,
        historical.length * 7,
      ),
      predictedDay: null,
      predictedHour: null,
      predictedWindow: null,
      predictedStartAt: null,
      pickup: null,
      destination: null,
      routeObservations: 0,
      explanation: [
        `Only ${historical.length} historical bookings are available; at least 5 are required.`,
      ],
    };
  }

  const slotCounts = new Map<
    string,
    {
      day: string;
      hour: number;
      bookings: ProfileBooking[];
    }
  >();

  for (const item of historical) {
    const slot = londonSlot(item.date);
    const key = `${slot.day}:${slot.hour}`;
    const current = slotCounts.get(key);

    if (current) {
      current.bookings.push(item.booking);
    } else {
      slotCounts.set(key, {
        ...slot,
        bookings: [item.booking],
      });
    }
  }

  const rankedSlots = Array.from(
    slotCounts.values(),
  ).sort(
    (first, second) =>
      second.bookings.length -
        first.bookings.length ||
      DAYS.indexOf(first.day) -
        DAYS.indexOf(second.day) ||
      first.hour - second.hour,
  );

  const strongest = rankedSlots[0];
  const slotShare =
    strongest.bookings.length /
    historical.length;

  const datedValues = historical.map(
    (item) => item.date.getTime(),
  );

  const gaps = datedValues
    .slice(1)
    .map(
      (value, index) =>
        (value - datedValues[index]) /
        86_400_000,
    )
    .filter((value) => value > 0);

  const medianGap = median(gaps);
  const deviations = gaps.map((gap) =>
    Math.abs(gap - medianGap),
  );
  const medianDeviation =
    median(deviations);

  const regularity =
    medianGap > 0
      ? Math.max(
          0,
          1 -
            Math.min(
              medianDeviation /
                medianGap,
              1,
            ),
        )
      : 0;

  const lastBooking =
    historical[historical.length - 1].date;

  const daysSinceLast =
    Math.max(
      0,
      (now.getTime() -
        lastBooking.getTime()) /
        86_400_000,
    );

  const recency =
    medianGap > 0
      ? Math.max(
          0,
          1 -
            Math.max(
              daysSinceLast -
                medianGap * 2,
              0,
            ) /
              Math.max(
                medianGap * 3,
                1,
              ),
        )
      : 0.5;

  const sampleScore = Math.min(
    25,
    historical.length * 1.25,
  );
  const patternScore = Math.min(
    35,
    slotShare * 70,
  );
  const regularityScore =
    regularity * 20;
  const recencyScore = recency * 20;

  const rawNeedScore =
    sampleScore +
    patternScore +
    regularityScore +
    recencyScore;

  const patternReliability =
    Math.min(
      1,
      0.5 + slotShare * 3,
    );

  const needScore = round(
    Math.min(
      100,
      rawNeedScore *
        patternReliability,
    ),
  );

  const confidence = round(
    Math.min(
      90,
      15 +
        Math.min(
          historical.length,
          30,
        ) *
          0.8 +
        Math.min(
          35,
          slotShare * 200,
        ) +
        regularity * 15,
    ),
  );

  const routePairs =
    strongest.bookings
      .map((booking) => {
        const pickup = locationLabel(
          booking,
          "PICKUP",
        );
        const destination = locationLabel(
          booking,
          "DESTINATION",
        );

        return pickup && destination
          ? `${pickup}|||${destination}`
          : null;
      })
      .filter(
        (value): value is string =>
          value !== null,
      );

  const route = mostFrequent(routePairs);

  const routeReliable =
    route !== null &&
    route[1] >= 3 &&
    route[1] /
      strongest.bookings.length >=
      0.25;

  const [
    pickup,
    destination,
  ] = routeReliable && route
    ? route[0].split("|||")
    : [null, null];

  const predictedStartAt = nextSlotDate(
    strongest.day,
    strongest.hour,
    now,
  );

  const startHour = String(
    strongest.hour,
  ).padStart(2, "0");
  const endHour = String(
    (strongest.hour + 3) % 24,
  ).padStart(2, "0");

  const explanation = [
    `${strongest.bookings.length} of ${historical.length} historical bookings occurred on ${strongest.day} between ${startHour}:00 and ${endHour}:00.`,
    `The strongest three-hour window represents ${round(slotShare * 100)}% of observed bookings.`,
    medianGap > 0
      ? medianGap < 1
        ? `The median interval between bookings is ${(medianGap * 24).toFixed(1)} hours.`
        : `The median interval between bookings is ${medianGap.toFixed(1)} days.`
      : "The booking interval is still being learned.",
  ];

  if (routeReliable && route) {
    explanation.push(
      `${route[1]} bookings in this window used the most common predicted route.`,
    );
  } else {
    explanation.push(
      "No route is shown because the repeated-route evidence is still too weak.",
    );
  }

  const signalStrength =
    needScore >= 70
      ? "HIGH"
      : needScore >= 50
        ? "MODERATE"
        : "LOW";

  return {
    status: "READY" as const,
    signalStrength,
    needScore,
    confidence,
    predictedDay: strongest.day,
    predictedHour: strongest.hour,
    predictedWindow:
      `${startHour}:00–${endHour}:00`,
    predictedStartAt:
      predictedStartAt?.toISOString() ??
      null,
    pickup,
    destination,
    routeObservations:
      routeReliable && route
        ? route[1]
        : 0,
    explanation,
  };
}
