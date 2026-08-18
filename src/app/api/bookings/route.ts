import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPERATIONAL_TIME_ZONE = "Europe/London";

function getLondonDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

function getTimeZoneOffset(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  const representedAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );

  return representedAsUtc - date.getTime();
}

function londonMidnightUtc(
  year: number,
  month: number,
  day: number,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day));
  const offset = getTimeZoneOffset(utcGuess);

  return new Date(utcGuess.getTime() - offset);
}

function getCurrentLondonDayRange() {
  const now = new Date();
  const current = getLondonDateParts(now);

  const nextCalendarDay = new Date(
    Date.UTC(current.year, current.month - 1, current.day + 1),
  );

  return {
    start: londonMidnightUtc(
      current.year,
      current.month,
      current.day,
    ),
    end: londonMidnightUtc(
      nextCalendarDay.getUTCFullYear(),
      nextCalendarDay.getUTCMonth() + 1,
      nextCalendarDay.getUTCDate(),
    ),
  };
}

export async function GET() {
  try {
    const { start, end } = getCurrentLondonDayRange();

    const bookings = await prisma.booking.findMany({
      where: {
        pickupDueTime: {
          gte: start,
          lt: end,
        },
      },
      orderBy: [
        {
          pickupDueTime: {
            sort: "desc",
            nulls: "last",
          },
        },
        {
          updatedAt: "desc",
        },
      ],
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

          dispatchedAt: booking.dispatchedAt,
          acceptedAt: booking.acceptedAt,
          arrivedAt: booking.arrivedAt,
          pickedUpAt: booking.pickedUpAt,
          completedAt: booking.completedAt,
          cancelledAt: booking.cancelledAt,
          noFareAt: booking.noFareAt,

          driverId: booking.driverId,
          driverCallSign: booking.driverCallSign,
          driverForename: booking.driverForename,
          driverSurname: booking.driverSurname,
          driverBadgeNumber: booking.driverBadgeNumber,

          vehicleId: booking.vehicleId,
          vehicleCallSign: booking.vehicleCallSign,
          vehicleRegistration: booking.vehicleRegistration,
          vehiclePlateNumber: booking.vehiclePlateNumber,

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
