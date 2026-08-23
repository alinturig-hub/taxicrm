import { prisma } from "@/lib/prisma";
import { getGeoapifyCredentials } from "@/lib/integrations/geoapify/configuration";

const PROVIDER = "GEOAPIFY";
const LOCATION_KEY_DECIMALS = 5;
const ADDRESS_FALLBACK_MAX_DISTANCE_METRES = 750;

type GeoapifyResult = {
  name?: string;
  formatted?: string;
  result_type?: string;
  lat?: number;
  lon?: number;
  categories?: string[];
  place_id?: string;
  website?: string;
  datasource?: {
    raw?: {
      website?: string;
      amenity?: string;
      healthcare?: string;
      tourism?: string;
      leisure?: string;
      shop?: string;
      office?: string;
    };
  };
  rank?: {
    confidence?: number;
  };
};

type GeoapifyPayload = {
  results?: GeoapifyResult[];
  message?: string;
  error?: string;
};

const sensitiveCategoryPrefixes = [
  "healthcare",
  "religion",
  "political",
  "adult",
  "service.social_facility",
];

const londonDateFormatter =
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

function londonDateKey(value: Date) {
  return londonDateFormatter.format(value);
}

function usageDate(value: Date) {
  const [year, month, day] =
    londonDateKey(value).split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, 12),
  );
}

export function placeLocationKey(
  latitude: number,
  longitude: number,
) {
  return [
    latitude.toFixed(LOCATION_KEY_DECIMALS),
    longitude.toFixed(LOCATION_KEY_DECIMALS),
  ].join(":");
}

const sensitivePlaceKeywords = [
  "renal",
  "dialysis",
  "hospital",
  "clinic",
  "medical centre",
  "medical center",
  "health centre",
  "health center",
  "healthcare",
  "surgery",
  "pharmacy",
  "hospice",
  "mental health",
  "sexual health",
  "fertility",
  "religious",
  "church",
  "mosque",
  "synagogue",
  "temple",
  "political",
];

function sensitiveReason(
  categories: string[],
  textValues: Array<
    string | null | undefined
  >,
) {
  const sensitiveCategory =
    categories.find((category) =>
      sensitiveCategoryPrefixes.some(
        (prefix) =>
          category === prefix ||
          category.startsWith(`${prefix}.`),
      ),
    );

  if (sensitiveCategory) {
    return `Sensitive place category: ${sensitiveCategory}`;
  }

  const combinedText = textValues
    .filter(
      (value): value is string =>
        typeof value === "string",
    )
    .join(" ")
    .toLowerCase();

  const keyword =
    sensitivePlaceKeywords.find(
      (candidate) =>
        combinedText.includes(candidate),
    );

  return keyword
    ? `Sensitive place indicator: ${keyword}`
    : null;
}

function normalisePlaceName(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function declaredPlaceName(
  address: string,
) {
  return normalisePlaceName(
    address.split(",")[0] ?? "",
  );
}

function candidateNameScore(
  address: string,
  candidate: GeoapifyResult,
) {
  const declared =
    declaredPlaceName(address);
  const candidateName =
    normalisePlaceName(
      candidate.name ?? "",
    );

  if (!declared || !candidateName) {
    return 0;
  }

  if (candidateName === declared) {
    return 1_000;
  }

  if (
    candidateName.startsWith(
      `${declared} `,
    )
  ) {
    return 500;
  }

  if (
    candidateName.includes(declared)
  ) {
    return 250;
  }

  return 0;
}

function distanceMetres(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
) {
  const earthRadius = 6_371_000;
  const radians = (value: number) =>
    (value * Math.PI) / 180;

  const latitudeDelta = radians(
    secondLatitude - firstLatitude,
  );
  const longitudeDelta = radians(
    secondLongitude - firstLongitude,
  );

  const firstLatitudeRadians =
    radians(firstLatitude);
  const secondLatitudeRadians =
    radians(secondLatitude);

  const calculation =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(calculation),
      Math.sqrt(1 - calculation),
    )
  );
}

function isGenericResult(
  result: GeoapifyResult,
) {
  if (result.name?.trim()) {
    return false;
  }

  const categories =
    result.categories ?? [];

  return (
    result.result_type === "building" ||
    result.result_type === "amenity" ||
    categories.length === 0 ||
    categories.every(
      (category) =>
        category === "building" ||
        category.startsWith("building."),
    )
  );
}

