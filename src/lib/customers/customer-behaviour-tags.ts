const WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

type TagBooking = {
  status: string;
  bookedAtTime: Date | null;
  pickupDueTime: Date | null;
  locations: Array<{
    type: "PICKUP" | "DESTINATION";
    address: string;
    zoneName: string | null;
  }>;
};

export type CustomerBehaviourTag = {
  id: string;
  label: string;
  category:
    | "PLACE"
    | "TIME"
    | "BOOKING"
    | "FREQUENCY"
    | "ROUTE";
  confidence:
    | "EMERGING"
    | "ESTABLISHED"
    | "STRONG";
  evidenceCount: number;
  eligibleCount: number;
  percentage: number;
  windowDays: 14;
  lastObservedAt: string | null;
  explanation: string;
};

const londonTimeFormatter =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    hour: "2-digit",
    hourCycle: "h23",
  });

function bookingDate(
  booking: TagBooking,
) {
  return (
    booking.pickupDueTime ??
    booking.bookedAtTime
  );
}

function percentage(
  count: number,
  total: number,
) {
  return total > 0
    ? Number(
        (
          (count / total) *
          100
        ).toFixed(1),
      )
    : 0;
}

function confidence(
  count: number,
  share: number,
): CustomerBehaviourTag["confidence"] {
  if (
    count >= 8 &&
    share >= 60
  ) {
    return "STRONG";
  }

  if (count >= 5) {
    return "ESTABLISHED";
  }

  return "EMERGING";
}

function lastObservedAt(
  bookings: TagBooking[],
) {
  const dates = bookings
    .map(bookingDate)
    .filter(
      (value): value is Date =>
        value !== null,
    )
    .sort(
      (first, second) =>
        second.getTime() -
        first.getTime(),
    );

  return dates[0]?.toISOString() ?? null;
}

