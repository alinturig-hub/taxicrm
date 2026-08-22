import type { ProfileBooking } from "@/lib/customers/customer-profiler";

type ChangeSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

type BehaviourChange = {
  category:
    | "FREQUENCY"
    | "OUTCOMES"
    | "TIME"
    | "PAYMENT"
    | "CHANNEL"
    | "PICKUP";
  severity: ChangeSeverity;
  title: string;
  detail: string;
  evidence: string;
  sensitive: boolean;
};

export type CustomerBehaviourChange = {
  status: "READY" | "LEARNING";
  windowDays: number;
  recentBookings: number;
  previousBookings: number;
  changeScore: number | null;
  direction:
    | "INCREASING"
    | "DECLINING"
    | "STABLE"
    | "MIXED"
    | "LEARNING";
  changes: BehaviourChange[];
  explanation: string[];
};

const hourFormatter =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  });

function bookingTime(booking: ProfileBooking) {
  return (
    booking.pickupDueTime ??
    booking.bookedAtTime ??
    booking.completedAt
  );
}

function percentage(value: number, total: number) {
  return total > 0
    ? Number(((value / total) * 100).toFixed(1))
    : 0;
}

function mode(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    counts.set(
      value,
      (counts.get(value) ?? 0) + 1,
    );
  }

  const winner = Array.from(
    counts.entries(),
  ).sort(
    (first, second) => second[1] - first[1],
  )[0];

  return winner
    ? {
        value: winner[0],
        count: winner[1],
        share: percentage(
          winner[1],
          values.length,
        ),
      }
    : null;
}

function pickup(booking: ProfileBooking) {
  const location = booking.locations.find(
    (item) => item.type === "PICKUP",
  );

  return (
    location?.zoneName?.trim() ||
    location?.address?.trim() ||
    null
  );
}

function outcomeRates(
  bookings: ProfileBooking[],
) {
  const total = bookings.length;

  return {
    completion: percentage(
      bookings.filter(
        (booking) =>
          booking.status.toUpperCase() ===
          "COMPLETED",
      ).length,
      total,
    ),
    cancellation: percentage(
      bookings.filter(
        (booking) =>
          booking.status.toUpperCase() ===
          "CANCELLED",
      ).length,
      total,
    ),
    noFare: percentage(
      bookings.filter(
        (booking) =>
          booking.status
            .toUpperCase()
            .replace(/[^A-Z]/g, "") ===
          "NOFARE",
      ).length,
      total,
    ),
  };
}

function hour(booking: ProfileBooking) {
  const time = bookingTime(booking);

  if (!time) {
    return null;
  }

  const value = Number(
    hourFormatter.format(time),
  );

  return Number.isFinite(value)
    ? value % 24
    : null;
}

function hourDistance(
  first: number,
  second: number,
) {
  const direct = Math.abs(first - second);

  return Math.min(direct, 24 - direct);
}

function severity(
  magnitude: number,
): ChangeSeverity {
  return magnitude >= 50
    ? "HIGH"
    : magnitude >= 25
      ? "MEDIUM"
      : "LOW";
}