async function findNearbyAddressPlace({
  address,
  latitude,
  longitude,
  baseUrl,
  apiKey,
}: {
  address: string;
  latitude: number;
  longitude: number;
  baseUrl: string;
  apiKey: string;
}) {
  await reserveDailyCredit();

  const searchUrl = new URL(
    "/v1/geocode/search",
    `${baseUrl}/`,
  );

  searchUrl.search = new URLSearchParams({
    text: address,
    format: "json",
    limit: "5",
    filter:
      `circle:${longitude},${latitude},${ADDRESS_FALLBACK_MAX_DISTANCE_METRES}`,
    bias:
      `proximity:${longitude},${latitude}`,
    apiKey,
  }).toString();

  const response = await fetch(searchUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  const payload =
    (await response.json()) as GeoapifyPayload;

  if (!response.ok) {
    throw new Error(
      payload.message ??
        payload.error ??
        `Geoapify address search returned HTTP ${response.status}.`,
    );
  }

  const candidates = (
    payload.results ?? []
  )
    .filter(
      (
        candidate,
      ): candidate is GeoapifyResult & {
        lat: number;
        lon: number;
      } =>
        Boolean(candidate.name?.trim()) &&
        typeof candidate.lat === "number" &&
        Number.isFinite(candidate.lat) &&
        typeof candidate.lon === "number" &&
        Number.isFinite(candidate.lon),
    )
    .map((candidate) => {
      const distance = distanceMetres(
        latitude,
        longitude,
        candidate.lat,
        candidate.lon,
      );

      const confidence =
        typeof candidate.rank?.confidence ===
        "number"
          ? candidate.rank.confidence
          : 0;

      return {
        candidate,
        distance,
        selectionScore:
          candidateNameScore(
            address,
            candidate,
          ) +
          confidence * 100 -
          distance / 100,
      };
    })
    .filter(
      ({ distance }) =>
        distance <=
        ADDRESS_FALLBACK_MAX_DISTANCE_METRES,
    )
    .sort(
      (first, second) =>
        second.selectionScore -
          first.selectionScore ||
        first.distance -
          second.distance,
    );

  return {
    result:
      candidates[0]?.candidate ?? null,
    payload,
    distance:
      candidates[0]?.distance ?? null,
  };
}

async function reserveDailyCredit() {
  const now = new Date();

  const configuration =
    await prisma.geoapifyApiConfiguration.findUnique({
      where: {
        provider: PROVIDER,
      },
      select: {
        isEnabled: true,
        dailyLimit: true,
        dailyUsed: true,
        usageDate: true,
      },
    });

  if (!configuration?.isEnabled) {
    throw new Error(
      "Geoapify integration is not enabled.",
    );
  }

  if (
    !configuration.usageDate ||
    londonDateKey(configuration.usageDate) !==
      londonDateKey(now)
  ) {
    await prisma.geoapifyApiConfiguration.update({
      where: {
        provider: PROVIDER,
      },
      data: {
        dailyUsed: 0,
        usageDate: usageDate(now),
      },
    });
  }

  const reserved =
    await prisma.geoapifyApiConfiguration.updateMany({
      where: {
        provider: PROVIDER,
        isEnabled: true,
        dailyUsed: {
          lt: configuration.dailyLimit,
        },
      },
      data: {
        dailyUsed: {
          increment: 1,
        },
        usageDate: usageDate(now),
      },
    });

  if (reserved.count !== 1) {
    throw new Error(
      "Geoapify daily request limit has been reached.",
    );
  }
}

async function connectLocation(
  bookingLocationId: string,
  placeIntelligenceId: string,
) {
  await prisma.bookingLocation.update({
    where: {
      id: bookingLocationId,
    },
    data: {
      placeIntelligenceId,
    },
  });
}

export async function enrichBookingLocation(
  bookingLocationId: string,
) {
  const location =
    await prisma.bookingLocation.findUnique({
      where: {
        id: bookingLocationId,
      },
      select: {
        id: true,
        address: true,
        latitude: true,
        longitude: true,
        placeIntelligenceId: true,
        placeIntelligence: true,
      },
    });

  if (!location) {
    throw new Error(
      "Booking location was not found.",
    );
  }

  if (
    location.placeIntelligence?.status ===
    "READY"
  ) {
    return location.placeIntelligence;
  }

  if (
    location.latitude === null ||
    location.longitude === null
  ) {
    throw new Error(
      "Booking location has no coordinates.",
    );
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      "Booking location coordinates are invalid.",
    );
  }

  const locationKey = placeLocationKey(
    latitude,
    longitude,
  );

  const cached =
    await prisma.placeIntelligence.findUnique({
      where: {
        locationKey,
      },
    });

  if (cached?.status === "READY") {
    await connectLocation(
      location.id,
      cached.id,
    );

    return cached;
  }

  if (
    cached?.nextRetryAt &&
    cached.nextRetryAt > new Date()
  ) {
    throw new Error(
      "Place lookup is waiting before retry.",
    );
  }

  const place =
    await prisma.placeIntelligence.upsert({
      where: {
        locationKey,
      },
      create: {
        locationKey,
        latitude,
        longitude,
        originalAddress: location.address,
        status: "PENDING",
      },
      update: {
        originalAddress: location.address,
        status: "PENDING",
      },
    });

  await connectLocation(
    location.id,
    place.id,
  );

  const credentials =
    await getGeoapifyCredentials();

  await reserveDailyCredit();

  const url = new URL(
    "/v1/geocode/reverse",
    `${credentials.baseUrl}/`,
  );

  url.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "json",
    apiKey: credentials.apiKey,
  }).toString();

  const attemptedAt = new Date();

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const payload =
      (await response.json()) as GeoapifyPayload;

    if (!response.ok) {
      throw new Error(
        payload.message ??
          payload.error ??
          `Geoapify returned HTTP ${response.status}.`,
      );
    }

    let result = payload.results?.[0];
    let storedPayload: unknown = payload;

    if (
      result &&
      isGenericResult(result) &&
      location.address.trim()
    ) {
      try {
        const addressFallback =
          await findNearbyAddressPlace({
            address: location.address,
            latitude,
            longitude,
            baseUrl: credentials.baseUrl,
            apiKey: credentials.apiKey,
          });

        if (addressFallback.result) {
          result = addressFallback.result;
          storedPayload = {
            reverse: payload,
            addressSearch:
              addressFallback.payload,
            selectedBy:
              "NEARBY_ADDRESS_FALLBACK",
            selectedDistanceMetres:
              addressFallback.distance,
          };
        }
      } catch (fallbackError) {
        storedPayload = {
          reverse: payload,
          addressFallbackError:
            fallbackError instanceof Error
              ? fallbackError.message
              : "Address fallback failed.",
        };
      }
    }

    if (!result) {
      const notFound =
        await prisma.placeIntelligence.update({
          where: {
            id: place.id,
          },
          data: {
            status: "NOT_FOUND",
            attemptCount: {
              increment: 1,
            },
            lastAttemptAt: attemptedAt,
            enrichedAt: attemptedAt,
            lastError: null,
            rawPayload: payload,
          },
        });

      await prisma.geoapifyApiConfiguration.update({
        where: {
          provider: PROVIDER,
        },
        data: {
          lastSuccessfulLookupAt: attemptedAt,
          lastError: null,
        },
      });

      return notFound;
    }

    const categories =
      Array.isArray(result.categories)
        ? result.categories
        : [];

    const raw =
      result.datasource?.raw;

    const category =
      categories[0] ??
      raw?.amenity ??
      raw?.healthcare ??
      raw?.tourism ??
      raw?.leisure ??
      raw?.shop ??
      raw?.office ??
      result.result_type ??
      null;

    const sensitivityReason =
      sensitiveReason(
        categories,
        [
          result.name,
          result.formatted,
          category,
          raw?.amenity,
          raw?.healthcare,
        ],
      );

    const enriched =
      await prisma.placeIntelligence.update({
        where: {
          id: place.id,
        },
        data: {
          placeName:
            result.name?.trim() || null,
          formattedAddress:
            result.formatted?.trim() || null,
          category,
          categories,
          website:
            result.website ??
            result.datasource?.raw?.website ??
            null,
          providerPlaceId:
            result.place_id ?? null,
          confidence:
            typeof result.rank?.confidence ===
            "number"
              ? result.rank.confidence
              : null,
          isSensitive:
            sensitivityReason !== null,
          sensitivityReason,
          status: "READY",
          attemptCount: {
            increment: 1,
          },
          lastAttemptAt: attemptedAt,
          nextRetryAt: null,
          enrichedAt: attemptedAt,
          lastError: null,
          rawPayload:
          storedPayload as object,
        },
      });

    await prisma.geoapifyApiConfiguration.update({
      where: {
        provider: PROVIDER,
      },
      data: {
        lastSuccessfulLookupAt: attemptedAt,
        lastError: null,
      },
    });

    return enriched;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Geoapify place lookup failed.";

    const nextRetryAt = new Date(
      attemptedAt.getTime() + 6 * 60 * 60 * 1000,
    );

    await Promise.all([
      prisma.placeIntelligence.update({
        where: {
          id: place.id,
        },
        data: {
          status: "FAILED",
          attemptCount: {
            increment: 1,
          },
          lastAttemptAt: attemptedAt,
          nextRetryAt,
          lastError: message.slice(0, 5000),
        },
      }),
      prisma.geoapifyApiConfiguration.update({
        where: {
          provider: PROVIDER,
        },
        data: {
          lastError: message.slice(0, 5000),
        },
      }),
    ]);

    throw new Error(message);
  }
}
