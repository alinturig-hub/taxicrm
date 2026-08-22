import type { ProfileBooking } from "@/lib/customers/customer-profiler";

type OperationalBooking =
  ProfileBooking & {
    passengers?: number | null;
    luggage?: number | null;
    capabilities?: unknown;
  };

export type CustomerOperationalPreferences = {
  status: "READY" | "LEARNING";
  analysedBookings: number;
  leadTime: {
    medianMinutes: number | null;
    medianLabel: string;
    immediateBookings: number;
    plannedBookings: number;
    advanceBookings: number;
    immediatePercentage: number;
    plannedPercentage: number;
    advancePercentage: number;
    preferredBookingStyle:
      | "IMMEDIATE"
      | "PLANNED"
      | "ADVANCE"
      | "MIXED"
      | "LEARNING";
  };
  passengers: {
    typical: number | null;
    maximum: number | null;
    multiPassengerPercentage: number;
  };
  luggageDataAvailable: boolean;
  commonRequirements: Array<{
    name: string;
    shortCode: string | null;
    bookings: number;
    percentage: number;
    category:
      | "ACCESSIBILITY"
      | "VEHICLE"
      | "TRAVEL"
      | "SERVICE"
      | "OTHER";
  }>;
  paymentPreference: {
    value: string | null;
    percentage: number;
  };
  bookingChannelPreference: {
    value: string | null;
    percentage: number;
  };
  explanation: string[];
};

function percentage(value: number, total: number) {
  return total > 0
    ? Number(((value / total) * 100).toFixed(1))
    : 0;
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort(
    (first, second) => first - second,
  );
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function mode(
  values: Array<string | null | undefined>,
) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const cleaned = value?.trim();

    if (!cleaned) {
      continue;
    }

    counts.set(
      cleaned,
      (counts.get(cleaned) ?? 0) + 1,
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
      }
    : null;
}

function isCustomerRequirement(name: string) {
  const normalized = name.toUpperCase();

  return ![
    "LYNKPAY",
    "KICKBACK",
    "CUSTOMER CALLED BACK",
    "APP PRIORITY",
    "MARKS AND SPENCERS",
    "SPLIT VEHICLE BOOKINGS",
  ].some((value) =>
    normalized.includes(value),
  );
}

function capabilityCategory(name: string) {
  const normalized = name.toUpperCase();

  if (
    normalized.includes("ACCESS") ||
    normalized.includes("WHEELCHAIR") ||
    normalized.includes("DISABLED")
  ) {
    return "ACCESSIBILITY" as const;
  }

  if (
    normalized.includes("SEATER") ||
    normalized.includes("ESTATE") ||
    normalized.includes("SALOON") ||
    normalized.includes("VEHICLE")
  ) {
    return "VEHICLE" as const;
  }

  if (
    normalized.includes("OUT OF TOWN") ||
    normalized.includes("AIRPORT")
  ) {
    return "TRAVEL" as const;
  }

  if (
    normalized.includes("ANIMAL") ||
    normalized.includes("PRIORITY")
  ) {
    return "SERVICE" as const;
  }

  return "OTHER" as const;
}

function capabilityItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("Name" in item)
    ) {
      return [];
    }

    const name = String(
      (item as { Name?: unknown }).Name ?? "",
    ).trim();

    if (
      !name ||
      !isCustomerRequirement(name)
    ) {
      return [];
    }

    const shortCodeValue =
      (item as { ShortCode?: unknown }).ShortCode;

    return [{
      name,
      shortCode:
        shortCodeValue === null ||
        shortCodeValue === undefined
          ? null
          : String(shortCodeValue),
    }];
  });
}

function leadTimeLabel(minutes: number | null) {
  if (minutes === null) {
    return "Not enough data";
  }

  if (minutes < 60) {
    return `${Math.round(minutes)} minutes`;
  }

  if (minutes < 24 * 60) {
    return `${Number((minutes / 60).toFixed(1))} hours`;
  }

  return `${Number(
    (minutes / (24 * 60)).toFixed(1),
  )} days`;
}

