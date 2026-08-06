import { prisma } from "@/lib/prisma";
import {
  addLondonDays,
  startOfLondonDay,
} from "@/lib/time/london-calendar";

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
  const from = startOfLondonDay(date);
  const to = addLondonDays(from, 1);

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
        cost: true,
        price: true,
        paymentType: true,
        accountAmount: true,
        cashAmount: true,
        cardAmount: true,
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

  const revenueBreakdown = completedBookings.reduce(
    (totals, booking) => {
      const price = toNumber(booking.price);
      const cost = toNumber(booking.cost);

      const bookingRevenue =
        price > 0 ? price : cost;

      const explicitAccount =
        toNumber(booking.accountAmount);
      const explicitCash =
        toNumber(booking.cashAmount);
      const explicitCard =
        toNumber(booking.cardAmount);

      const paymentType =
        booking.paymentType?.trim().toUpperCase() ?? "";

      totals.revenue += bookingRevenue;

      if (explicitAccount > 0) {
        totals.accountRevenue += explicitAccount;
      } else if (paymentType.includes("ACCOUNT")) {
        totals.accountRevenue += bookingRevenue;
      }

      if (explicitCash > 0) {
        totals.cashRevenue += explicitCash;
      } else if (paymentType.includes("CASH")) {
        totals.cashRevenue += bookingRevenue;
      }

      if (explicitCard > 0) {
        totals.cardRevenue += explicitCard;
      } else if (
        paymentType.includes("CARD") ||
        paymentType.includes("CREDIT") ||
        paymentType.includes("DEBIT")
      ) {
        totals.cardRevenue += bookingRevenue;
      }

      return totals;
    },
    {
      revenue: 0,
      cashRevenue: 0,
      accountRevenue: 0,
      cardRevenue: 0,
    },
  );

  const revenue = revenueBreakdown.revenue;

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
      cashRevenue: round(
        revenueBreakdown.cashRevenue,
      ),
      accountRevenue: round(
        revenueBreakdown.accountRevenue,
      ),
      cardRevenue: round(
        revenueBreakdown.cardRevenue,
      ),
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
      cashRevenue: round(
        revenueBreakdown.cashRevenue,
      ),
      accountRevenue: round(
        revenueBreakdown.accountRevenue,
      ),
      cardRevenue: round(
        revenueBreakdown.cardRevenue,
      ),
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
