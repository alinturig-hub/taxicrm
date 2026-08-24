type ReturnJourneyLocation = {
  type: "PICKUP" | "DESTINATION";
  zoneName?: string | null;
  placeIntelligence?: {
    isSensitive: boolean;
  } | null;
};

export type ReturnJourneyBooking = {
  externalId: string;
  bookedAtTime?: Date | string | null;
  pickupDueTime?: Date | string | null;
  locations: ReturnJourneyLocation[];
};

export type CustomerReturnJourney = {
  status: "READY" | "LEARNING";
  analysedJourneys: number;
  excludedSensitiveJourneys: number;
  returnPairs: number;
  returnRate: number;
  typicalReturnHours: number | null;
  typicalReturnLabel: string;
  returnWindow:
    | "QUICK_RETURN"
    | "SAME_PART_OF_DAY"
    | "LATER_SAME_DAY"
    | "NEXT_DAY"
    | "LEARNING";
  confidence: number;
  strongestRoutes: Array<{
    pickupZone: string;
    destinationZone: string;
    returnPairs: number;
    sharePercent: number;
    typicalReturnHours: number;
  }>;
  explanation: string[];
};

type Journey = {
  externalId: string;
  time: number;
  pickupZone: string;
  pickupKey: string;
  destinationZone: string;
  destinationKey: string;
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

function normaliseZone(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const ordered = [...values].sort(
    (first, second) => first - second,
  );

  const middle = Math.floor(
    ordered.length / 2,
  );

  return ordered.length % 2 === 0
    ? (
        ordered[middle - 1] +
        ordered[middle]
      ) / 2
    : ordered[middle];
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

function returnWindow(
  hours: number | null,
): CustomerReturnJourney["returnWindow"] {
  if (hours === null) {
    return "LEARNING";
  }

  if (hours < 2) {
    return "QUICK_RETURN";
  }

  if (hours < 6) {
    return "SAME_PART_OF_DAY";
  }

  if (hours < 12) {
    return "LATER_SAME_DAY";
  }

  return "NEXT_DAY";
}

function returnLabel(hours: number | null) {
  if (hours === null) {
    return "Still learning";
  }

  if (hours < 1) {
    return `${Math.round(hours * 60)} minutes`;
  }

  return `${Number(hours.toFixed(1))} hours`;
}

export function buildCustomerReturnJourney(
  bookings: ReturnJourneyBooking[],
): CustomerReturnJourney {
  let excludedSensitiveJourneys = 0;

  const journeys = bookings
    .map((booking): Journey | null => {
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

      if (
        pickup.placeIntelligence
          ?.isSensitive ||
        destination.placeIntelligence
          ?.isSensitive
      ) {
        excludedSensitiveJourneys += 1;
        return null;
      }

      const pickupZone =
        pickup.zoneName?.trim();
      const destinationZone =
        destination.zoneName?.trim();

      const time =
        timestamp(
          booking.pickupDueTime ??
            booking.bookedAtTime,
        );

      if (
        !pickupZone ||
        !destinationZone ||
        time === null
      ) {
        return null;
      }

      return {
        externalId: booking.externalId,
        time,
        pickupZone,
        pickupKey:
          normaliseZone(pickupZone),
        destinationZone,
        destinationKey:
          normaliseZone(destinationZone),
      };
    })
    .filter(
      (journey): journey is Journey =>
        journey !== null,
    )
    .sort(
      (first, second) =>
        first.time - second.time ||
        first.externalId.localeCompare(
          second.externalId,
        ),
    );

  const maximumReturnMilliseconds =
    24 * 60 * 60 * 1000;

  const returnHours: number[] = [];

  const routes = new Map<
    string,
    {
      pickupZone: string;
      destinationZone: string;
      returnPairs: number;
      hours: number[];
    }
  >();

  for (
    let index = 0;
    index < journeys.length - 1;
    index += 1
  ) {
    const outbound = journeys[index];
    const returning = journeys[index + 1];

    const elapsed =
      returning.time - outbound.time;

    if (
      elapsed <= 0 ||
      elapsed > maximumReturnMilliseconds ||
      returning.pickupKey !==
        outbound.destinationKey ||
      returning.destinationKey !==
        outbound.pickupKey
    ) {
      continue;
    }

    const hours =
      elapsed / (60 * 60 * 1000);

    returnHours.push(hours);

    const orderedKeys = [
      outbound.pickupKey,
      outbound.destinationKey,
    ].sort();

    const routeKey =
      orderedKeys.join("::");

    const existing =
      routes.get(routeKey) ?? {
        pickupZone:
          outbound.pickupZone,
        destinationZone:
          outbound.destinationZone,
        returnPairs: 0,
        hours: [],
      };

    existing.returnPairs += 1;
    existing.hours.push(hours);

    routes.set(routeKey, existing);
  }

  const returnPairs =
    returnHours.length;

  const typicalHours =
    median(returnHours);

  const roundedTypicalHours =
    typicalHours === null
      ? null
      : Number(typicalHours.toFixed(1));

  const status =
    journeys.length >= 5 &&
    returnPairs >= 2
      ? "READY"
      : "LEARNING";

  const confidence =
    status === "READY"
      ? Math.min(
          95,
          Math.round(
            35 +
            Math.min(journeys.length, 20) *
              1.5 +
            Math.min(returnPairs, 10) * 3,
          ),
        )
      : Math.min(
          49,
          journeys.length * 5 +
            returnPairs * 5,
        );

  const strongestRoutes =
    Array.from(routes.values())
      .filter(
        (route) =>
          route.returnPairs >= 2,
      )
      .map((route) => ({
        pickupZone: route.pickupZone,
        destinationZone:
          route.destinationZone,
        returnPairs:
          route.returnPairs,
        sharePercent: percentage(
          route.returnPairs,
          returnPairs,
        ),
        typicalReturnHours: Number(
          (
            median(route.hours) ?? 0
          ).toFixed(1),
        ),
      }))
      .sort(
        (first, second) =>
          second.returnPairs -
          first.returnPairs,
      )
      .slice(0, 5);

  const explanation = [
    `${journeys.length} journeys with both pickup and destination zones were evaluated.`,
    `${returnPairs} journeys were followed by a reverse journey within 24 hours.`,
    typicalHours === null
      ? "More observations are required to estimate a typical return time."
      : `The typical observed return interval is ${returnLabel(typicalHours)}.`,
    "Return matching uses broad operational zones and does not infer the purpose of a journey.",
  ];

  if (excludedSensitiveJourneys > 0) {
    explanation.push(
      `${excludedSensitiveJourneys} journeys involving protected places were excluded.`,
    );
  }

  return {
    status,
    analysedJourneys:
      journeys.length,
    excludedSensitiveJourneys,
    returnPairs,
    returnRate: percentage(
      returnPairs,
      Math.max(journeys.length - 1, 0),
    ),
    typicalReturnHours:
      roundedTypicalHours,
    typicalReturnLabel:
      returnLabel(typicalHours),
    returnWindow:
      returnWindow(typicalHours),
    confidence,
    strongestRoutes,
    explanation,
  };
}