function normalizePlace(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function locationText(
  booking: TagBooking,
  destinationOnly = false,
) {
  return normalizePlace(
    booking.locations
      .filter(
        (location) =>
          !destinationOnly ||
          location.type ===
            "DESTINATION",
      )
      .flatMap(
        (location) => [
          location.address,
          location.zoneName ?? "",
        ],
      )
      .join(" "),
  );
}

function londonTime(
  booking: TagBooking,
) {
  const date =
    bookingDate(booking);

  if (!date) {
    return null;
  }

  const parts =
    londonTimeFormatter.formatToParts(
      date,
    );

  const weekday =
    parts.find(
      (part) =>
        part.type === "weekday",
    )?.value ?? "";

  const rawHour = Number(
    parts.find(
      (part) =>
        part.type === "hour",
    )?.value,
  );

  if (!Number.isFinite(rawHour)) {
    return null;
  }

  return {
    weekday,
    hour:
      rawHour === 24
        ? 0
        : rawHour,
  };
}

function routeKey(
  booking: TagBooking,
) {
  const pickup =
    booking.locations.find(
      (location) =>
        location.type === "PICKUP",
    );
  const destination =
    booking.locations.find(
      (location) =>
        location.type ===
        "DESTINATION",
    );

  if (!pickup || !destination) {
    return null;
  }

  const pickupKey =
    normalizePlace(
      pickup.zoneName ||
        pickup.address,
    );
  const destinationKey =
    normalizePlace(
      destination.zoneName ||
        destination.address,
    );

  if (
    !pickupKey ||
    !destinationKey
  ) {
    return null;
  }

  return `${pickupKey}::${destinationKey}`;
}

export function buildCustomerBehaviourTags(
  bookings: TagBooking[],
  now = new Date(),
) {
  const windowStart =
    now.getTime() -
    WINDOW_DAYS *
      DAY_MS;

  const windowBookings =
    bookings.filter(
      (booking) => {
        const date =
          bookingDate(booking);

        return Boolean(
          date &&
            date.getTime() >=
              windowStart &&
            date.getTime() <=
              now.getTime(),
        );
      },
    );

  const completedJourneys =
    windowBookings.filter(
      (booking) =>
        booking.status.toUpperCase() ===
        "COMPLETED",
    );

  const tags:
    CustomerBehaviourTag[] = [];

  function addTag({
    id,
    label,
    category,
    matches,
    eligibleCount,
    minimumCount = 3,
    minimumPercentage = 40,
    explanation,
  }: {
    id: string;
    label: string;
    category:
      CustomerBehaviourTag["category"];
    matches: TagBooking[];
    eligibleCount: number;
    minimumCount?: number;
    minimumPercentage?: number;
    explanation: (
      count: number,
      share: number,
    ) => string;
  }) {
    const count =
      matches.length;
    const share =
      percentage(
        count,
        eligibleCount,
      );

    if (
      count < minimumCount ||
      share < minimumPercentage
    ) {
      return;
    }

    tags.push({
      id,
      label,
      category,
      confidence:
        confidence(
          count,
          share,
        ),
      evidenceCount:
        count,
      eligibleCount,
      percentage:
        share,
      windowDays:
        WINDOW_DAYS,
      lastObservedAt:
        lastObservedAt(matches),
      explanation:
        explanation(
          count,
          share,
        ),
    });
  }

  const placeRules = [
    {
      id: "SHOPPING_USER",
      label: "Shopping User",
      destinationOnly: true,
      pattern:
        /\b(shopping centre|shopping center|mall|retail park|supermarket|tesco|sainsbury|asda|aldi|lidl|morrisons|waitrose|marks and spencer|drake circus)\b/,
    },
    {
      id: "PUB_NIGHTLIFE_USER",
      label: "Pub / Nightlife User",
      destinationOnly: false,
      pattern:
        /\b(pub|public house|bar|nightclub|night club|wetherspoon|late bar)\b/,
    },
    {
      id: "TRAIN_STATION_USER",
      label: "Train Station User",
      destinationOnly: false,
      pattern:
        /\b(train station|railway station|rail station|plymouth station)\b/,
    },
    {
      id: "AIRPORT_USER",
      label: "Airport User",
      destinationOnly: false,
      pattern:
        /\b(airport|airport terminal)\b/,
    },
  ];

  for (const rule of placeRules) {
    const matches =
      completedJourneys.filter(
        (booking) =>
          rule.pattern.test(
            locationText(
              booking,
              rule.destinationOnly,
            ),
          ),
      );

    addTag({
      id: rule.id,
      label: rule.label,
      category: "PLACE",
      matches,
      eligibleCount:
        completedJourneys.length,
      explanation:
        (count, share) =>
          `${count} of ${completedJourneys.length} completed journeys matched this place pattern (${share}%).`,
    });
  }

  const timedJourneys =
    completedJourneys.filter(
      (booking) =>
        londonTime(booking) !==
        null,
    );

  addTag({
    id: "EARLY_MORNING_USER",
    label: "Early Morning User",
    category: "TIME",
    matches:
      timedJourneys.filter(
        (booking) => {
          const time =
            londonTime(booking);

          return Boolean(
            time &&
              time.hour >= 4 &&
              time.hour < 8,
          );
        },
      ),
    eligibleCount:
      timedJourneys.length,
    explanation:
      (count, share) =>
        `${count} completed journeys started between 04:00 and 08:00 London time (${share}%).`,
  });

  addTag({
    id: "LATE_EVENING_USER",
    label: "Late Evening User",
    category: "TIME",
    matches:
      timedJourneys.filter(
        (booking) => {
          const time =
            londonTime(booking);

          return Boolean(
            time &&
              (
                time.hour >= 22 ||
                time.hour < 4
              ),
          );
        },
      ),
    eligibleCount:
      timedJourneys.length,
    explanation:
      (count, share) =>
        `${count} completed journeys started between 22:00 and 04:00 London time (${share}%).`,
  });

  addTag({
    id: "WEEKEND_USER",
    label: "Weekend User",
    category: "TIME",
    matches:
      timedJourneys.filter(
        (booking) => {
          const weekday =
            londonTime(
              booking,
            )?.weekday;

          return (
            weekday ===
              "Saturday" ||
            weekday ===
              "Sunday"
          );
        },
      ),
    eligibleCount:
      timedJourneys.length,
    minimumPercentage:
      50,
    explanation:
      (count, share) =>
        `${count} completed journeys occurred during the weekend (${share}%).`,
  });

  const leadTimeBookings =
    windowBookings.filter(
      (booking) =>
        booking.bookedAtTime &&
        booking.pickupDueTime &&
        booking.pickupDueTime.getTime() >=
          booking.bookedAtTime.getTime(),
    );

  addTag({
    id: "SHORT_NOTICE_BOOKER",
    label: "Short Notice Booker",
    category: "BOOKING",
    matches:
      leadTimeBookings.filter(
        (booking) => {
          const leadMinutes =
            (
              booking
                .pickupDueTime!
                .getTime() -
              booking
                .bookedAtTime!
                .getTime()
            ) /
            60_000;

          return leadMinutes <= 30;
        },
      ),
    eligibleCount:
      leadTimeBookings.length,
    minimumPercentage:
      50,
    explanation:
      (count, share) =>
        `${count} bookings were made no more than 30 minutes before pickup (${share}%).`,
  });

  addTag({
    id: "ADVANCE_BOOKER",
    label: "Advance Booker",
    category: "BOOKING",
    matches:
      leadTimeBookings.filter(
        (booking) => {
          const leadMinutes =
            (
              booking
                .pickupDueTime!
                .getTime() -
              booking
                .bookedAtTime!
                .getTime()
            ) /
            60_000;

          return leadMinutes >= 360;
        },
      ),
    eligibleCount:
      leadTimeBookings.length,
    minimumPercentage:
      50,
    explanation:
      (count, share) =>
        `${count} bookings were made at least six hours before pickup (${share}%).`,
  });

  if (
    windowBookings.length >= 12
  ) {
    tags.push({
      id:
        "HIGHLY_ACTIVE_CUSTOMER",
      label:
        "Highly Active Customer",
      category:
        "FREQUENCY",
      confidence:
        windowBookings.length >= 16
          ? "STRONG"
          : "ESTABLISHED",
      evidenceCount:
        windowBookings.length,
      eligibleCount:
        windowBookings.length,
      percentage:
        100,
      windowDays:
        WINDOW_DAYS,
      lastObservedAt:
        lastObservedAt(
          windowBookings,
        ),
      explanation:
        `${windowBookings.length} bookings were recorded during the last 14 days.`,
    });
  } else if (
    windowBookings.length >= 6
  ) {
    tags.push({
      id:
        "FREQUENT_CUSTOMER",
      label:
        "Frequent Customer",
      category:
        "FREQUENCY",
      confidence:
        windowBookings.length >= 8
          ? "STRONG"
          : "ESTABLISHED",
      evidenceCount:
        windowBookings.length,
      eligibleCount:
        windowBookings.length,
      percentage:
        100,
      windowDays:
        WINDOW_DAYS,
      lastObservedAt:
        lastObservedAt(
          windowBookings,
        ),
      explanation:
        `${windowBookings.length} bookings were recorded during the last 14 days.`,
    });
  }

  const routes =
    new Map<
      string,
      TagBooking[]
    >();

  for (
    const booking
    of completedJourneys
  ) {
    const key =
      routeKey(booking);

    if (!key) {
      continue;
    }

    const existing =
      routes.get(key) ??
      [];

    existing.push(booking);
    routes.set(
      key,
      existing,
    );
  }

  const strongestRoute =
    Array.from(
      routes.values(),
    ).sort(
      (first, second) =>
        second.length -
        first.length,
    )[0] ?? [];

  if (
    strongestRoute.length >= 3
  ) {
    const share =
      percentage(
        strongestRoute.length,
        completedJourneys.length,
      );

    tags.push({
      id:
        "REGULAR_ROUTE_USER",
      label:
        "Regular Route User",
      category:
        "ROUTE",
      confidence:
        confidence(
          strongestRoute.length,
          share,
        ),
      evidenceCount:
        strongestRoute.length,
      eligibleCount:
        completedJourneys.length,
      percentage:
        share,
      windowDays:
        WINDOW_DAYS,
      lastObservedAt:
        lastObservedAt(
          strongestRoute,
        ),
      explanation:
        `${strongestRoute.length} completed journeys followed the same pickup-to-destination pattern (${share}%).`,
    });
  }

  const categoryOrder = {
    FREQUENCY: 0,
    ROUTE: 1,
    PLACE: 2,
    TIME: 3,
    BOOKING: 4,
  };

  return tags.sort(
    (first, second) =>
      categoryOrder[
        first.category
      ] -
        categoryOrder[
          second.category
        ] ||
      second.evidenceCount -
        first.evidenceCount ||
      first.label.localeCompare(
        second.label,
      ),
  );
}
