import {
  getCompanyMetrics,
  type CompanyMetricPeriod,
} from "@/lib/analytics/company";

export type AnalyticsMetric =
  | "REVENUE"
  | "BOOKINGS"
  | "BOOKING_STATUS"
  | "PERIOD_COMPARISON";

export type AnalyticsPeriod =
  | "TODAY"
  | "YESTERDAY"
  | "THIS_WEEK"
  | "LAST_WEEK"
  | "THIS_MONTH"
  | "LAST_MONTH";

export type AnalyticsQueryPlan = {
  metric: AnalyticsMetric;
  period: AnalyticsPeriod;
  comparisonMetric?:
    | "REVENUE"
    | "BOOKINGS";
};

export type AnalyticsAnswer = {
  headline: string;
  summary: string;
  metrics: Array<{
    label: string;
    value: number;
    suffix?: string;
  }>;
  evidence: string[];
  sources: Array<{
    label: string;
    href: string;
  }>;
};

function money(value: number) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    },
  ).format(value);
}

function periodLabel(
  period: AnalyticsPeriod,
) {
  switch (period) {
    case "TODAY":
      return "today so far";
    case "YESTERDAY":
      return "yesterday";
    case "THIS_WEEK":
      return "this week so far";
    case "LAST_WEEK":
      return "last week";
    case "THIS_MONTH":
      return "this month so far";
    case "LAST_MONTH":
      return "last month";
  }
}

function selectPeriod(
  metrics: Awaited<
    ReturnType<typeof getCompanyMetrics>
  >,
  period: AnalyticsPeriod,
): CompanyMetricPeriod {
  switch (period) {
    case "TODAY":
      return metrics.today;
    case "YESTERDAY":
      return metrics.yesterday;
    case "THIS_WEEK":
      return metrics.week;
    case "LAST_WEEK":
      return metrics.lastWeek;
    case "THIS_MONTH":
      return metrics.month;
    case "LAST_MONTH":
      return metrics.lastMonth;
  }
}

function detectPeriod(
  question: string,
): AnalyticsPeriod {
  if (
    /yesterday|ieri/.test(question)
  ) {
    return "YESTERDAY";
  }

  /*
   * When a comparison contains both "this week"
   * and "last week", the current period must win.
   */
  if (
    /this week|current week|săptămâna aceasta|saptamana aceasta/.test(
      question,
    )
  ) {
    return "THIS_WEEK";
  }

  if (
    /last week|previous week|săptămâna trecută|saptamana trecuta/.test(
      question,
    )
  ) {
    return "LAST_WEEK";
  }

  if (
    /this month|current month|luna aceasta/.test(
      question,
    )
  ) {
    return "THIS_MONTH";
  }

  if (
    /last month|previous month|luna trecută|luna trecuta/.test(
      question,
    )
  ) {
    return "LAST_MONTH";
  }

  return "TODAY";
}

export function planAnalyticsQuestion(
  question: string,
): AnalyticsQueryPlan | null {
  const normalized =
    question.trim().toLowerCase();

  const period =
    detectPeriod(normalized);

  const asksComparison =
    /compare|comparison|versus| vs |difference|change|trend|compar|față de|fata de/.test(
      normalized,
    );

  const asksRevenue =
    /revenue|income|takings|sales|turnover|venit|încas|incas|valoarea joburilor/.test(
      normalized,
    );

  const asksBookingStatus =
    /completed|cancelled|canceled|no fare|no-fare|status|finalizat|terminat|anulat|neprezent/.test(
      normalized,
    );

  const asksBookings =
    /booking|bookings|job|jobs|curse|rezervări|rezervari/.test(
      normalized,
    );

  if (asksComparison) {
    return {
      metric:
        "PERIOD_COMPARISON",
      period,
      comparisonMetric:
        asksRevenue
          ? "REVENUE"
          : "BOOKINGS",
    };
  }

  if (asksRevenue) {
    return {
      metric: "REVENUE",
      period,
    };
  }

  if (asksBookingStatus) {
    return {
      metric:
        "BOOKING_STATUS",
      period,
    };
  }

  if (asksBookings) {
    return {
      metric: "BOOKINGS",
      period,
    };
  }

  return null;
}

