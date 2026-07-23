import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

const COMPLETED_STATUSES = new Set([
  "completed",
  "complete",
  "done",
]);

const CANCELLED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "rejected",
  "no-show",
  "no_show",
  "noshow",
]);

function normalizeStatus(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, "-");
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function calculateCustomerScore(
  totalBookings: number,
  cancelledBookings: number,
  totalValue: number,
) {
  const cancellationRate =
    totalBookings > 0
      ? cancelledBookings / totalBookings
      : 0;

  if (
    totalBookings >= 5 &&
    cancellationRate >= 0.4
  ) {
    return {
      level: "HIGH_CANCELLATION_RISK",
      label: "High Cancellation Risk",
      color: "red",
      reason: `${Math.round(
        cancellationRate * 100,
      )}% cancellations`,
    };
  }

  if (
    totalBookings >= 25 ||
    totalValue >= 2000
  ) {
    return {
      level: "VIP",
      label: "VIP Customer",
      color: "purple",
      reason: `${totalBookings} bookings • £${totalValue.toFixed(
        0,
      )} lifetime value`,
    };
  }

  if (totalBookings >= 5) {
    return {
      level: "REGULAR",
      label: "Regular Customer",
      color: "blue",
      reason: `${totalBookings} bookings`,
    };
  }

  return {
    level: "NEW",
    label: "New Customer",
    color: "green",
    reason:
      totalBookings === 1
        ? "First booking"
        : `${totalBookings} bookings`,
  };
}

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

    const customerWhere = booking.telephoneNumber
      ? {
          telephoneNumber: booking.telephoneNumber,
        }
      : booking.customerEmail
        ? {
            customerEmail: {
              equals: booking.customerEmail,
              mode: "insensitive" as const,
            },
          }
        : {
            id: booking.id,
          };

    const customerBookings = await prisma.booking.findMany({
      where: customerWhere,
      orderBy: [
        {
          bookedAtTime: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      select: {
        id: true,
        externalId: true,
        status: true,
        bookedAtTime: true,
        pickupDueTime: true,
        price: true,
        fare: true,
        paymentType: true,
        bookingSource: true,
        locations: {
          select: {
            type: true,
            address: true,
          },
        },
      },
    });

    const completedBookings = customerBookings.filter((item) =>
      COMPLETED_STATUSES.has(normalizeStatus(item.status)),
    );

    const cancelledBookings = customerBookings.filter((item) =>
      CANCELLED_STATUSES.has(normalizeStatus(item.status)),
    );

    const totalValue = completedBookings.reduce((sum, item) => {
      const value = toNumber(item.price) ?? toNumber(item.fare) ?? 0;

      return sum + value;
    }, 0);

    const averageBookingValue =
      completedBookings.length > 0
        ? totalValue / completedBookings.length
        : 0;

    const customerScore = calculateCustomerScore(
      customerBookings.length,
      cancelledBookings.length,
      totalValue,
    );

    const recentBookings = customerBookings.slice(0, 5).map((item) => {
      const pickup = item.locations.find(
        (location) => location.type === "PICKUP",
      );

      const destination = item.locations.find(
        (location) => location.type === "DESTINATION",
      );

      return {
        id: item.id,
        externalId: item.externalId,
        status: item.status,
        bookedAtTime: item.bookedAtTime,
        pickupDueTime: item.pickupDueTime,
        pickupAddress: pickup?.address ?? null,
        destinationAddress: destination?.address ?? null,
        price: toNumber(item.price),
        fare: toNumber(item.fare),
        paymentType: item.paymentType,
        bookingSource: item.bookingSource,
      };
    });

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

        customer: {
          name: booking.customerName,
          telephoneNumber: booking.telephoneNumber,
          email: booking.customerEmail,
          totalBookings: customerBookings.length,
          completedBookings: completedBookings.length,
          cancelledBookings: cancelledBookings.length,
          totalValue,
          averageBookingValue,
          lastBookingAt:
            customerBookings[0]?.bookedAtTime ??
            customerBookings[0]?.pickupDueTime ??
            null,
          score: customerScore,
          recentBookings,
        },

        pickupDueTime: booking.pickupDueTime,
        dropOffDueTime: booking.dropOffDueTime,
        bookedAtTime: booking.bookedAtTime,

        pickup: pickup
          ? {
              address: pickup.address,
              latitude: toNumber(pickup.latitude),
              longitude: toNumber(pickup.longitude),
              zoneId: pickup.zoneId,
              zoneName: pickup.zoneName,
            }
          : null,

        destination: destination
          ? {
              address: destination.address,
              latitude: toNumber(destination.latitude),
              longitude: toNumber(destination.longitude),
              zoneId: destination.zoneId,
              zoneName: destination.zoneName,
            }
          : null,

        vias: booking.vias.map((via) => ({
          id: via.id,
          position: via.position,
          address: via.address,
          latitude: toNumber(via.latitude),
          longitude: toNumber(via.longitude),
          zoneId: via.zoneId,
          zoneName: via.zoneName,
        })),

        fare: toNumber(booking.fare),
        cost: toNumber(booking.cost),
        price: toNumber(booking.price),

        paymentType: booking.paymentType,
        accountName: booking.accountName,
        companyName: booking.companyName,

        passengers: booking.passengers,
        luggage: booking.luggage,

        distance: toNumber(booking.distance),
        estimatedDistance: toNumber(booking.estimatedDistance),
        estimatedPrice: toNumber(booking.estimatedPrice),

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
