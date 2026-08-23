export type ContextualBooking = {
  externalId: string;
  bookedAtTime?: Date | string | null;
  pickupDueTime?: Date | string | null;
  locations?: Array<{
    type?: string;
    address?: string | null;
    zoneName?: string | null;
    placeIntelligence?: {
      placeName?: string | null;
      formattedAddress?: string | null;
      isSensitive?: boolean;
      status?: string;
    } | null;
  }>;
};

export type ContextualEvent = {
  id: string;
  title: string;
  category: string;
  startsAt: Date | string;
  endsAt: Date | string;
  locationName?: string | null;
  impactLevel: string;
  source: string;
};

export type CustomerContextualIntelligence = {
  status: "READY" | "LEARNING";
  analysedBookings: number;
  availableEvents: number;
  matchedBookings: number;
  matchedBookingPercentage: number;
  eventHours: number;
  normalHours: number;
  eventBookingsPer100Hours: number | null;
  normalBookingsPer100Hours: number | null;
  liftPercent: number | null;
  tendency:
    | "MORE_ACTIVE_DURING_EVENTS"
    | "LESS_ACTIVE_DURING_EVENTS"
    | "NO_CLEAR_DIFFERENCE"
    | "LEARNING";
  confidence: number;
  categories: Array<{
    category: string;
    bookings: number;
    events: number;
    percentage: number;
  }>;
  strongestAssociations: Array<{
    eventId: string;
    title: string;
    category: string;
    startsAt: string;
    endsAt: string;
    locationName: string | null;
    impactLevel: string;
    source: string;
    bookings: number;
    bookingIds: string[];
  }>;
  message: string;
  explanation: string[];
};

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