export function buildCustomerOperationalPreferences(
  bookings: OperationalBooking[],
): CustomerOperationalPreferences {
  const total = bookings.length;

  const leadTimes = bookings.flatMap((booking) => {
    if (
      !booking.bookedAtTime ||
      !booking.pickupDueTime
    ) {
      return [];
    }

    const minutes =
      (
        booking.pickupDueTime.getTime() -
        booking.bookedAtTime.getTime()
      ) / 60_000;

    return minutes >= 0 && minutes <= 43_200
      ? [minutes]
      : [];
  });

  const immediateBookings = leadTimes.filter(
    (minutes) => minutes <= 30,
  ).length;
  const plannedBookings = leadTimes.filter(
    (minutes) => minutes > 30 && minutes <= 120,
  ).length;
  const advanceBookings = leadTimes.filter(
    (minutes) => minutes > 120,
  ).length;

  const leadTotal = leadTimes.length;
  const bookingStyleCounts = [
    ["IMMEDIATE", immediateBookings],
    ["PLANNED", plannedBookings],
    ["ADVANCE", advanceBookings],
  ] as const;

  const sortedStyles = [...bookingStyleCounts].sort(
    (first, second) => second[1] - first[1],
  );

  const preferredBookingStyle =
    leadTotal < 3
      ? "LEARNING"
      : sortedStyles[0][1] === sortedStyles[1][1] ||
          percentage(sortedStyles[0][1], leadTotal) < 45
        ? "MIXED"
        : sortedStyles[0][0];

  const passengerValues = bookings
    .map((booking) => Number(booking.passengers))
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value > 0 &&
        value <= 20,
    );

  const typicalPassengers = median(passengerValues);
  const maximumPassengers =
    passengerValues.length > 0
      ? Math.max(...passengerValues)
      : null;

  const multiPassenger = passengerValues.filter(
    (value) => value > 1,
  ).length;

  const luggageValues = bookings
    .map((booking) => Number(booking.luggage))
    .filter(
      (value) =>
        Number.isFinite(value) && value > 0,
    );

  const requirementCounts = new Map<
    string,
    {
      name: string;
      shortCode: string | null;
      bookings: number;
    }
  >();

  for (const booking of bookings) {
    const unique = new Map(
      capabilityItems(booking.capabilities).map(
        (item) => [
          item.name.toUpperCase(),
          item,
        ],
      ),
    );

    unique.forEach((item, key) => {
      const existing = requirementCounts.get(key);

      requirementCounts.set(key, {
        ...item,
        bookings:
          (existing?.bookings ?? 0) + 1,
      });
    });
  }

  const commonRequirements = Array.from(
    requirementCounts.values(),
  )
    .filter(
      (requirement) =>
        requirement.bookings >= 2 ||
        percentage(requirement.bookings, total) >= 10,
    )
    .sort(
      (first, second) =>
        second.bookings - first.bookings,
    )
    .slice(0, 8)
    .map((requirement) => ({
      ...requirement,
      percentage: percentage(
        requirement.bookings,
        total,
      ),
      category: capabilityCategory(
        requirement.name,
      ),
    }));

  const payment = mode(
    bookings.map(
      (booking) => booking.paymentType,
    ),
  );
  const channel = mode(
    bookings.map(
      (booking) => booking.bookingSource,
    ),
  );

  const medianLeadTime = median(leadTimes);
  const explanation: string[] = [];

  if (medianLeadTime !== null) {
    explanation.push(
      `Typical booking lead time is ${leadTimeLabel(medianLeadTime)}.`,
    );
  }

  if (preferredBookingStyle !== "LEARNING") {
    explanation.push(
      preferredBookingStyle === "MIXED"
        ? "The customer uses a mixture of immediate and scheduled bookings."
        : `The strongest booking style is ${preferredBookingStyle.toLowerCase()}.`,
    );
  }

  if (commonRequirements.length > 0) {
    explanation.push(
      `Repeated requirements: ${commonRequirements
        .slice(0, 3)
        .map((item) => item.name)
        .join(", ")}.`,
    );
  }

  if (luggageValues.length === 0) {
    explanation.push(
      "Luggage information is not reliably recorded and is not inferred.",
    );
  }

  return {
    status:
      total >= 3 && leadTotal >= 3
        ? "READY"
        : "LEARNING",
    analysedBookings: total,
    leadTime: {
      medianMinutes:
        medianLeadTime === null
          ? null
          : Number(medianLeadTime.toFixed(1)),
      medianLabel:
        leadTimeLabel(medianLeadTime),
      immediateBookings,
      plannedBookings,
      advanceBookings,
      immediatePercentage: percentage(
        immediateBookings,
        leadTotal,
      ),
      plannedPercentage: percentage(
        plannedBookings,
        leadTotal,
      ),
      advancePercentage: percentage(
        advanceBookings,
        leadTotal,
      ),
      preferredBookingStyle,
    },
    passengers: {
      typical:
        typicalPassengers === null
          ? null
          : Number(typicalPassengers.toFixed(1)),
      maximum: maximumPassengers,
      multiPassengerPercentage: percentage(
        multiPassenger,
        passengerValues.length,
      ),
    },
    luggageDataAvailable:
      luggageValues.length > 0,
    commonRequirements,
    paymentPreference: {
      value: payment?.value ?? null,
      percentage: percentage(
        payment?.count ?? 0,
        total,
      ),
    },
    bookingChannelPreference: {
      value: channel?.value ?? null,
      percentage: percentage(
        channel?.count ?? 0,
        total,
      ),
    },
    explanation,
  };
}
