import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: {
        pickupDueTime: "desc",
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
      take: 250,
    });

    return NextResponse.json({
      success: true,
      total: bookings.length,
      bookings: bookings.map((booking) => {
        const pickup = booking.locations.find(
          (l) => l.type === "PICKUP",
        );

        const destination = booking.locations.find(
          (l) => l.type === "DESTINATION",
        );

        return {
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

          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,

          timeline: booking.timelineEvents,
        };
      }),
    });
  } catch (error) {
    console.error("Bookings API failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "BOOKINGS_RETRIEVAL_FAILED",
        message: "Bookings could not be retrieved.",
      },
      {
        status: 500,
      },
    );
  }
}
