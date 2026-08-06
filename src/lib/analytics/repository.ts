import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type StoredCompanyDailyMetric = {
  id: string;
  date: Date;
  bookings: number;
  completed: number;
  cancelled: number;
  noFare: number;
  rejected: number;
  revenue: number;
  cashRevenue: number;
  accountRevenue: number;
  cardRevenue: number;
  estimatedRevenueLost: number;
  averageBookingValue: number;
  completionRate: number;
  cancellationRate: number;
  noFareRate: number;
  rejectionRate: number;
  createdAt: Date;
  updatedAt: Date;
};

function toNumber(value: Prisma.Decimal): number {
  return Number(value);
}

function mapDailyMetric(
  metric: {
    id: string;
    date: Date;
    bookings: number;
    completed: number;
    cancelled: number;
    noFare: number;
    rejected: number;
    revenue: Prisma.Decimal;
    cashRevenue: Prisma.Decimal;
    accountRevenue: Prisma.Decimal;
    cardRevenue: Prisma.Decimal;
    estimatedRevenueLost: Prisma.Decimal;
    averageBookingValue: Prisma.Decimal;
    completionRate: Prisma.Decimal;
    cancellationRate: Prisma.Decimal;
    noFareRate: Prisma.Decimal;
    rejectionRate: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  },
): StoredCompanyDailyMetric {
  return {
    id: metric.id,
    date: metric.date,
    bookings: metric.bookings,
    completed: metric.completed,
    cancelled: metric.cancelled,
    noFare: metric.noFare,
    rejected: metric.rejected,
    revenue: toNumber(metric.revenue),
    cashRevenue: toNumber(metric.cashRevenue),
    accountRevenue: toNumber(
      metric.accountRevenue,
    ),
    cardRevenue: toNumber(metric.cardRevenue),
    estimatedRevenueLost: toNumber(
      metric.estimatedRevenueLost,
    ),
    averageBookingValue: toNumber(
      metric.averageBookingValue,
    ),
    completionRate: toNumber(metric.completionRate),
    cancellationRate: toNumber(
      metric.cancellationRate,
    ),
    noFareRate: toNumber(metric.noFareRate),
    rejectionRate: toNumber(metric.rejectionRate),
    createdAt: metric.createdAt,
    updatedAt: metric.updatedAt,
  };
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

export async function getDailyMetric(
  date: Date,
): Promise<StoredCompanyDailyMetric | null> {
  const metric = await prisma.companyDailyMetric.findUnique({
    where: {
      date: startOfDay(date),
    },
  });

  return metric ? mapDailyMetric(metric) : null;
}

export async function getDailyMetricsBetween(
  from: Date,
  to: Date,
): Promise<StoredCompanyDailyMetric[]> {
  const metrics =
    await prisma.companyDailyMetric.findMany({
      where: {
        date: {
          gte: startOfDay(from),
          lt: startOfDay(to),
        },
      },
      orderBy: {
        date: "asc",
      },
    });

  return metrics.map(mapDailyMetric);
}

export async function getTodayMetric() {
  return getDailyMetric(new Date());
}

export async function getCurrentWeekMetrics() {
  const now = new Date();

  return getDailyMetricsBetween(
    startOfWeek(now),
    addDays(startOfDay(now), 1),
  );
}

export async function getCurrentMonthMetrics() {
  const now = new Date();

  return getDailyMetricsBetween(
    startOfMonth(now),
    addDays(startOfDay(now), 1),
  );
}

export async function getLatestDailyMetrics(
  limit = 30,
): Promise<StoredCompanyDailyMetric[]> {
  const metrics =
    await prisma.companyDailyMetric.findMany({
      orderBy: {
        date: "desc",
      },
      take: limit,
    });

  return metrics.map(mapDailyMetric);
}