function revenueAnswer(
  period: CompanyMetricPeriod,
  selectedPeriod: AnalyticsPeriod,
): AnalyticsAnswer {
  const label =
    periodLabel(selectedPeriod);

  return {
    headline:
      `${money(period.revenue)} revenue ${label}`,
    summary:
      `${period.completed.toLocaleString(
        "en-GB",
      )} completed jobs generated ${money(
        period.revenue,
      )}, with an average completed-job value of ${money(
        period.averageCompletedBookingValue,
      )}.`,
    metrics: [
      {
        label: "Revenue",
        value: period.revenue,
        suffix: " GBP",
      },
      {
        label: "Completed jobs",
        value: period.completed,
      },
      {
        label: "Average job value",
        value:
          period.averageCompletedBookingValue,
        suffix: " GBP",
      },
      {
        label: "Cash",
        value: period.cashRevenue,
        suffix: " GBP",
      },
      {
        label: "Card",
        value: period.cardRevenue,
        suffix: " GBP",
      },
      {
        label: "Account",
        value: period.accountRevenue,
        suffix: " GBP",
      },
    ],
    evidence: [
      "Revenue includes bookings completed inside the selected London-time period.",
      "Each completed booking contributes price, falling back to cost only when price is unavailable or zero.",
      "Cash, card and account values classify the total revenue and are not added again to it.",
      selectedPeriod === "TODAY" ||
      selectedPeriod === "THIS_WEEK" ||
      selectedPeriod === "THIS_MONTH"
        ? "The selected period is still in progress, so this is a so-far value."
        : "The selected period is complete.",
      "Only aggregate financial values are supplied to the language model.",
    ],
    sources: [
      {
        label:
          "Executive Dashboard",
        href:
          "/dashboard",
      },
    ],
  };
}

function bookingsAnswer(
  period: CompanyMetricPeriod,
  selectedPeriod: AnalyticsPeriod,
): AnalyticsAnswer {
  const label =
    periodLabel(selectedPeriod);

  return {
    headline:
      `${period.bookings.toLocaleString(
        "en-GB",
      )} bookings ${label}`,
    summary:
      `${period.completed.toLocaleString(
        "en-GB",
      )} were completed, ${period.cancelled.toLocaleString(
        "en-GB",
      )} were cancelled and ${period.noFare.toLocaleString(
        "en-GB",
      )} ended as no fare.`,
    metrics: [
      {
        label: "Bookings",
        value: period.bookings,
      },
      {
        label: "Completed",
        value: period.completed,
      },
      {
        label: "Cancelled",
        value: period.cancelled,
      },
      {
        label: "No fare",
        value: period.noFare,
      },
      {
        label: "Completion rate",
        value: period.completionRate,
        suffix: "%",
      },
      {
        label: "Cancellation rate",
        value: period.cancellationRate,
        suffix: "%",
      },
    ],
    evidence: [
      "Bookings are counted from unique TaxiCRM Booking records created inside the selected London-time period.",
      "Completed, cancelled and no-fare counts use their actual outcome timestamps.",
      "An unfinished current period is labelled as so far.",
      "Only aggregate operational counts are supplied to the language model.",
    ],
    sources: [
      {
        label: "Bookings",
        href:
          "/dashboard/bookings",
      },
      {
        label:
          "Executive Dashboard",
        href:
          "/dashboard",
      },
    ],
  };
}

