import { prisma } from "@/lib/prisma";

export type CompanyMetricPeriod = {
  from: Date;
  to: Date;
  bookings: number;
  completed: number;
  cancelled: number;
  noFare: number;
  active: number;
  revenue: number;
  estimatedRevenueLost: number;
  averageCompletedBookingValue: number;
  completionRate: number;
  cancellationRate: number;
  noFareRate: number;
};

export type MetricTrend = {
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  direction: "UP" | "DOWN" | "FLAT";
};

export type CompanyMetricTrends = {
  revenueVsYesterday: MetricTrend;
  bookingsVsYesterday: MetricTrend;
  completedVsYesterday: MetricTrend;
  lostRevenueVsYesterday: MetricTrend;
  revenueVsLastWeek: MetricTrend;
  bookingsVsLastWeek: MetricTrend;
  revenueVsLastMonth: MetricTrend;
  bookingsVsLastMonth: MetricTrend;
};

export type CompanyMetrics = {
  generatedAt: Date;
  today: CompanyMetricPeriod;
  yesterday: CompanyMetricPeriod;
  week: CompanyMetricPeriod;
  lastWeek: CompanyMetricPeriod;
  month: CompanyMetricPeriod;
  lastMonth: CompanyMetricPeriod;
  trends: CompanyMetricTrends;
};

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

function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  return addDays(result, -daysSinceMonday);
}

function startOfMonth(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
}

function addMonths(date: Date, months: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth() + months,
    1,
    0,
    0,
    0,
    0,
  );
}

function createTrend(
  current: number,
  previous: number,
): MetricTrend {
  const change = round(current - previous);

  const changePercent =
    previous === 0
      ? current === 0
        ? 0
        : null
      : round(((current - previous) / previous) * 100);

  return {
    current: round(current),
    previous: round(previous),
    change,
    changePercent,
    direction:
      change > 0
        ? "UP"
        : change < 0
          ? "DOWN"
          : "FLAT",
  };
}

async function calculatePeriod(
  from: Date,
  to: Date,
): Promise<CompanyMetricPeriod> {
  const [
    bookings,
    completedBookings,
    cancelledBookings,
    noFareBookings,
    active,
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
        createdAt: {
          lt: to,
        },
        status: {
          in: [
            "ACTIVE",
            "CREATED",
            "DISPATCHED",
            "ACCEPTED",
            "ARRIVED",
            "POB",
          ],
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

  const noFareRevenueLost = noFareBookings.reduce(
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

  return {
    from,
    to,
    bookings,
    completed,
    cancelled,
    noFare,
    active,
    revenue: round(revenue),
    estimatedRevenueLost: round(
      cancelledRevenueLost + noFareRevenueLost,
    ),
    averageCompletedBookingValue:
      completed > 0 ? round(revenue / completed) : 0,
    completionRate: percentage(completed, bookings),
    cancellationRate: percentage(cancelled, bookings),
    noFareRate: percentage(noFare, bookings),
  };
}

export async function getCompanyMetrics(): Promise<CompanyMetrics> {
  const now = new Date();

  const todayFrom = startOfDay(now);
  const yesterdayFrom = addDays(todayFrom, -1);

  const weekFrom = startOfWeek(now);
  const lastWeekFrom = addDays(weekFrom, -7);

  const monthFrom = startOfMonth(now);
  const lastMonthFrom = addMonths(monthFrom, -1);

  const [
    today,
    yesterday,
    week,
    lastWeek,
    month,
    lastMonth,
  ] = await Promise.all([
    calculatePeriod(todayFrom, now),
    calculatePeriod(yesterdayFrom, todayFrom),
    calculatePeriod(weekFrom, now),
    calculatePeriod(lastWeekFrom, weekFrom),
    calculatePeriod(monthFrom, now),
    calculatePeriod(lastMonthFrom, monthFrom),
  ]);

  return {
    generatedAt: now,
    today,
    yesterday,
    week,
    lastWeek,
    month,
    lastMonth,
    trends: {
      revenueVsYesterday: createTrend(
        today.revenue,
        yesterday.revenue,
      ),
      bookingsVsYesterday: createTrend(
        today.bookings,
        yesterday.bookings,
      ),
      completedVsYesterday: createTrend(
        today.completed,
        yesterday.completed,
      ),
      lostRevenueVsYesterday: createTrend(
        today.estimatedRevenueLost,
        yesterday.estimatedRevenueLost,
      ),
      revenueVsLastWeek: createTrend(
        week.revenue,
        lastWeek.revenue,
      ),
      bookingsVsLastWeek: createTrend(
        week.bookings,
        lastWeek.bookings,
      ),
      revenueVsLastMonth: createTrend(
        month.revenue,
        lastMonth.revenue,
      ),
      bookingsVsLastMonth: createTrend(
        month.bookings,
        lastMonth.bookings,
      ),
    },
  };
}
