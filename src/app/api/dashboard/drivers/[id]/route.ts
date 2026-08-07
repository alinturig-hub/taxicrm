import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addLondonDays,
  startOfLondonDay,
  startOfLondonWeek,
} from "@/lib/time/london-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function revenueValue(
  price: unknown,
  cost: unknown,
) {
  const p = Number(price ?? 0);
  const c = Number(cost ?? 0);

  return p > 0 ? p : c;
}

function hoursBetween(
  start: Date,
  end: Date,
) {
  return Math.max(
    0,
    (end.getTime() - start.getTime()) /
      (1000 * 60 * 60),
  );
}

async function calculateShiftHours(
  driverId: string,
  from: Date,
  to: Date,
  now: Date,
) {
  const shifts = await prisma.driverShift.findMany({
    where: {
      driverId,
      startedAt: {
        lt: to,
      },
      OR: [
        {
          endedAt: null,
        },
        {
          endedAt: {
            gt: from,
          },
        },
      ],
    },
    select: {
      startedAt: true,
      endedAt: true,
    },
  });

  return shifts.reduce((total, shift) => {
    const start =
      shift.startedAt > from
        ? shift.startedAt
        : from;

    const rawEnd =
      shift.endedAt ?? now;

    const end =
      rawEnd < to
        ? rawEnd
        : to;

    if (end <= start) {
      return total;
    }

    return total + hoursBetween(start, end);
  }, 0);
}

async function calculateBookingMetrics(
  externalDriverId: string,
  from: Date,
  to: Date,
) {
  const bookings = await prisma.booking.findMany({
    where: {
      driverId: externalDriverId,
      pickupDueTime: {
        gte: from,
        lt: to,
      },
    },
    select: {
      status: true,
      completedAt: true,
      noFareAt: true,
      cancelledAt: true,
      price: true,
      cost: true,
    },
  });

  return {
    jobs: bookings.length,
    completed: bookings.filter(
      (booking) =>
        booking.completedAt !== null ||
        booking.status === "COMPLETED",
    ).length,
    noFare: bookings.filter(
      (booking) =>
        booking.noFareAt !== null ||
        booking.status === "NO_FARE",
    ).length,
    cancelled: bookings.filter(
      (booking) =>
        booking.cancelledAt !== null ||
        booking.status === "CANCELLED",
    ).length,
    revenue: bookings.reduce(
      (total, booking) =>
        total +
        revenueValue(
          booking.price,
          booking.cost,
        ),
      0,
    ),
  };
}

async function calculateRejections(
  externalDriverId: string,
  from: Date,
  to: Date,
) {
  const rows = await prisma.$queryRaw<
    Array<{ total: bigint }>
  >`
    SELECT COUNT(*)::bigint AS total
    FROM "WebhookEvent" rejected
    WHERE rejected."eventType" = 'BookingRejected'
      AND rejected.status = 'PROCESSED'
      AND rejected."receivedAt" >= ${from}
      AND rejected."receivedAt" < ${to}
      AND EXISTS (
        SELECT 1
        FROM "WebhookEvent" modified
        WHERE modified."externalBookingId" =
              rejected."externalBookingId"
          AND modified."eventType" =
              'BookingModified'
          AND modified."receivedAt" <
              rejected."receivedAt"
          AND modified.payload->'Driver'->>'Id' =
              ${externalDriverId}
          AND modified."receivedAt" = (
            SELECT MAX(previous."receivedAt")
            FROM "WebhookEvent" previous
            WHERE previous."externalBookingId" =
                  rejected."externalBookingId"
              AND previous."eventType" =
                  'BookingModified'
              AND previous."receivedAt" <
                  rejected."receivedAt"
              AND previous.payload->'Driver'->>'Id'
                  IS NOT NULL
          )
      )
  `;

  return Number(rows[0]?.total ?? 0);
}

export async function GET(
  request: Request,
  context: {
    params: {
      id: string;
    };
  },
) {
  const session =
    await getServerSession(authOptions);

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

  const driver =
    await prisma.driver.findUnique({
      where: {
        id: context.params.id,
      },
      include: {
        shifts: {
          where: {
            status: "ACTIVE",
          },
          orderBy: {
            startedAt: "desc",
          },
          take: 1,
          include: {
            vehicle: true,
          },
        },
      },
    });

  if (!driver) {
    return NextResponse.json(
      {
        success: false,
        error: "DRIVER_NOT_FOUND",
      },
      {
        status: 404,
      },
    );
  }

  const now = new Date();
  const todayFrom =
    startOfLondonDay(now);
  const todayTo =
    addLondonDays(todayFrom, 1);

  const weekFrom =
    startOfLondonWeek(now);
  const weekTo =
    addLondonDays(weekFrom, 7);

  const [
    todayHours,
    weekHours,
    todayBookings,
    weekBookings,
    todayRejections,
    weekRejections,
    assignedVehicles,
  ] = await Promise.all([
    calculateShiftHours(
      driver.id,
      todayFrom,
      todayTo,
      now,
    ),
    calculateShiftHours(
      driver.id,
      weekFrom,
      weekTo,
      now,
    ),
    calculateBookingMetrics(
      driver.externalId,
      todayFrom,
      todayTo,
    ),
    calculateBookingMetrics(
      driver.externalId,
      weekFrom,
      weekTo,
    ),
    calculateRejections(
      driver.externalId,
      todayFrom,
      todayTo,
    ),
    calculateRejections(
      driver.externalId,
      weekFrom,
      weekTo,
    ),
    prisma.vehicle.findMany({
      where: {
        provider: "AUTOCAB",
        isActive: true,
        OR: [
          {
            ownerDriverId:
              Number(driver.externalId),
          },
          {
            drivers: {
              array_contains: [
                Number(driver.externalId),
              ],
            },
          },
        ],
      },
      orderBy: {
        callsign: "asc",
      },
      select: {
        id: true,
        externalId: true,
        callsign: true,
        registration: true,
        plateNumber: true,
        make: true,
        model: true,
        ownerDriverId: true,
        capabilities: true,
      },
    }),
  ]);

  const currentShift =
    driver.shifts[0] ?? null;

  return NextResponse.json({
    success: true,
    driver: {
      id: driver.id,
      externalId: driver.externalId,
      callsign: driver.callsign,
      fullName: driver.fullName,
      mobile: driver.mobile,
      telephone: driver.telephone,
      email: driver.email,
      badgeNumber: driver.badgeNumber,
      licenceNumber: driver.licenceNumber,
      suspended: driver.suspended,
      currentShift: currentShift
        ? {
            startedAt:
              currentShift.startedAt,
            vehicle:
              currentShift.vehicle,
          }
        : null,
      assignedVehicles,
    },
    analytics: {
      today: {
        hours:
          Math.round(todayHours * 100) /
          100,
        ...todayBookings,
        rejections:
          todayRejections,
      },
      week: {
        hours:
          Math.round(weekHours * 100) /
          100,
        ...weekBookings,
        rejections:
          weekRejections,
      },
    },
  });
}
