import { prisma } from "@/lib/prisma";

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function percentage(
  numerator: number,
  denominator: number,
): number {
  if (denominator === 0) {
    return 0;
  }

  return round((numerator / denominator) * 100);
}

export async function buildCompanyDailyMetrics(
  date: Date,
) {
  const from = startOfDay(date);
  const to = addDays(from, 1);

  const [
    bookings,
    completedBookings,
    cancelledBookings,
    noFareBookings,
    rejected,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        createdAt: {
          gte: from,
          lt: to,
        },
      },
    }),

    prisma.booking.findMany({
      where: {
        completedAt: {
          gte: from,
          lt: to,
        },
      },
      select: {
        fare: true,
        price: true,
      },
    }),

    prisma.booking.findMany({
      where: {
        cancelledAt: {
          gte: from,
          lt: to,
        },
      },
      select: {
        fare: true,
        price: true,
        estimatedPrice: true,
      },
    }),

    prisma.booking.findMany({
      where: {
        noFareAt: {
          gte: from,
          lt: to,
        },
      },
      select: {
        fare: true,
        price: true,
        estimatedPrice: true,
      },
    }),

    prisma.booking.count({
      where: {
        status: "REJECTED",
        updatedAt: {
          gte: from,
          lt: to,
        },
      },
    }),
  ]);

  const revenue = completedBookings.reduce(
    (total, booking) =>
      total + toNumber(booking.fare ?? booking.price),
    0,
  );

  const cancelledRevenueLost =
    cancelledBookings.reduce(
      (total, booking) =>
        total +
        toNumber(
          booking.price ??
            booking.fare ??
            booking.estimatedPrice,
        ),
      0,
    );

  const noFareRevenueLost =
    noFareBookings.reduce(
      (total, booking) =>
        total +
        toNumber(
          booking.price ??
            booking.fare ??
            booking.estimatedPrice,
        ),
      0,
    );

  const completed = completedBookings.length;
  const cancelled = cancelledBookings.length;
  const noFare = noFareBookings.length;

  return prisma.companyDailyMetric.upsert({
    where: {
      date: from,
    },
    create: {
      date: from,
      bookings,
      completed,
      cancelled,
      noFare,
      rejected,
      revenue: round(revenue),
      estimatedRevenueLost: round(
        cancelledRevenueLost + noFareRevenueLost,
      ),
      averageBookingValue:
        completed > 0
          ? round(revenue / completed)
          : 0,
      completionRate: percentage(
        completed,
        bookings,
      ),
      cancellationRate: percentage(
        cancelled,
        bookings,
      ),
      noFareRate: percentage(noFare, bookings),
      rejectionRate: percentage(
        rejected,
        bookings,
      ),
    },
    update: {
      bookings,
      completed,
      cancelled,
      noFare,
      rejected,
      revenue: round(revenue),
      estimatedRevenueLost: round(
        cancelledRevenueLost + noFareRevenueLost,
      ),
      averageBookingValue:
        completed > 0
          ? round(revenue / completed)
          : 0,
      completionRate: percentage(
        completed,
        bookings,
      ),
      cancellationRate: percentage(
        cancelled,
        bookings,
      ),
      noFareRate: percentage(noFare, bookings),
      rejectionRate: percentage(
        rejected,
        bookings,
      ),
    },
  });
}
