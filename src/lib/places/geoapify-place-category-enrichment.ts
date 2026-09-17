import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getGeoapifyCredentials } from "@/lib/integrations/geoapify/configuration";
import {
  getSensitivePlaceReason,
  reserveGeoapifyDailyCredit,
} from "@/lib/places/geoapify-place-enrichment";

const PROVIDER = "GEOAPIFY";
const SEARCH_RADIUS_METRES = 50;
const FAILED_RETRY_DELAY_MS =
  6 * 60 * 60 * 1000;

const PLACE_CATEGORIES = [
  "commercial",
  "commercial.shopping_mall",
  "commercial.supermarket",
  "catering.pub",
  "catering.bar",
  "public_transport.train",
  "railway.train",
  "airport",
  "airport.terminal",
];

type PlacesFeature = {
  geometry?: {
    coordinates?: unknown[];
  };
  properties?: {
    name?: string;
    formatted?: string;
    categories?: string[];
    place_id?: string;
    website?: string;
    distance?: number;
  };
};

type PlacesPayload = {
  features?: PlacesFeature[];
  message?: string;
  error?: string;
};

type CategoryCandidate = {
  id: string;
  uses: number;
};

export type PlaceCategoryResult = {
  placeId: string;
  status:
    | "READY"
    | "NO_MATCH"
    | "SKIPPED_SENSITIVE"
    | "FAILED";
  category: string | null;
  categories: string[];
  distanceMetres: number | null;
};

export type PlaceCategoryBatchResult = {
  requested: number;
  processed: number;
  ready: number;
  noMatch: number;
  skippedSensitive: number;
  failed: number;
};

function toJsonValue(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
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

function categoryPriority(
  category: string,
) {
  if (
    category === "airport" ||
    category.startsWith("airport.")
  ) {
    return 500;
  }

  if (
    category === "public_transport.train" ||
    category.startsWith(
      "public_transport.train.",
    ) ||
    category === "railway.train" ||
    category.startsWith("railway.train.")
  ) {
    return 400;
  }

  if (
    category === "catering.pub" ||
    category.startsWith("catering.pub.") ||
    category === "catering.bar" ||
    category.startsWith("catering.bar.")
  ) {
    return 300;
  }

  if (
    category === "commercial.shopping_mall" ||
    category.startsWith(
      "commercial.shopping_mall.",
    ) ||
    category === "commercial.supermarket" ||
    category.startsWith(
      "commercial.supermarket.",
    )
  ) {
    return 200;
  }

  if (
    category === "commercial" ||
    category.startsWith("commercial.")
  ) {
    return 100;
  }

  return 0;
}

function usefulCategories(
  categories: unknown,
) {
  if (!Array.isArray(categories)) {
    return [];
  }

  return Array.from(
    new Set(
      categories.filter(
        (category): category is string =>
          typeof category === "string" &&
          categoryPriority(category) > 0,
      ),
    ),
  ).sort(
    (first, second) =>
      categoryPriority(second) -
      categoryPriority(first),
  );
}

function featureCoordinates(
  feature: PlacesFeature,
) {
  const coordinates =
    feature.geometry?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number" ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    return null;
  }

  return {
    longitude: coordinates[0],
    latitude: coordinates[1],
  };
}

function selectCandidate(
  payload: PlacesPayload,
  latitude: number,
  longitude: number,
) {
  return (payload.features ?? [])
    .map((feature) => {
      const coordinates =
        featureCoordinates(feature);
      const categories =
        usefulCategories(
          feature.properties?.categories,
        );

      if (
        !coordinates ||
        categories.length === 0
      ) {
        return null;
      }

      const distance =
        distanceMetres(
          latitude,
          longitude,
          coordinates.latitude,
          coordinates.longitude,
        );

      if (
        distance >
        SEARCH_RADIUS_METRES
      ) {
        return null;
      }

      return {
        feature,
        categories,
        distance,
        priority:
          categoryPriority(
            categories[0],
          ),
      };
    })
    .filter(
      (
        candidate,
      ): candidate is NonNullable<
        typeof candidate
      > => candidate !== null,
    )
    .sort(
      (first, second) =>
        first.distance -
          second.distance ||
        second.priority -
          first.priority,
    )[0] ?? null;
}

async function recordProviderSuccess(
  attemptedAt: Date,
) {
  await prisma.geoapifyApiConfiguration.update({
    where: {
      provider: PROVIDER,
    },
    data: {
      lastSuccessfulLookupAt:
        attemptedAt,
      lastError: null,
    },
  });
}

async function recordProviderFailure(
  message: string,
) {
  await prisma.geoapifyApiConfiguration.update({
    where: {
      provider: PROVIDER,
    },
    data: {
      lastError: message,
    },
  });
}

