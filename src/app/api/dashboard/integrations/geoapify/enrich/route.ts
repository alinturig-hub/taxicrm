import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { enrichBookingLocation } from "@/lib/places/geoapify-place-enrichment";
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
    waitingDestinations,
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
        type: "DESTINATION",
        latitude: {
          not: null,
        },
        longitude: {
          not: null,
        },
        placeIntelligenceId: null,
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
      waitingDestinations,
    },
  });
}

export async function POST(request: Request) {
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

  if (
    !(await canManageIntegration(
      session.user.email,
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
    };

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
          type: "DESTINATION",
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
        orderBy: [
          {
            booking: {
              pickupDueTime: "desc",
            },
          },
          {
            updatedAt: "desc",
          },
        ],
        take: limit,
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

    for (const location of locations) {
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
      success: true,
      requested: limit,
      selected: locations.length,
      completed,
      failed,
      results,
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
