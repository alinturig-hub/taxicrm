import { NextResponse } from "next/server";
import { buildCompanyDailyMetrics } from "@/lib/analytics/build-company-daily-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const metric = await buildCompanyDailyMetrics(
      new Date(),
    );

    return NextResponse.json({
      success: true,
      message:
        "Company daily metrics rebuilt successfully.",
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
        averageBookingValue: Number(
          metric.averageBookingValue,
        ),
        completionRate: Number(
          metric.completionRate,
        ),
        cancellationRate: Number(
          metric.cancellationRate,
        ),
        noFareRate: Number(metric.noFareRate),
        rejectionRate: Number(
          metric.rejectionRate,
        ),
        updatedAt: metric.updatedAt,
      },
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