function bookingTimestamp(
  booking: ContextualBooking,
) {
  return (
    timestamp(booking.pickupDueTime) ??
    timestamp(booking.bookedAtTime)
  );
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

function round(value: number) {
  return Number(value.toFixed(2));
}

function hourKey(value: number) {
  return Math.floor(value / 3_600_000);
}

function eventImpactBufferMilliseconds(
  category: string,
) {
  return category.trim().toUpperCase() ===
    "SPORT"
    ? 2 * 60 * 60 * 1000
    : 0;
}

const ignoredLocationTokens = new Set([
  "plymouth",
  "united",
  "kingdom",
  "uk",
  "england",
]);

function normaliseLocationText(
  value: string | null | undefined,
) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function locationTokens(
  value: string | null | undefined,
) {
  return normaliseLocationText(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !ignoredLocationTokens.has(token),
    );
}

const excludedSportPlaceIndicators = [
  "petrol",
  "fuel",
  "garage",
  "service station",
];

const sportVenueIndicators = [
  "stadium",
  "football club",
  "rugby club",
  "sports ground",
  "arena",
  "argyle fc",
];

function containsEveryLocationToken(
  candidate: string,
  expectedTokens: string[],
) {
  return (
    candidate.length > 0 &&
    expectedTokens.every((token) =>
      candidate.includes(token),
    )
  );
}

function bookingMatchesEventLocation(
  booking: ContextualBooking,
  event: ContextualEvent,
) {
  if (
    event.category.trim().toUpperCase() !==
    "SPORT"
  ) {
    return true;
  }

  const expectedTokens = locationTokens(
    event.locationName,
  );

  if (expectedTokens.length === 0) {
    return false;
  }

  for (const location of booking.locations ?? []) {
    const place =
      location.placeIntelligence;

    if (place?.isSensitive) {
      continue;
    }

    const combinedLocationText =
      normaliseLocationText(
        [
          location.address,
          location.zoneName,
          place?.placeName,
          place?.formattedAddress,
        ]
          .filter(Boolean)
          .join(" "),
      );

    const excluded =
      excludedSportPlaceIndicators.some(
        (indicator) =>
          combinedLocationText.includes(
            indicator,
          ),
      );

    if (excluded) {
      continue;
    }

    const verifiedPlaceName =
      place?.status === "READY"
        ? normaliseLocationText(
            place.placeName,
          )
        : "";

    if (
      containsEveryLocationToken(
        verifiedPlaceName,
        expectedTokens,
      )
    ) {
      return true;
    }

    const recordedLocationText =
      normaliseLocationText(
        [
          location.address,
          location.zoneName,
          place?.status === "READY"
            ? place.formattedAddress
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      );

    const venueEvidence =
      sportVenueIndicators.some(
        (indicator) =>
          recordedLocationText.includes(
            indicator,
          ),
      );

    if (
      venueEvidence &&
      containsEveryLocationToken(
        recordedLocationText,
        expectedTokens,
      )
    ) {
      return true;
    }
  }

  return false;
}

export function buildCustomerContextualIntelligence(
  bookings: ContextualBooking[],
  events: ContextualEvent[],
): CustomerContextualIntelligence {
  const timedBookings = bookings
    .map((booking) => ({
      booking,
      time: bookingTimestamp(booking),
    }))
    .filter(
      (
        item,
      ): item is {
        booking: ContextualBooking;
        time: number;
      } => item.time !== null,
    );

  let validEvents = events
    .map((event) => {
      const originalStart =
        timestamp(event.startsAt);
      const originalEnd =
        timestamp(event.endsAt);

      const impactBuffer =
        eventImpactBufferMilliseconds(
          event.category,
        );

      return {
        ...event,
        originalStart,
        originalEnd,
        start:
          originalStart === null
            ? null
            : originalStart -
              impactBuffer,
        end:
          originalEnd === null
            ? null
            : originalEnd +
              impactBuffer,
        impactBuffer,
      };
    })
    .filter(
      (
        event,
      ): event is ContextualEvent & {
        originalStart: number;
        originalEnd: number;
        start: number;
        end: number;
        impactBuffer: number;
      } =>
        event.originalStart !== null &&
        event.originalEnd !== null &&
        event.originalEnd >
          event.originalStart &&
        event.start !== null &&
        event.end !== null &&
        event.end > event.start,
    );

  if (
    timedBookings.length === 0 ||
    validEvents.length === 0
  ) {
    return {
      status: "LEARNING",
      analysedBookings:
        timedBookings.length,
      availableEvents: validEvents.length,
      matchedBookings: 0,
      matchedBookingPercentage: 0,
      eventHours: 0,
      normalHours: 0,
      eventBookingsPer100Hours: null,
      normalBookingsPer100Hours: null,
      liftPercent: null,
      tendency: "LEARNING",
      confidence: 0,
      categories: [],
      strongestAssociations: [],
      message:
        validEvents.length === 0
          ? "No active contextual events overlap this customer's booking history yet."
          : "More timestamped booking history is required.",
      explanation: [
        "Only active events overlapping the customer's recorded booking period are evaluated.",
        "Event association does not prove that an event caused a booking.",
      ],
    };
  }

  const firstBooking = Math.min(
    ...timedBookings.map((item) => item.time),
  );
  const lastBooking = Math.max(
    ...timedBookings.map((item) => item.time),
  );

  const coverageStart =
    hourKey(firstBooking) * 3_600_000;

  const coverageEnd =
    (hourKey(lastBooking) + 1) *
    3_600_000;

  validEvents = validEvents.filter(
    (event) =>
      event.end > coverageStart &&
      event.start < coverageEnd,
  );

  const eventHourKeys = new Set<number>();

  for (const event of validEvents) {
    const clippedStart = Math.max(
      event.start,
      coverageStart,
    );

    const clippedEnd = Math.min(
      event.end,
      coverageEnd,
    );

    const firstHour =
      hourKey(clippedStart);

    const lastHour = hourKey(
      Math.max(
        clippedEnd - 1,
        clippedStart,
      ),
    );

    for (
      let hour = firstHour;
      hour <= lastHour;
      hour++
    ) {
      eventHourKeys.add(hour);
    }
  }

  const totalHours = Math.max(
    Math.ceil(
      (coverageEnd - coverageStart) /
        3_600_000,
    ),
    1,
  );

  const eventHours = eventHourKeys.size;
  const normalHours = Math.max(
    totalHours - eventHours,
    0,
  );

  const matchedBookingIds = new Set<string>();
  const associationRows: CustomerContextualIntelligence[
    "strongestAssociations"
  ] = [];

  const categoryBookings =
    new Map<string, Set<string>>();
  const categoryEvents =
    new Map<string, Set<string>>();

  for (const event of validEvents) {
    const matching = timedBookings.filter(
      (item) =>
        item.time >= event.start &&
        item.time < event.end &&
        bookingMatchesEventLocation(
          item.booking,
          event,
        ),
    );

    const bookingIds = Array.from(
      new Set(
        matching.map(
          (item) =>
            item.booking.externalId,
        ),
      ),
    );

    for (const bookingId of bookingIds) {
      matchedBookingIds.add(bookingId);
    }

    if (
      !categoryEvents.has(event.category)
    ) {
      categoryEvents.set(
        event.category,
        new Set(),
      );
    }

    categoryEvents
      .get(event.category)
      ?.add(event.id);

    if (bookingIds.length > 0) {
      if (
        !categoryBookings.has(
          event.category,
        )
      ) {
        categoryBookings.set(
          event.category,
          new Set(),
        );
      }

      for (const bookingId of bookingIds) {
        categoryBookings
          .get(event.category)
          ?.add(bookingId);
      }

      associationRows.push({
        eventId: event.id,
        title: event.title,
        category: event.category,
        startsAt: new Date(
          event.originalStart,
        ).toISOString(),
        endsAt: new Date(
          event.originalEnd,
        ).toISOString(),
        locationName:
          event.locationName ?? null,
        impactLevel: event.impactLevel,
        source: event.source,
        bookings: bookingIds.length,
        bookingIds,
      });
    }
  }

  const matchedBookings =
    matchedBookingIds.size;
  const normalBookings = Math.max(
    timedBookings.length - matchedBookings,
    0,
  );

  const eventRate =
    eventHours > 0
      ? round(
          (matchedBookings / eventHours) *
            100,
        )
      : null;

  const normalRate =
    normalHours > 0
      ? round(
          (normalBookings / normalHours) *
            100,
        )
      : null;

  const enoughComparison =
    eventHours >= 6 &&
    normalHours >= 24 &&
    matchedBookings >= 3 &&
    eventRate !== null &&
    normalRate !== null;

  const liftPercent =
    enoughComparison && normalRate > 0
      ? Number(
          (
            ((eventRate - normalRate) /
              normalRate) *
            100
          ).toFixed(1),
        )
      : null;

  const tendency =
    liftPercent === null
      ? "LEARNING"
      : liftPercent >= 20
        ? "MORE_ACTIVE_DURING_EVENTS"
        : liftPercent <= -20
          ? "LESS_ACTIVE_DURING_EVENTS"
          : "NO_CLEAR_DIFFERENCE";

  const confidence = enoughComparison
    ? Math.min(
        95,
        Math.round(
          45 +
            Math.min(
              matchedBookings * 4,
              30,
            ) +
            Math.min(
              validEvents.length * 2,
              20,
            ),
        ),
      )
    : Math.min(
        55,
        matchedBookings * 8 +
          validEvents.length * 2,
      );

  const categories = Array.from(
    categoryEvents.entries(),
  )
    .map(([category, eventIds]) => {
      const bookingsForCategory =
        categoryBookings.get(category)
          ?.size ?? 0;

      return {
        category,
        bookings: bookingsForCategory,
        events: eventIds.size,
        percentage: percentage(
          bookingsForCategory,
          timedBookings.length,
        ),
      };
    })
    .sort(
      (first, second) =>
        second.bookings -
          first.bookings ||
        second.events - first.events,
    );

  const strongestAssociations =
    associationRows
      .sort(
        (first, second) =>
          second.bookings -
            first.bookings ||
          new Date(
            second.startsAt,
          ).getTime() -
            new Date(
              first.startsAt,
            ).getTime(),
      )
      .slice(0, 10);

  const message =
    tendency ===
    "MORE_ACTIVE_DURING_EVENTS"
      ? "This customer books more frequently during recorded event hours than during normal hours."
      : tendency ===
          "LESS_ACTIVE_DURING_EVENTS"
        ? "This customer books less frequently during recorded event hours than during normal hours."
        : tendency ===
            "NO_CLEAR_DIFFERENCE"
          ? "No meaningful difference between event and normal booking activity was detected."
          : matchedBookings > 0
            ? "Some bookings overlap recorded events, but more evidence is required for a reliable comparison."
            : "No bookings currently overlap the recorded events.";

  return {
    status: enoughComparison
      ? "READY"
      : "LEARNING",
    analysedBookings:
      timedBookings.length,
    availableEvents: validEvents.length,
    matchedBookings,
    matchedBookingPercentage: percentage(
      matchedBookings,
      timedBookings.length,
    ),
    eventHours,
    normalHours,
    eventBookingsPer100Hours: eventRate,
    normalBookingsPer100Hours: normalRate,
    liftPercent,
    tendency,
    confidence,
    categories,
    strongestAssociations,
    message,
    explanation: [
      `${validEvents.length} active events overlapping the recorded period were evaluated.`,
      `${matchedBookings} of ${timedBookings.length} bookings occurred during at least one recorded event.`,
      "Booking rates are normalised per 100 event and normal hours.",
      "Sports events include a two-hour arrival window before and a two-hour departure window after the recorded event.",
      "Sports associations also require a matching non-sensitive pickup or destination location.",
      "This is contextual association only and does not prove that an event caused a booking.",
    ],
  };
}
