import {
  getServerSession,
} from "next-auth";
import {
  NextResponse,
} from "next/server";

import {
  Prisma,
} from "@/generated/prisma/client";
import {
  authOptions,
} from "@/lib/auth";
import {
  syncCustomerBehaviourTags,
} from "@/lib/customers/sync-customer-behaviour-tags";
import {
  prisma,
} from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const SENSITIVE_CATEGORY_PREFIXES = [
  "healthcare",
  "education",
  "childcare",
  "religion",
  "political",
  "service.financial",
  "office.financial",
];

async function authorizedUser() {
  const session =
    await getServerSession(
      authOptions,
    );

  if (
    !session?.user?.email
  ) {
    return {
      response:
        NextResponse.json(
          {
            success: false,
            error:
              "UNAUTHORIZED",
          },
          {
            status: 401,
          },
        ),
      email: null,
    };
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          session.user.email,
      },
      select: {
        email: true,
        role: true,
        isActive: true,
      },
    });

  if (
    !user?.isActive ||
    (
      user.role !== "ADMIN" &&
      user.role !== "MANAGER"
    )
  ) {
    return {
      response:
        NextResponse.json(
          {
            success: false,
            error:
              "FORBIDDEN",
          },
          {
            status: 403,
          },
        ),
      email: null,
    };
  }

  return {
    response: null,
    email: user.email,
  };
}

