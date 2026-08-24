type QualityLocation = {
  type: "PICKUP" | "DESTINATION";
  zoneName?: string | null;
  placeIntelligence?: {
    status: string;
    isSensitive: boolean;
  } | null;
};

export type QualityBooking = {
  status?: string | null;
  bookedAtTime?: Date | string | null;
  pickupDueTime?: Date | string | null;
  price?: unknown;
  locations: QualityLocation[];
};

export type CustomerProfileDataQuality = {
  score: number;
  grade:
    | "EXCELLENT"
    | "GOOD"
    | "FAIR"
    | "LIMITED";
  totalBookings: number;
  readyForBehaviourAnalysis: boolean;
  readyForPrediction: boolean;
  readyForPlaceInsights: boolean;
  coverage: {
    time: number;
    status: number;
    price: number;
    zones: number;
    weather: number;
    enrichedPlaces: number;
  };
  components: {
    historyDepth: number;
    time: number;
    status: number;
    price: number;
    zones: number;
    weather: number;
    enrichedPlaces: number;
  };
  protectedJourneys: number;
  strengths: string[];
  limitations: string[];
  explanation: string[];
};

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

function weighted(
  coverage: number,
  maximum: number,
) {
  return Number(
    (
      coverage /
      100 *
      maximum
    ).toFixed(1),
  );
}

function grade(
  score: number,
): CustomerProfileDataQuality["grade"] {
  if (score >= 90) {
    return "EXCELLENT";
  }

  if (score >= 75) {
    return "GOOD";
  }

  if (score >= 55) {
    return "FAIR";
  }

  return "LIMITED";
}

export function buildCustomerProfileDataQuality(
  bookings: QualityBooking[],
  {
    weatherMatchedBookings,
  }: {
    weatherMatchedBookings: number;
  },
): CustomerProfileDataQuality {
  const totalBookings = bookings.length;

  let withTime = 0;
  let withStatus = 0;
  let withPrice = 0;
  let withBothZones = 0;
  let withBothPlaces = 0;
  let protectedJourneys = 0;

  for (const booking of bookings) {
    if (
      booking.pickupDueTime ??
      booking.bookedAtTime
    ) {
      withTime += 1;
    }

    if (booking.status) {
      withStatus += 1;
    }

    if (
      booking.price !== null &&
      booking.price !== undefined
    ) {
      withPrice += 1;
    }

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

    if (
      pickup?.zoneName?.trim() &&
      destination?.zoneName?.trim()
    ) {
      withBothZones += 1;
    }

    if (
      pickup?.placeIntelligence
        ?.status === "READY" &&
      destination?.placeIntelligence
        ?.status === "READY"
    ) {
      withBothPlaces += 1;
    }

    if (
      pickup?.placeIntelligence
        ?.isSensitive ||
      destination?.placeIntelligence
        ?.isSensitive
    ) {
      protectedJourneys += 1;
    }
  }

  const coverage = {
    time: percentage(
      withTime,
      totalBookings,
    ),
    status: percentage(
      withStatus,
      totalBookings,
    ),
    price: percentage(
      withPrice,
      totalBookings,
    ),
    zones: percentage(
      withBothZones,
      totalBookings,
    ),
    weather: percentage(
      Math.min(
        weatherMatchedBookings,
        totalBookings,
      ),
      totalBookings,
    ),
    enrichedPlaces: percentage(
      withBothPlaces,
      totalBookings,
    ),
  };

  const components = {
    historyDepth: Number(
      Math.min(
        30,
        totalBookings * 3,
      ).toFixed(1),
    ),
    time: weighted(
      coverage.time,
      15,
    ),
    status: weighted(
      coverage.status,
      10,
    ),
    price: weighted(
      coverage.price,
      10,
    ),
    zones: weighted(
      coverage.zones,
      20,
    ),
    weather: weighted(
      coverage.weather,
      10,
    ),
    enrichedPlaces: weighted(
      coverage.enrichedPlaces,
      5,
    ),
  };

  const score = Math.round(
    Object.values(components).reduce(
      (total, value) =>
        total + value,
      0,
    ),
  );

  const strengths: string[] = [];
  const limitations: string[] = [];

  if (totalBookings >= 10) {
    strengths.push(
      "Sufficient booking history for stable behavioural analysis",
    );
  }

  if (coverage.time >= 95) {
    strengths.push(
      "Excellent booking time coverage",
    );
  }

  if (coverage.zones >= 95) {
    strengths.push(
      "Excellent pickup and destination zone coverage",
    );
  }

  if (coverage.weather >= 95) {
    strengths.push(
      "Excellent historical weather coverage",
    );
  }

  if (totalBookings < 5) {
    limitations.push(
      "Fewer than five bookings are available",
    );
  }

  if (coverage.zones < 80) {
    limitations.push(
      "Pickup or destination zones are incomplete",
    );
  }

  if (coverage.weather < 80) {
    limitations.push(
      "Historical weather coverage is incomplete",
    );
  }

  if (coverage.enrichedPlaces < 20) {
    limitations.push(
      "Verified real-world place coverage is still developing",
    );
  }

  return {
    score,
    grade: grade(score),
    totalBookings,
    readyForBehaviourAnalysis:
      totalBookings >= 5 &&
      coverage.time >= 80 &&
      coverage.zones >= 80,
    readyForPrediction:
      totalBookings >= 5 &&
      coverage.time >= 90,
    readyForPlaceInsights:
      totalBookings >= 5 &&
      coverage.enrichedPlaces >= 50,
    coverage,
    components,
    protectedJourneys,
    strengths,
    limitations,
    explanation: [
      "The quality score measures evidence completeness, not customer quality.",
      "Booking history contributes 30 points; time 15; zones 20; status 10; price 10; weather 10; verified places 5.",
      "Low Geoapify coverage cannot outweigh strong time, zone and booking evidence.",
      "Protected locations are counted only for data protection and are never exposed as behavioural detail.",
    ],
  };
}
