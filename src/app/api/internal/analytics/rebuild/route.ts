import { NextResponse } from "next/server";

import { buildCompanyDailyMetrics } from "@/lib/analytics/build-company-daily-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;
const MAX_REBUILD_DAYS = 400;

function parseDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(
    Date.UTC(year, month - 1, day, 12),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export async function POST(request: Request) {
  try {
    const rebuildKey =
      request.headers.get("x-analytics-rebuild-key");

    const expectedKey =
      process.env.NEXTAUTH_SECRET;

    if (
      !expectedKey ||
      rebuildKey !== expectedKey
    ) {
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

    const url = new URL(request.url);
    const fromValue = url.searchParams.get("from");
    const toValue = url.searchParams.get("to");

    if (!fromValue && !toValue) {
      const metric = await buildCompanyDailyMetrics(
        new Date(),
      );

      return NextResponse.json({
        success: true,
        message:
          "Company daily metrics rebuilt successfully.",
        rebuiltDays: 1,
        metric: {
          id: metric.id,
          date: metric.date,
          bookings: metric.bookings,
          completed: metric.completed,
          cancelled: metric.cancelled,
          noFare: metric.noFare,
          rejected: metric.rejected,
          revenue: Number(metric.revenue),
          estimatedRevenueLost: Number(
            metric.estimatedRevenueLost,
          ),
          updatedAt: metric.updatedAt,
        },
      });
    }

    if (!fromValue || !toValue) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_DATE_RANGE",
          message:
            "Both from and to dates are required.",
        },
        {
          status: 400,
        },
      );
    }

    const from = parseDate(fromValue);
    const to = parseDate(toValue);

    if (!from || !to || from > to) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_DATE_RANGE",
          message:
            "Expected a valid YYYY-MM-DD date range.",
        },
        {
          status: 400,
        },
      );
    }

    const totalDays =
      Math.floor(
        (
          to.getTime() - from.getTime()
        ) / 86_400_000,
      ) + 1;

    if (totalDays > MAX_REBUILD_DAYS) {
      return NextResponse.json(
        {
          success: false,
          error: "DATE_RANGE_TOO_LARGE",
          message: `Maximum range is ${MAX_REBUILD_DAYS} days.`,
        },
        {
          status: 400,
        },
      );
    }

    let rebuiltDays = 0;
    let current = new Date(from);

    while (current <= to) {
      await buildCompanyDailyMetrics(current);
      rebuiltDays += 1;

      current = new Date(
        current.getTime() + 86_400_000,
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Company daily metrics rebuilt successfully.",
      from: formatDate(from),
      to: formatDate(to),
      rebuiltDays,
    });
  } catch (error) {
    console.error(
      "Company analytics rebuild failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "ANALYTICS_REBUILD_FAILED",
        message:
          "Company daily metrics could not be rebuilt.",
      },
      {
        status: 500,
      },
    );
  }
}
