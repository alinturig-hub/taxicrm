import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  enrichBookingLocation,
  getGeoapifyDailyUsage,
} from "@/lib/places/geoapify-place-enrichment";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function canManageIntegration(
  email: string | null | undefined,
) {
  if (!email) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      role: true,
      isActive: true,
    },
  });

  return Boolean(
    user?.isActive &&
      (
        user.role === "ADMIN" ||
        user.role === "MANAGER"
      ),
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  const [
    cachedPlaces,
    readyPlaces,
    sensitivePlaces,
    enrichedLocations,
    waitingLocations,
    recentPlaces,
  ] = await Promise.all([
    prisma.placeIntelligence.count(),
    prisma.placeIntelligence.count({
      where: {
        status: "READY",
      },
    }),
    prisma.placeIntelligence.count({
      where: {
        isSensitive: true,
      },
    }),
    prisma.bookingLocation.count({
      where: {
        placeIntelligenceId: {
          not: null,
        },
      },
    }),
    prisma.bookingLocation.count({
      where: {
          latitude: {
          not: null,
        },
        longitude: {
          not: null,
        },
        placeIntelligenceId: null,
      },
    }),
    prisma.placeIntelligence.findMany({
      where: {
        status: {
          in: [
            "READY",
            "NOT_FOUND",
          ],
        },
      },
      orderBy: {
        enrichedAt: "desc",
      },
      take: 20,
      select: {
        id: true,
        placeName: true,
        formattedAddress: true,
        originalAddress: true,
        category: true,
        website: true,
        confidence: true,
        isSensitive: true,
        status: true,
        enrichedAt: true,
        _count: {
          select: {
            bookingLocations: true,
          },
        },
        bookingLocations: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 5,
          select: {
            type: true,
            booking: {
              select: {
                externalId: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    statistics: {
      cachedPlaces,
      readyPlaces,
      sensitivePlaces,
      enrichedLocations,
      waitingLocations,
    },
    recentPlaces: recentPlaces.map(
      (place) => ({
        id: place.id,
        name: place.isSensitive
          ? "Sensitive location"
          : place.placeName,
        formattedAddress:
          place.formattedAddress,
        originalAddress:
          place.originalAddress,
        category: place.isSensitive
          ? "Sensitive category"
          : place.category,
        website: place.isSensitive
          ? null
          : place.website,
        confidence:
          place.confidence === null
            ? null
            : Number(place.confidence),
        sensitive: place.isSensitive,
        status: place.status,
        enrichedAt: place.enrichedAt,
        linkedLocations:
          place._count.bookingLocations,
        bookings:
          place.bookingLocations.map(
            (location) => ({
              bookingId:
                location.booking.externalId,
              type: location.type,
            }),
          ),
      }),
    ),
  });
}

export async function POST(request: Request) {
  const suppliedCronSecret =
    request.headers.get("x-cron-secret");

  const cronAuthorized = Boolean(
    process.env.CRON_SECRET &&
      suppliedCronSecret ===
        process.env.CRON_SECRET,
  );

  const session = cronAuthorized
    ? null
    : await getServerSession(authOptions);

  if (!cronAuthorized && !session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  if (
    !cronAuthorized &&
    !(await canManageIntegration(
      session?.user?.email,
    ))
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const body = (await request.json().catch(
      () => ({}),
    )) as {
      limit?: unknown;
      bookingId?: unknown;
      scope?: unknown;
      dailyCreditCeiling?: unknown;
    };

    const bookingId =
      typeof body.bookingId === "string"
        ? body.bookingId.trim()
        : "";

    const historicalOnly =
      body.scope === "HISTORICAL";

    const dailyCreditCeiling =
      typeof body.dailyCreditCeiling ===
        "number" &&
      Number.isInteger(
        body.dailyCreditCeiling,
      )
        ? Math.min(
            Math.max(
              body.dailyCreditCeiling,
              1,
            ),
            3000,
          )
        : null;

    const requestedLimit =
      typeof body.limit === "number" &&
      Number.isInteger(body.limit)
        ? body.limit
        : 10;

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      100,
    );

    const locations =
      await prisma.bookingLocation.findMany({
        where: {
          booking: bookingId
            ? {
                externalId: bookingId,
              }
            : historicalOnly
              ? {
                  OR: [
                    {
                      pickupDueTime: {
                        lte: new Date(),
                      },
                    },
                    {
                      pickupDueTime: null,
                      bookedAtTime: {
                        lte: new Date(),
                      },
                    },
                  ],
                }
              : undefined,
          latitude: {
            not: null,
          },
          longitude: {
            not: null,
          },
          OR: [
            {
              placeIntelligenceId: null,
            },
            {
              placeIntelligence: {
                status: {
                  in: [
                    "PENDING",
                    "FAILED",
                  ],
                },
                OR: [
                  {
                    nextRetryAt: null,
                  },
                  {
                    nextRetryAt: {
                      lte: new Date(),
                    },
                  },
                ],
              },
            },
          ],
        },
        orderBy: historicalOnly
          ? [
              {
                booking: {
                  pickupDueTime: "asc",
                },
              },
              {
                updatedAt: "asc",
              },
            ]
          : [
              {
                booking: {
                  pickupDueTime: "desc",
                },
              },
              {
                updatedAt: "desc",
              },
            ],
        take: bookingId
          ? Math.min(limit, 10)
          : limit,
        select: {
          id: true,
          address: true,
          booking: {
            select: {
              externalId: true,
            },
          },
        },
      });

    const results: Array<{
      locationId: string;
      bookingId: string;
      address: string;
      status: string;
      placeName?: string | null;
      sensitive?: boolean;
      error?: string;
    }> = [];

    let stoppedAtDailyCreditCeiling =
      false;

    for (const location of locations) {
      if (
        dailyCreditCeiling !== null
      ) {
        const usage =
          await getGeoapifyDailyUsage();

        if (
          usage.dailyUsed >=
          dailyCreditCeiling
        ) {
          stoppedAtDailyCreditCeiling =
            true;
          break;
        }
      }

      try {
        const place =
          await enrichBookingLocation(
            location.id,
          );

        results.push({
          locationId: location.id,
          bookingId:
            location.booking.externalId,
          address: location.address,
          status: place.status,
          placeName: place.isSensitive
            ? null
            : place.placeName,
          sensitive: place.isSensitive,
        });
      } catch (error) {
        results.push({
          locationId: location.id,
          bookingId:
            location.booking.externalId,
          address: location.address,
          status: "FAILED",
          error:
            error instanceof Error
              ? error.message
              : "Place enrichment failed.",
        });

        if (
          error instanceof Error &&
          error.message.includes(
            "daily request limit",
          )
        ) {
          break;
        }
      }
    }

    const completed = results.filter(
      (result) =>
        result.status === "READY" ||
        result.status === "NOT_FOUND",
    ).length;

    const failed = results.filter(
      (result) =>
        result.status === "FAILED",
    ).length;

    return NextResponse.json({
      success: failed === 0,
      requested: limit,
      selected: locations.length,
      processed: results.length,
      scope:
        historicalOnly
          ? "HISTORICAL"
          : "ALL",
      dailyCreditCeiling,
      stoppedAtDailyCreditCeiling,
      completed,
      failed,
      hasMore:
        locations.length === limit &&
        !stoppedAtDailyCreditCeiling,
      containsPersonalData:
        !cronAuthorized,
      results: cronAuthorized
        ? undefined
        : results,
    });
  } catch (error) {
    console.error(
      "Geoapify enrichment batch failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "GEOAPIFY_ENRICHMENT_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Place enrichment could not be completed.",
      },
      {
        status: 500,
      },
    );
  }
}