export function buildCustomerBehaviourChange(
  bookings: ProfileBooking[],
  now = new Date(),
  windowDays = 7,
): CustomerBehaviourChange {
  const windowMilliseconds =
    windowDays * 86_400_000;
  const recentFrom = new Date(
    now.getTime() - windowMilliseconds,
  );
  const previousFrom = new Date(
    now.getTime() -
      windowMilliseconds * 2,
  );

  const historical = bookings.filter(
    (booking) => {
      const time = bookingTime(booking);

      return time && time <= now;
    },
  );

  const recent = historical.filter(
    (booking) => {
      const time = bookingTime(booking)!;

      return time >= recentFrom;
    },
  );

  const previous = historical.filter(
    (booking) => {
      const time = bookingTime(booking)!;

      return (
        time >= previousFrom &&
        time < recentFrom
      );
    },
  );

  if (
    recent.length < 3 ||
    previous.length < 3
  ) {
    return {
      status: "LEARNING",
      windowDays,
      recentBookings: recent.length,
      previousBookings: previous.length,
      changeScore: null,
      direction: "LEARNING",
      changes: [],
      explanation: [
        `At least 3 bookings are required in each ${windowDays}-day comparison window.`,
        `Current coverage: ${recent.length} recent and ${previous.length} previous bookings.`,
      ],
    };
  }

  const changes: BehaviourChange[] = [];
  let changeScore = 0;

  const frequencyChange = Number(
    (
      (
        (recent.length - previous.length) /
        previous.length
      ) * 100
    ).toFixed(1),
  );

  if (Math.abs(frequencyChange) >= 20) {
    changes.push({
      category: "FREQUENCY",
      severity: severity(
        Math.abs(frequencyChange),
      ),
      title:
        frequencyChange > 0
          ? "Booking frequency increased"
          : "Booking frequency declined",
      detail:
        `${recent.length} bookings in the latest ${windowDays} days versus ${previous.length} previously.`,
      evidence:
        `${frequencyChange > 0 ? "+" : ""}${frequencyChange}% change`,
      sensitive: false,
    });

    changeScore += Math.min(
      Math.abs(frequencyChange) * 0.4,
      40,
    );
  }

  const recentOutcomes =
    outcomeRates(recent);
  const previousOutcomes =
    outcomeRates(previous);

  const completionDifference = Number(
    (
      recentOutcomes.completion -
      previousOutcomes.completion
    ).toFixed(1),
  );

  const cancellationDifference = Number(
    (
      recentOutcomes.cancellation -
      previousOutcomes.cancellation
    ).toFixed(1),
  );

  if (
    Math.abs(completionDifference) >= 20 ||
    Math.abs(cancellationDifference) >= 15
  ) {
    const declining =
      completionDifference < 0 ||
      cancellationDifference > 0;

    changes.push({
      category: "OUTCOMES",
      severity: severity(
        Math.max(
          Math.abs(completionDifference),
          Math.abs(cancellationDifference),
        ),
      ),
      title: declining
        ? "Booking outcomes changed"
        : "Booking outcomes improved",
      detail:
        `Completion moved from ${previousOutcomes.completion}% to ${recentOutcomes.completion}%; cancellation moved from ${previousOutcomes.cancellation}% to ${recentOutcomes.cancellation}%.`,
      evidence:
        `${completionDifference > 0 ? "+" : ""}${completionDifference} completion points`,
      sensitive: false,
    });

    changeScore += Math.min(
      Math.max(
        Math.abs(completionDifference),
        Math.abs(cancellationDifference),
      ),
      25,
    );
  }

  const recentHour = mode(
    recent
      .map(hour)
      .filter(
        (value): value is number =>
          value !== null,
      )
      .map(String),
  );

  const previousHour = mode(
    previous
      .map(hour)
      .filter(
        (value): value is number =>
          value !== null,
      )
      .map(String),
  );

  if (
    recentHour &&
    previousHour &&
    recentHour.share >= 25 &&
    previousHour.share >= 25
  ) {
    const difference = hourDistance(
      Number(recentHour.value),
      Number(previousHour.value),
    );

    if (difference >= 4) {
      changes.push({
        category: "TIME",
        severity:
          difference >= 8
            ? "MEDIUM"
            : "LOW",
        title: "Usual booking time shifted",
        detail:
          `The dominant hour moved from ${previousHour.value.padStart(2, "0")}:00 to ${recentHour.value.padStart(2, "0")}:00.`,
        evidence:
          `${difference}-hour shift`,
        sensitive: false,
      });

      changeScore += Math.min(
        difference * 2,
        15,
      );
    }
  }

  const preferenceChecks = [
    {
      category: "PAYMENT" as const,
      title: "Payment preference changed",
      recent: mode(
        recent.flatMap((booking) =>
          booking.paymentType
            ? [booking.paymentType]
            : [],
        ),
      ),
      previous: mode(
        previous.flatMap((booking) =>
          booking.paymentType
            ? [booking.paymentType]
            : [],
        ),
      ),
    },
    {
      category: "CHANNEL" as const,
      title: "Booking channel changed",
      recent: mode(
        recent.flatMap((booking) =>
          booking.bookingSource
            ? [booking.bookingSource]
            : [],
        ),
      ),
      previous: mode(
        previous.flatMap((booking) =>
          booking.bookingSource
            ? [booking.bookingSource]
            : [],
        ),
      ),
    },
    {
      category: "PICKUP" as const,
      title: "Usual pickup area changed",
      recent: mode(
        recent.flatMap((booking) => {
          const value = pickup(booking);
          return value ? [value] : [];
        }),
      ),
      previous: mode(
        previous.flatMap((booking) => {
          const value = pickup(booking);
          return value ? [value] : [];
        }),
      ),
    },
  ];

  for (const check of preferenceChecks) {
    if (
      check.recent &&
      check.previous &&
      check.recent.value !==
        check.previous.value &&
      check.recent.share >= 40 &&
      check.previous.share >= 40
    ) {
      changes.push({
        category: check.category,
        severity: "LOW",
        title: check.title,
        detail:
          `Dominant value moved from ${check.previous.value} to ${check.recent.value}.`,
        evidence:
          `${check.recent.share}% of recent bookings`,
        sensitive:
          check.category === "PICKUP",
      });

      changeScore += 10;
    }
  }

  const decliningSignals = changes.filter(
    (change) =>
      change.title
        .toLowerCase()
        .includes("declined") ||
      (
        change.category === "OUTCOMES" &&
        completionDifference < 0
      ),
  ).length;

  const increasingSignals = changes.filter(
    (change) =>
      change.title
        .toLowerCase()
        .includes("increased") ||
      change.title
        .toLowerCase()
        .includes("improved"),
  ).length;

  const direction =
    changes.length === 0
      ? "STABLE"
      : decliningSignals > 0 &&
          increasingSignals > 0
        ? "MIXED"
        : decliningSignals > 0
          ? "DECLINING"
          : increasingSignals > 0
            ? "INCREASING"
            : "MIXED";

  return {
    status: "READY",
    windowDays,
    recentBookings: recent.length,
    previousBookings: previous.length,
    changeScore: Math.min(
      100,
      Math.round(changeScore),
    ),
    direction,
    changes,
    explanation: [
      `Compared the latest ${windowDays} days with the preceding ${windowDays} days.`,
      "Only material differences above minimum thresholds are shown.",
      "A detected change is a signal for review, not proof of a personal life event.",
    ],
  };
}