function bookingStatusAnswer(
  period: CompanyMetricPeriod,
  selectedPeriod: AnalyticsPeriod,
): AnalyticsAnswer {
  const label =
    periodLabel(selectedPeriod);

  return {
    headline:
      `${period.completed.toLocaleString(
        "en-GB",
      )} completed jobs ${label}`,
    summary:
      `TaxiCRM recorded ${period.cancelled.toLocaleString(
        "en-GB",
      )} cancellations and ${period.noFare.toLocaleString(
        "en-GB",
      )} no-fare outcomes during the same period.`,
    metrics: [
      {
        label: "Completed",
        value: period.completed,
      },
      {
        label: "Cancelled",
        value: period.cancelled,
      },
      {
        label: "No fare",
        value: period.noFare,
      },
      {
        label: "Bookings created",
        value: period.bookings,
      },
      {
        label: "Completion rate",
        value: period.completionRate,
        suffix: "%",
      },
      {
        label: "Cancellation rate",
        value: period.cancellationRate,
        suffix: "%",
      },
    ],
    evidence: [
      "Completed, cancelled and no-fare outcomes use their actual event timestamps.",
      "Bookings created uses the Booking creation timestamp and is shown separately.",
      "Outcome counts and bookings-created counts describe different event populations and must not be added together.",
      selectedPeriod === "TODAY" ||
      selectedPeriod === "THIS_WEEK" ||
      selectedPeriod === "THIS_MONTH"
        ? "The selected period is still in progress."
        : "The selected period is complete.",
      "Only aggregate operational counts are supplied to the language model.",
    ],
    sources: [
      {
        label: "Bookings",
        href:
          "/dashboard/bookings",
      },
      {
        label:
          "Executive Dashboard",
        href:
          "/dashboard",
      },
    ],
  };
}

function comparisonAnswer(
  metrics: Awaited<
    ReturnType<typeof getCompanyMetrics>
  >,
  plan: AnalyticsQueryPlan,
): AnalyticsAnswer {
  const revenue =
    plan.comparisonMetric ===
    "REVENUE";

  const trend =
    plan.period === "THIS_WEEK"
      ? revenue
        ? metrics.trends
            .revenueVsLastWeek
        : metrics.trends
            .bookingsVsLastWeek
      : plan.period === "THIS_MONTH"
        ? revenue
          ? metrics.trends
              .revenueVsLastMonth
          : metrics.trends
              .bookingsVsLastMonth
        : revenue
          ? metrics.trends
              .revenueVsYesterday
          : metrics.trends
              .bookingsVsYesterday;

  const metricLabel =
    revenue
      ? "Revenue"
      : "Bookings";

  const currentText =
    revenue
      ? money(trend.current)
      : trend.current.toLocaleString(
          "en-GB",
        );

  const previousText =
    revenue
      ? money(trend.previous)
      : trend.previous.toLocaleString(
          "en-GB",
        );

  return {
    headline:
      `${metricLabel} comparison — current period is incomplete`,
    summary:
      `${currentText} in the current period so far versus ${previousText} in the previous complete period. ${
        trend.changePercent === null
          ? "A percentage change cannot be calculated from a zero baseline."
          : `The recorded change is ${trend.changePercent}%.`
      }`,
    metrics: [
      {
        label: "Current",
        value: trend.current,
        ...(revenue
          ? {
              suffix: " GBP",
            }
          : {}),
      },
      {
        label: "Previous",
        value: trend.previous,
        ...(revenue
          ? {
              suffix: " GBP",
            }
          : {}),
      },
      {
        label: "Difference",
        value: trend.change,
        ...(revenue
          ? {
              suffix: " GBP",
            }
          : {}),
      },
      ...(trend.changePercent === null
        ? []
        : [
            {
              label:
                "Change",
              value:
                trend.changePercent,
              suffix: "%",
            },
          ]),
    ],
    evidence: [
      "The current period may still be in progress.",
      "The previous value represents the corresponding previous complete calendar period.",
      "This comparison must not be interpreted as a same-time-of-day performance comparison.",
      "All calendar boundaries use Europe/London time.",
    ],
    sources: [
      {
        label:
          "Executive Dashboard",
        href:
          "/dashboard",
      },
    ],
  };
}

export async function executeAnalyticsQuery(
  plan: AnalyticsQueryPlan,
): Promise<AnalyticsAnswer> {
  const metrics =
    await getCompanyMetrics();

  if (
    plan.metric ===
    "PERIOD_COMPARISON"
  ) {
    return comparisonAnswer(
      metrics,
      plan,
    );
  }

  const period =
    selectPeriod(
      metrics,
      plan.period,
    );

  if (plan.metric === "REVENUE") {
    return revenueAnswer(
      period,
      plan.period,
    );
  }

  if (
    plan.metric ===
    "BOOKING_STATUS"
  ) {
    return bookingStatusAnswer(
      period,
      plan.period,
    );
  }

  return bookingsAnswer(
    period,
    plan.period,
  );
}
