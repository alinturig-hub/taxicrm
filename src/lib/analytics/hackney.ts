import { prisma } from "@/lib/prisma";
import {
  hackneyPeriod,
  summariseHackneyDrivers,
} from "@/lib/analytics/hackney-performance";

export type HackneyMetrics = {
  total: number;
  completed: number;
  otherStatuses: number;
  monthly: {
    month: number;
    total: number;
    completed: number;
  }[];
};

export async function getHackneyMetrics(year = 2026): Promise<HackneyMetrics> {
  const { from, to } = hackneyPeriod(`${year}-01-01`, `${year}-12-31`);

  const rows = await prisma.$queryRaw<
    { month: number; total: bigint; completed: bigint }[]
  >`
    SELECT
      EXTRACT(MONTH FROM ("pickupDueTime" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London')::int AS month,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE "status" = 'COMPLETED'
      )::bigint AS completed
    FROM "Booking"
    WHERE "bookingSource" = 'FlaggedBooking'
      AND "provider" = 'AUTOCAB'
      AND "pickupDueTime" >= ${from}
      AND "pickupDueTime" < ${to}
    GROUP BY 1
    ORDER BY 1
  `;

  const monthly = Array.from({ length: 12 }, (_, index) => {
    const row = rows.find((item) => item.month === index + 1);
    return {
      month: index + 1,
      total: Number(row?.total ?? 0),
      completed: Number(row?.completed ?? 0),
    };
  });

  const total = monthly.reduce((sum, m) => sum + m.total, 0);
  const completed = monthly.reduce((sum, m) => sum + m.completed, 0);

  return {
    total,
    completed,
    otherStatuses: total - completed,
    monthly,
  };
}

export async function getHackneyDriverPerformance(
  fromDate: string,
  toDate: string,
) {
  const period = hackneyPeriod(fromDate, toDate);
  const [bookings, drivers, undatedBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        provider: "AUTOCAB",
        bookingSource: "FlaggedBooking",
        pickupDueTime: { gte: period.from, lt: period.to },
      },
      select: { driverBadgeNumber: true, status: true, fare: true },
    }),
    // Historical jobs may belong to inactive or archived drivers.
    prisma.driver.findMany({
      where: { provider: "AUTOCAB" },
      select: {
        id: true,
        badgeNumber: true,
        fullName: true,
        forename: true,
        surname: true,
      },
    }),
    prisma.booking.count({
      where: {
        provider: "AUTOCAB",
        bookingSource: "FlaggedBooking",
        pickupDueTime: null,
      },
    }),
  ]);
  return {
    period,
    ...summariseHackneyDrivers(bookings, drivers),
    undatedBookings,
  };
}
