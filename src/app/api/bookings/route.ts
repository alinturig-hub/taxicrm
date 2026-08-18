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

function parseLondonDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const testDate = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    testDate.getUTCFullYear() !== year ||
    testDate.getUTCMonth() + 1 !== month ||
    testDate.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

function getRequestedLondonDayRange(
  fromValue: string | null,
  toValue: string | null,
) {
  if (!fromValue && !toValue) {
    return getCurrentLondonDayRange();
  }

  const from = parseLondonDate(
    fromValue ?? toValue ?? "",
  );

  const to = parseLondonDate(
    toValue ?? fromValue ?? "",
  );

  if (!from || !to) {
    throw new Error(
      "Invalid booking date range. Expected YYYY-MM-DD.",
    );
  }

  const start = londonMidnightUtc(
    from.year,
    from.month,
    from.day,
  );

  const nextDay = new Date(
    Date.UTC(
      to.year,
      to.month - 1,
      to.day + 1,
    ),
  );

  const end = londonMidnightUtc(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
  );

  if (start >= end) {
    throw new Error(
      "From date must be before or equal to To date.",
    );
  }

  return {
    start,
    end,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const { start, end } =
      getRequestedLondonDayRange(
        url.searchParams.get("from"),
        url.searchParams.get("to"),
      );

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