export async function enrichPlaceCategory(
  placeId: string,
  options: {
    force?: boolean;
  } = {},
): Promise<PlaceCategoryResult> {
  const place =
    await prisma.placeIntelligence.findUnique({
      where: {
        id: placeId,
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        originalAddress: true,
        placeName: true,
        formattedAddress: true,
        isSensitive: true,
        poiCategoryStatus: true,
      },
    });

  if (!place) {
    throw new Error(
      "Place intelligence record was not found.",
    );
  }

  if (place.isSensitive) {
    await prisma.placeIntelligence.update({
      where: {
        id: place.id,
      },
      data: {
        poiCategoryStatus:
          "SKIPPED_SENSITIVE",
        poiCategoryLastError: null,
      },
    });

    return {
      placeId: place.id,
      status: "SKIPPED_SENSITIVE",
      category: null,
      categories: [],
      distanceMetres: null,
    };
  }

  if (
    !options.force &&
    (
      place.poiCategoryStatus === "READY" ||
      place.poiCategoryStatus ===
        "NO_MATCH"
    )
  ) {
    const existing =
      await prisma.placeIntelligence.findUniqueOrThrow({
        where: {
          id: place.id,
        },
        select: {
          category: true,
          categories: true,
          poiCategoryMatchDistanceMetres:
            true,
        },
      });

    return {
      placeId: place.id,
      status:
        place.poiCategoryStatus as
          | "READY"
          | "NO_MATCH",
      category:
        existing.category,
      categories:
        usefulCategories(
          existing.categories,
        ),
      distanceMetres:
        existing
          .poiCategoryMatchDistanceMetres
          ?.toNumber() ??
        null,
    };
  }

  const attemptedAt = new Date();
  const latitude =
    place.latitude.toNumber();
  const longitude =
    place.longitude.toNumber();

  try {
    const credentials =
      await getGeoapifyCredentials();

    await reserveGeoapifyDailyCredit();

    const url = new URL(
      "/v2/places",
      `${credentials.baseUrl}/`,
    );

    url.search =
      new URLSearchParams({
        categories:
          PLACE_CATEGORIES.join(","),
        filter:
          `circle:${longitude},${latitude},${SEARCH_RADIUS_METRES}`,
        bias:
          `proximity:${longitude},${latitude}`,
        limit: "20",
        apiKey:
          credentials.apiKey,
      }).toString();

    const response =
      await fetch(url, {
        cache: "no-store",
        signal:
          AbortSignal.timeout(15000),
      });

    const payload =
      (await response.json()) as
        PlacesPayload;

    if (!response.ok) {
      throw new Error(
        payload.message ??
          payload.error ??
          `Geoapify Places returned HTTP ${response.status}.`,
      );
    }

    const selected =
      selectCandidate(
        payload,
        latitude,
        longitude,
      );

    if (!selected) {
      await prisma.placeIntelligence.update({
        where: {
          id: place.id,
        },
        data: {
          poiCategoryStatus:
            "NO_MATCH",
          poiCategoryAttemptCount: {
            increment: 1,
          },
          poiCategoryLastAttemptAt:
            attemptedAt,
          poiCategoryNextRetryAt:
            null,
          poiCategoryEnrichedAt:
            attemptedAt,
          poiCategoryLastError:
            null,
          poiCategoryMatchDistanceMetres:
            null,
          poiCategoryProviderPlaceId:
            null,
          poiCategoryRawPayload:
            toJsonValue(payload),
        },
      });

      await recordProviderSuccess(
        attemptedAt,
      );

      return {
        placeId: place.id,
        status: "NO_MATCH",
        category: null,
        categories: [],
        distanceMetres: null,
      };
    }

    const properties =
      selected.feature.properties;
    const sensitivityReason =
      getSensitivePlaceReason(
        selected.categories,
        [
          place.originalAddress,
          place.placeName,
          place.formattedAddress,
          properties?.name,
          properties?.formatted,
        ],
      );

    if (sensitivityReason) {
      await prisma.placeIntelligence.update({
        where: {
          id: place.id,
        },
        data: {
          isSensitive: true,
          sensitivityReason,
          poiCategoryStatus:
            "SKIPPED_SENSITIVE",
          poiCategoryAttemptCount: {
            increment: 1,
          },
          poiCategoryLastAttemptAt:
            attemptedAt,
          poiCategoryNextRetryAt:
            null,
          poiCategoryEnrichedAt:
            attemptedAt,
          poiCategoryLastError:
            null,
          poiCategoryMatchDistanceMetres:
            selected.distance,
          poiCategoryProviderPlaceId:
            properties?.place_id ??
            null,
          poiCategoryRawPayload:
            toJsonValue(
              selected.feature,
            ),
        },
      });

      await recordProviderSuccess(
        attemptedAt,
      );

      return {
        placeId: place.id,
        status: "SKIPPED_SENSITIVE",
        category: null,
        categories: [],
        distanceMetres:
          Number(
            selected.distance.toFixed(2),
          ),
      };
    }

    await prisma.placeIntelligence.update({
      where: {
        id: place.id,
      },
      data: {
        placeName:
          properties?.name?.trim() ||
          place.placeName,
        formattedAddress:
          properties?.formatted?.trim() ||
          place.formattedAddress,
        category:
          selected.categories[0],
        categories:
          selected.categories,
        website:
          properties?.website ??
          undefined,
        poiCategoryStatus: "READY",
        poiCategoryAttemptCount: {
          increment: 1,
        },
        poiCategoryLastAttemptAt:
          attemptedAt,
        poiCategoryNextRetryAt:
          null,
        poiCategoryEnrichedAt:
          attemptedAt,
        poiCategoryLastError: null,
        poiCategoryMatchDistanceMetres:
          selected.distance,
        poiCategoryProviderPlaceId:
          properties?.place_id ??
          null,
        poiCategoryRawPayload:
          toJsonValue(
            selected.feature,
          ),
      },
    });

    await recordProviderSuccess(
      attemptedAt,
    );

    return {
      placeId: place.id,
      status: "READY",
      category:
        selected.categories[0],
      categories:
        selected.categories,
      distanceMetres:
        Number(
          selected.distance.toFixed(2),
        ),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Geoapify place category lookup failed.";

    await Promise.all([
      prisma.placeIntelligence.update({
        where: {
          id: place.id,
        },
        data: {
          poiCategoryStatus: "FAILED",
          poiCategoryAttemptCount: {
            increment: 1,
          },
          poiCategoryLastAttemptAt:
            attemptedAt,
          poiCategoryNextRetryAt:
            new Date(
              attemptedAt.getTime() +
                FAILED_RETRY_DELAY_MS,
            ),
          poiCategoryLastError:
            message,
        },
      }),
      recordProviderFailure(message),
    ]);

    throw error;
  }
}

async function loadCandidates(
  limit: number,
  minimumUses: number,
) {
  return prisma.$queryRaw<
    CategoryCandidate[]
  >(Prisma.sql`
    SELECT
      place.id,
      COUNT(location.id)::int AS uses
    FROM "PlaceIntelligence" place
    INNER JOIN "BookingLocation" location
      ON location."placeIntelligenceId" = place.id
    INNER JOIN "Booking" booking
      ON booking.id = location."bookingId"
    WHERE
      COALESCE(
        booking."pickupDueTime",
        booking."bookedAtTime"
      ) >= NOW() - INTERVAL '14 days'
      AND NOT place."isSensitive"
      AND (
        place."poiCategoryStatus" = 'PENDING'
        OR (
          place."poiCategoryStatus" = 'FAILED'
          AND (
            place."poiCategoryNextRetryAt" IS NULL
            OR place."poiCategoryNextRetryAt" <= NOW()
          )
        )
      )
    GROUP BY place.id
    HAVING COUNT(location.id) >= ${minimumUses}
    ORDER BY uses DESC, place.id ASC
    LIMIT ${limit}
  `);
}

export async function enrichFrequentPlaceCategories(
  options: {
    limit?: number;
    minimumUses?: number;
  } = {},
): Promise<PlaceCategoryBatchResult> {
  const limit =
    Math.min(
      Math.max(
        Math.trunc(
          options.limit ?? 250,
        ),
        1,
      ),
      1_000,
    );
  const minimumUses =
    Math.max(
      Math.trunc(
        options.minimumUses ?? 5,
      ),
      1,
    );

  const candidates =
    await loadCandidates(
      limit,
      minimumUses,
    );

  const result: PlaceCategoryBatchResult = {
    requested: candidates.length,
    processed: 0,
    ready: 0,
    noMatch: 0,
    skippedSensitive: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      const enriched =
        await enrichPlaceCategory(
          candidate.id,
        );

      result.processed += 1;

      if (enriched.status === "READY") {
        result.ready += 1;
      } else if (
        enriched.status === "NO_MATCH"
      ) {
        result.noMatch += 1;
      } else if (
        enriched.status ===
        "SKIPPED_SENSITIVE"
      ) {
        result.skippedSensitive += 1;
      }
    } catch {
      result.processed += 1;
      result.failed += 1;
    }
  }

  return result;
}
