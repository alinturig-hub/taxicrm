import { prisma } from "@/lib/prisma";
import {
  calculateNoFareFinancials,
  estimateLostRevenue,
} from "@/lib/revenue/no-fare-financials";
import {
  addLondonDays,
  londonDateKey,
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
  const metricDate = londonDateKey(date);

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
        price: true,
        paymentType: true,
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
        status: true,
        completedAt: true,
        noFareAt: true,
        arrivedAt: true,
        fare: true,
        cost: true,
        price: true,
        estimatedPrice: true,
        paymentType: true,
        bookingSource: true,
        accountName: true,
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
      const bookingRevenue = toNumber(booking.price);
      const paymentType =
        booking.paymentType?.trim().toUpperCase() ?? "";

      if (bookingRevenue <= 0) {
        return totals;
      }

      totals.revenue += bookingRevenue;

      if (paymentType.includes("ACCOUNT")) {
        totals.accountRevenue += bookingRevenue;
      } else if (paymentType.includes("CASH")) {
        totals.cashRevenue += bookingRevenue;
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

  const completedRevenue = revenueBreakdown.revenue;

  for (const booking of noFareBookings) {
    const financials =
      calculateNoFareFinancials(booking);

    revenueBreakdown.revenue +=
      financials.companyRevenue;

    if (financials.revenueBucket === "ACCOUNT") {
      revenueBreakdown.accountRevenue +=
        financials.companyRevenue;
    } else if (
      financials.revenueBucket === "CARD"
    ) {
      revenueBreakdown.cardRevenue +=
        financials.companyRevenue;
    }
  }

  const revenue = revenueBreakdown.revenue;

  const cancelledRevenueLost =
    cancelledBookings.reduce(
      (total, booking) =>
        total +
        estimateLostRevenue(booking),
      0,
    );

  const noFareRevenueLost =
    noFareBookings.reduce(
      (total, booking) =>
        total +
        calculateNoFareFinancials(booking)
          .estimatedCashLoss,
      0,
    );

  const completed = completedBookings.length;
  const cancelled = cancelledBookings.length;
  const noFare = noFareBookings.length;

  return prisma.companyDailyMetric.upsert({
    where: {
      date: metricDate,
    },
    create: {
      date: metricDate,
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
          ? round(completedRevenue / completed)
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
          ? round(completedRevenue / completed)
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
