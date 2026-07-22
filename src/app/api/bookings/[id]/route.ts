import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: params.id,
      },
      include: {
        locations: {
          orderBy: {
            type: "asc",
          },
        },
        vias: {
          orderBy: {
            position: "asc",
          },
        },
        timelineEvents: {
          orderBy: {
            occurredAt: "desc",
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: "BOOKING_NOT_FOUND",
          message: "Booking could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    const pickup = booking.locations.find(
      (location) => location.type === "PICKUP",
    );

    const destination = booking.locations.find(
      (location) => location.type === "DESTINATION",
    );

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        provider: booking.provider,
        externalId: booking.externalId,
        status: booking.status,

        customerName: booking.customerName,
        telephoneNumber: booking.telephoneNumber,
        customerEmail: booking.customerEmail,

        pickupDueTime: booking.pickupDueTime,
        dropOffDueTime: booking.dropOffDueTime,
        bookedAtTime: booking.bookedAtTime,

        pickup: pickup
          ? {
              address: pickup.address,
              latitude: pickup.latitude,
              longitude: pickup.longitude,
              zoneId: pickup.zoneId,
              zoneName: pickup.zoneName,
            }
          : null,

        destination: destination
          ? {
              address: destination.address,
              latitude: destination.latitude,
              longitude: destination.longitude,
              zoneId: destination.zoneId,
              zoneName: destination.zoneName,
            }
          : null,

        locations: booking.locations,
        vias: booking.vias,

        fare: booking.fare,
        cost: booking.cost,
        price: booking.price,

        paymentType: booking.paymentType,
        accountName: booking.accountName,
        companyName: booking.companyName,

        passengers: booking.passengers,
        luggage: booking.luggage,

        distance: booking.distance,
        estimatedDistance: booking.estimatedDistance,
        estimatedPrice: booking.estimatedPrice,

        driverNote: booking.driverNote,
        officeNote: booking.officeNote,

        ourReference: booking.ourReference,
        bookingSource: booking.bookingSource,

        timeline: booking.timelineEvents,

        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    });
  } catch (error) {
    console.error("Booking details API failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "BOOKING_RETRIEVAL_FAILED",
        message: "Booking details could not be retrieved.",
      },
      {
        status: 500,
      },
    );
  }
}
