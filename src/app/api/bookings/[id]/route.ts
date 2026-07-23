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

function calculateCustomerSummary({
  totalBookings,
  completedBookings,
  cancelledBookings,
  totalValue,
  averageBookingValue,
  scoreLabel,
  paymentType,
  bookingSource,
  frequentRoute,
}: {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalValue: number;
  averageBookingValue: number;
  scoreLabel: string;
  paymentType: string | null;
  bookingSource: string | null;
  frequentRoute: string | null;
}) {
  const completionRate =
    totalBookings > 0
      ? Math.round((completedBookings / totalBookings) * 100)
      : 0;

  const cancellationRate =
    totalBookings > 0
      ? Math.round((cancelledBookings / totalBookings) * 100)
      : 0;

  const insights: string[] = [];

  if (totalBookings === 1) {
    insights.push("This is the customer’s first recorded booking.");
  } else {
    insights.push(
      `${totalBookings} bookings recorded with a ${completionRate}% completion rate.`,
    );
  }

  if (totalValue > 0) {
    insights.push(
      `Lifetime value is £${totalValue.toFixed(
        2,
      )}, with an average completed booking value of £${averageBookingValue.toFixed(
        2,
      )}.`,
    );
  }

  if (cancelledBookings === 0 && totalBookings > 1) {
    insights.push("No cancellations are recorded for this customer.");
  } else if (cancelledBookings > 0) {
    insights.push(
      `${cancelledBookings} cancellation${
        cancelledBookings === 1 ? "" : "s"
      } recorded, representing ${cancellationRate}% of bookings.`,
    );
  }

  if (paymentType) {
    insights.push(`Most frequently used payment method: ${paymentType}.`);
  }

  if (bookingSource) {
    insights.push(`Most bookings originate from ${bookingSource}.`);
  }

  if (frequentRoute) {
    insights.push(`Frequently booked route: ${frequentRoute}.`);
  }

  const headline =
    scoreLabel === "High Cancellation Risk"
      ? "Customer requires booking-risk attention"
      : scoreLabel === "VIP Customer"
        ? "High-value and established customer"
        : scoreLabel === "Regular Customer"
          ? "Established repeat customer"
          : "New customer relationship";

  const overview =
    totalBookings === 1
      ? "A new customer with limited booking history. More activity is required before reliable behavioural patterns can be established."
      : `${scoreLabel} with ${totalBookings} total bookings, ${completedBookings} completed journeys and ${cancelledBookings} cancellations.`;

  return {
    headline,
    overview,
    insights,
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
        distance: true,
        systemDistance: true,
        meterDistance: true,
        estimatedDistance: true,
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


    const paymentTypeCounts = new Map<string, number>();
    const bookingSourceCounts = new Map<string, number>();
    const routeCounts = new Map<string, number>();
    const pickupAddressCounts = new Map<string, number>();
    const destinationAddressCounts = new Map<string, number>();

    let totalDistanceTravelled = 0;
    let bookingsWithDistance = 0;

    for (const item of customerBookings) {
      if (item.paymentType) {
        paymentTypeCounts.set(
          item.paymentType,
          (paymentTypeCounts.get(item.paymentType) ?? 0) + 1,
        );
      }

      if (item.bookingSource) {
        bookingSourceCounts.set(
          item.bookingSource,
          (bookingSourceCounts.get(item.bookingSource) ?? 0) + 1,
        );
      }

      const routePickup = item.locations.find(
        (location) => location.type === "PICKUP",
      );

      const routeDestination = item.locations.find(
        (location) => location.type === "DESTINATION",
      );

      if (routePickup?.address) {
        pickupAddressCounts.set(
          routePickup.address,
          (pickupAddressCounts.get(routePickup.address) ?? 0) + 1,
        );
      }

      if (routeDestination?.address) {
        destinationAddressCounts.set(
          routeDestination.address,
          (destinationAddressCounts.get(routeDestination.address) ?? 0) + 1,
        );
      }

      if (routePickup?.address && routeDestination?.address) {
        const route =
          `${routePickup.address} → ${routeDestination.address}`;

        routeCounts.set(
          route,
          (routeCounts.get(route) ?? 0) + 1,
        );
      }

      const bookingDistance =
        toNumber(item.meterDistance) ??
        toNumber(item.systemDistance) ??
        toNumber(item.distance) ??
        toNumber(item.estimatedDistance);

      if (bookingDistance !== null && bookingDistance > 0) {
        totalDistanceTravelled += bookingDistance;
        bookingsWithDistance += 1;
      }
    }

    const getMostFrequentValue = (
      values: Map<string, number>,
    ): string | null => {
      let selectedValue: string | null = null;
      let selectedCount = 0;

      values.forEach((count, value) => {
        if (count > selectedCount) {
          selectedCount = count;
          selectedValue = value;
        }
      });

      return selectedValue;
    };

    const preferredPaymentMethod =
      getMostFrequentValue(paymentTypeCounts);

    const preferredBookingChannel =
      getMostFrequentValue(bookingSourceCounts);

    const customerSummary = calculateCustomerSummary({
      totalBookings: customerBookings.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
      totalValue,
      averageBookingValue,
      scoreLabel: customerScore.label,
      paymentType: preferredPaymentMethod,
      bookingSource: preferredBookingChannel,
      frequentRoute: getMostFrequentValue(routeCounts),
    });

    const customerIntelligence360 = {
      favoritePickupAddress:
        getMostFrequentValue(pickupAddressCounts),
      favoriteDestination:
        getMostFrequentValue(destinationAddressCounts),
      preferredPaymentMethod,
      preferredBookingChannel,
      totalDistanceTravelled: Number(
        totalDistanceTravelled.toFixed(1),
      ),
      averageBookingDistance:
        bookingsWithDistance > 0
          ? Number(
              (
                totalDistanceTravelled /
                bookingsWithDistance
              ).toFixed(1),
            )
          : 0,
      bookingsWithDistance,
    };

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
          summary: customerSummary,
          intelligence360: customerIntelligence360,
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
