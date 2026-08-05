import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: {
      id: string;
    };
  },
) {
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

  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: params.id,
      },
      select: {
        id: true,
        externalId: true,
        status: true,

        customerName: true,

        driverCallSign: true,
        driverForename: true,
        driverSurname: true,

        fare: true,
        price: true,

        locations: {
          orderBy: {
            type: "asc",
          },
          select: {
            type: true,
            address: true,
          },
        },

        timelineEvents: {
          orderBy: {
            occurredAt: "asc",
          },
          select: {
            id: true,
            occurredAt: true,
            eventType: true,
            title: true,
            description: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: "BOOKING_NOT_FOUND",
        },
        {
          status: 404,
        },
      );
    }

    const pickup =
      booking.locations.find(
        (l) => l.type === "PICKUP",
      )?.address ?? null;

    const destination =
      booking.locations.find(
        (l) => l.type === "DESTINATION",
      )?.address ?? null;

    const driverName =
      [
        booking.driverForename,
        booking.driverSurname,
      ]
        .filter(Boolean)
        .join(" ") ||
      booking.driverCallSign ||
      null;

    return NextResponse.json({
      success: true,

      booking: {
        id: booking.id,
        externalId: booking.externalId,
        status: booking.status,

        customerName: booking.customerName,

        driverCallSign: booking.driverCallSign,
        driverName,

        fare:
          booking.fare === null
            ? null
            : Number(booking.fare),

        price:
          booking.price === null
            ? null
            : Number(booking.price),

        pickupAddress: pickup,
        destinationAddress: destination,

        timeline: booking.timelineEvents.map(
          (event) => ({
            id: event.id,
            occurredAt:
              event.occurredAt.toISOString(),
            eventType: event.eventType,
            title: event.title,
            description: event.description,
          }),
        ),
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "BOOKING_TIMELINE_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}
