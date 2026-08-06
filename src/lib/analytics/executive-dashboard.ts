import type {
  CompanyMetricPeriod,
  CompanyMetrics,
  MetricTrend,
} from "@/lib/analytics/company";
import {
  getDailyMetricsBetween,
  type StoredCompanyDailyMetric,
} from "@/lib/analytics/repository";
import {
  addLondonDays,
  addLondonMonths,
  londonDateKey,
  startOfLondonDay,
  startOfLondonMonth,
  startOfLondonWeek,
} from "@/lib/time/london-calendar";

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

function aggregatePeriod(
  from: Date,
  to: Date,
  metrics: StoredCompanyDailyMetric[],
): CompanyMetricPeriod {
  const totals = metrics.reduce(
    (result, metric) => {
      result.bookings += metric.bookings;
      result.completed += metric.completed;
      result.cancelled += metric.cancelled;
      result.noFare += metric.noFare;
      result.revenue += metric.revenue;
      result.cashRevenue += metric.cashRevenue;
      result.accountRevenue += metric.accountRevenue;
      result.cardRevenue += metric.cardRevenue;
      result.estimatedRevenueLost +=
        metric.estimatedRevenueLost;

      return result;
    },
    {
      bookings: 0,
      completed: 0,
      cancelled: 0,
      noFare: 0,
      revenue: 0,
      cashRevenue: 0,
      accountRevenue: 0,
      cardRevenue: 0,
      estimatedRevenueLost: 0,
    },
  );

  return {
    from,
    to,
    bookings: totals.bookings,
    completed: totals.completed,
    cancelled: totals.cancelled,
    noFare: totals.noFare,

    /*
     * Active is a point-in-time operational metric and is not
     * currently stored in CompanyDailyMetric.
     */
    active: 0,

    revenue: round(totals.revenue),
    cashRevenue: round(totals.cashRevenue),
    accountRevenue: round(
      totals.accountRevenue,
    ),
    cardRevenue: round(totals.cardRevenue),
    estimatedRevenueLost: round(
      totals.estimatedRevenueLost,
    ),

    averageCompletedBookingValue:
      totals.completed > 0
        ? round(totals.revenue / totals.completed)
        : 0,

    completionRate: percentage(
      totals.completed,
      totals.bookings,
    ),

    cancellationRate: percentage(
      totals.cancelled,
      totals.bookings,
    ),

    noFareRate: percentage(
      totals.noFare,
      totals.bookings,
    ),
  };
}

function selectMetrics(
  metrics: StoredCompanyDailyMetric[],
  from: Date,
  to: Date,
): StoredCompanyDailyMetric[] {
  const fromTime = londonDateKey(from).getTime();
  const toTime = londonDateKey(to).getTime();

  return metrics.filter((metric) => {
    const metricTime = londonDateKey(
      metric.date,
    ).getTime();

    return metricTime >= fromTime && metricTime < toTime;
  });
}

export async function getExecutiveDashboard(): Promise<CompanyMetrics> {
  const now = new Date();
  const tomorrow = addLondonDays(startOfLondonDay(now), 1);

  const todayFrom = startOfLondonDay(now);
  const yesterdayFrom = addLondonDays(todayFrom, -1);

  const weekFrom = startOfLondonWeek(now);
  const lastWeekFrom = addLondonDays(weekFrom, -7);

  const monthFrom = startOfLondonMonth(now);
  const lastMonthFrom = addLondonMonths(monthFrom, -1);

  const storedMetrics = await getDailyMetricsBetween(
    lastMonthFrom,
    tomorrow,
  );

  const today = aggregatePeriod(
    todayFrom,
    tomorrow,
    selectMetrics(storedMetrics, todayFrom, tomorrow),
  );

  const yesterday = aggregatePeriod(
    yesterdayFrom,
    todayFrom,
    selectMetrics(
      storedMetrics,
      yesterdayFrom,
      todayFrom,
    ),
  );

  const week = aggregatePeriod(
    weekFrom,
    tomorrow,
    selectMetrics(storedMetrics, weekFrom, tomorrow),
  );

  const lastWeek = aggregatePeriod(
    lastWeekFrom,
    weekFrom,
    selectMetrics(
      storedMetrics,
      lastWeekFrom,
      weekFrom,
    ),
  );

  const month = aggregatePeriod(
    monthFrom,
    tomorrow,
    selectMetrics(storedMetrics, monthFrom, tomorrow),
  );

  const lastMonth = aggregatePeriod(
    lastMonthFrom,
    monthFrom,
    selectMetrics(
      storedMetrics,
      lastMonthFrom,
      monthFrom,
    ),
  );

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