function positiveInteger(
  value: string | null,
  fallback: number,
) {
  const parsed =
    Number(value);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

function isSensitiveCategory(
  category: string,
) {
  return SENSITIVE_CATEGORY_PREFIXES.some(
    (prefix) =>
      category === prefix ||
      category.startsWith(
        `${prefix}.`,
      ),
  );
}

export async function GET(
  request: Request,
) {
  const authorization =
    await authorizedUser();

  if (authorization.response) {
    return authorization.response;
  }

  const url =
    new URL(request.url);
  const page =
    positiveInteger(
      url.searchParams.get("page"),
      1,
    );
  const pageSize =
    Math.min(
      positiveInteger(
        url.searchParams.get(
          "pageSize",
        ),
        PAGE_SIZE,
      ),
      MAX_PAGE_SIZE,
    );
  const search =
    url.searchParams
      .get("search")
      ?.trim() ??
    "";
  const requestedStatus =
    url.searchParams
      .get("status")
      ?.trim()
      .toUpperCase() ??
    "ALL";
  const includeSensitive =
    url.searchParams.get(
      "includeSensitive",
    ) === "true";

  const where:
    Prisma.PlaceIntelligenceWhereInput = {
      category: "amenity",
      ...(
        includeSensitive
          ? {}
          : {
              isSensitive:
                false,
            }
      ),
      ...(
        requestedStatus ===
          "ALL"
          ? {}
          : {
              poiCategoryStatus:
                requestedStatus,
            }
      ),
      ...(
        search
          ? {
              OR: [
                {
                  placeName: {
                    contains:
                      search,
                    mode:
                      "insensitive",
                  },
                },
                {
                  formattedAddress: {
                    contains:
                      search,
                    mode:
                      "insensitive",
                  },
                },
                {
                  originalAddress: {
                    contains:
                      search,
                    mode:
                      "insensitive",
                  },
                },
              ],
            }
          : {}
      ),
    };

  const [
    total,
    places,
    totalAmenities,
    nonSensitiveAmenities,
    sensitiveAmenities,
    pendingAmenities,
    noMatchAmenities,
  ] =
    await Promise.all([
      prisma.placeIntelligence.count({
        where,
      }),
      prisma.placeIntelligence.findMany({
        where,
        orderBy: [
          {
            bookingLocations: {
              _count:
                "desc",
            },
          },
          {
            placeName:
              "asc",
          },
        ],
        skip:
          (page - 1) *
          pageSize,
        take:
          pageSize,
        select: {
          id: true,
          placeName: true,
          formattedAddress: true,
          originalAddress: true,
          poiCategoryStatus: true,
          poiCategorySource: true,
          poiCategoryReviewedAt:
            true,
          poiCategoryReviewedBy:
            true,
          isSensitive: true,
          updatedAt: true,
          _count: {
            select: {
              bookingLocations:
                true,
            },
          },
        },
      }),
      prisma.placeIntelligence.count({
        where: {
          category:
            "amenity",
        },
      }),
      prisma.placeIntelligence.count({
        where: {
          category:
            "amenity",
          isSensitive:
            false,
        },
      }),
      prisma.placeIntelligence.count({
        where: {
          category:
            "amenity",
          isSensitive:
            true,
        },
      }),
      prisma.placeIntelligence.count({
        where: {
          category:
            "amenity",
          isSensitive:
            false,
          poiCategoryStatus:
            "PENDING",
        },
      }),
      prisma.placeIntelligence.count({
        where: {
          category:
            "amenity",
          isSensitive:
            false,
          poiCategoryStatus:
            "NO_MATCH",
        },
      }),
    ]);

  return NextResponse.json({
    success: true,
    statistics: {
      totalAmenities,
      nonSensitiveAmenities,
      sensitiveAmenities,
      pendingAmenities,
      noMatchAmenities,
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages:
        Math.max(
          1,
          Math.ceil(
            total /
              pageSize,
          ),
        ),
    },
    places:
      places.map(
        (place) => ({
          id:
            place.id,
          name:
            place.isSensitive
              ? "Sensitive location"
              : place.placeName,
          address:
            place.isSensitive
              ? null
              : (
                  place.formattedAddress ??
                  place.originalAddress
                ),
          status:
            place.poiCategoryStatus,
          source:
            place.poiCategorySource,
          reviewedAt:
            place.poiCategoryReviewedAt,
          reviewedBy:
            place.poiCategoryReviewedBy,
          sensitive:
            place.isSensitive,
          linkedLocations:
            place._count
              .bookingLocations,
          updatedAt:
            place.updatedAt,
          canEdit:
            !place.isSensitive,
        }),
      ),
  });
}

export async function PATCH(
  request: Request,
) {
  const authorization =
    await authorizedUser();

  if (authorization.response) {
    return authorization.response;
  }

  if (!authorization.email) {
    return NextResponse.json(
      {
        success: false,
        error:
          "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  const body =
    await request.json() as
      Record<string, unknown>;
  const id =
    typeof body.id === "string"
      ? body.id.trim()
      : "";
  const category =
    typeof body.category ===
      "string"
      ? body.category
          .trim()
          .toLowerCase()
      : "";
  const applyToMatchingPlace =
    body.applyToMatchingPlace ===
    true;
  const manuallySensitive =
    body.sensitive === true;

  if (
    !id ||
    !category ||
    category.length > 80 ||
    !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(
      category,
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "INVALID_PLACE_CATEGORY",
        message:
          "Choose a valid category.",
      },
      {
        status: 400,
      },
    );
  }

  const place =
    await prisma.placeIntelligence.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        category: true,
        placeName: true,
        formattedAddress:
          true,
        isSensitive:
          true,
      },
    });

  if (
    !place ||
    place.category !== "amenity"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "PLACE_NOT_AVAILABLE",
        message:
          "This amenity is no longer available for review.",
      },
      {
        status: 404,
      },
    );
  }

  if (place.isSensitive) {
    return NextResponse.json(
      {
        success: false,
        error:
          "SENSITIVE_PLACE",
        message:
          "Sensitive locations cannot be used for marketing classification.",
      },
      {
        status: 409,
      },
    );
  }

  const sensitive =
    manuallySensitive ||
    isSensitiveCategory(
      category,
    );
  const reviewedAt =
    new Date();

  const duplicateWhere:
    Prisma.PlaceIntelligenceWhereInput =
      applyToMatchingPlace &&
      place.placeName &&
      place.formattedAddress
        ? {
            category:
              "amenity",
            isSensitive:
              false,
            placeName:
              place.placeName,
            formattedAddress:
              place.formattedAddress,
          }
        : {
            id:
              place.id,
          };

  const result =
    await prisma.placeIntelligence.updateMany({
      where:
        duplicateWhere,
      data: {
        category,
        categories: [
          category,
        ],
        isSensitive:
          sensitive,
        sensitivityReason:
          sensitive
            ? `Manual review classified this location as sensitive (${category}).`
            : null,
        poiCategoryStatus:
          sensitive
            ? "SKIPPED_SENSITIVE"
            : "READY",
        poiCategorySource:
          "MANUAL",
        poiCategoryReviewedAt:
          reviewedAt,
        poiCategoryReviewedBy:
          authorization.email,
        poiCategoryEnrichedAt:
          reviewedAt,
        poiCategoryLastError:
          null,
        poiCategoryNextRetryAt:
          null,
      },
    });

  return NextResponse.json({
    success: true,
    updatedPlaces:
      result.count,
    category,
    sensitive,
  });
}

export async function POST() {
  const authorization =
    await authorizedUser();

  if (authorization.response) {
    return authorization.response;
  }

  const result =
    await syncCustomerBehaviourTags();

  return NextResponse.json({
    success: true,
    customerTags:
      result,
  });
}
