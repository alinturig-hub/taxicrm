import {
  NextRequest,
  NextResponse,
} from "next/server";

import { maintainBookingDemandForecast } from "@/lib/customers/booking-demand-forecast";
import {
  completeCustomerIntelligenceJobRun,
  CUSTOMER_INTELLIGENCE_JOBS,
  failCustomerIntelligenceJobRun,
  startCustomerIntelligenceJobRun,
} from "@/lib/customers/customer-intelligence-job-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
) {
  const secret =
    request.headers.get(
      "x-cron-secret",
    );

  if (
    !process.env.CRON_SECRET ||
    secret !== process.env.CRON_SECRET
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

  const jobRun =
    await startCustomerIntelligenceJobRun(
      CUSTOMER_INTELLIGENCE_JOBS
        .BOOKING_DEMAND_FORECAST,
    );

  try {
    const result =
      await maintainBookingDemandForecast();

    const completed =
      result.evaluation.evaluated;
    await completeCustomerIntelligenceJobRun(
      jobRun,
      {
        selected:
          result.evaluation.selected +
          1,
        processed:
          completed + 1,
        succeeded:
          completed + 1,
        failed: 0,
        hasMore:
          result.evaluation.hasMore,
        message:
          "Unique-booking demand forecast maintenance completed.",
      },
    );

    return NextResponse.json({
      success: true,
      created:
        result.created,
      evaluatedExpired:
        completed,
      forecast: {
        id:
          result.forecast.id,
        modelVersion:
          result.forecast
            .modelVersion,
        targetType:
          result.forecast
            .targetType,
        status:
          result.forecast.status,
        issuedAt:
          result.forecast.issuedAt,
        windowStartAt:
          result.forecast
            .windowStartAt,
        windowEndAt:
          result.forecast
            .windowEndAt,
        predictedBookings:
          result.forecast
            .predictedCount,
        lowerBound:
          result.forecast.lowerBound,
        upperBound:
          result.forecast.upperBound,
        calibrationDays:
          result.forecast
            .calibrationDays,
        backtestMae:
          Number(
            result.forecast
              .backtestMae,
          ),
        backtestMape:
          Number(
            result.forecast
              .backtestMape,
          ),
        slots:
          result.forecast
            .slotForecasts,
      },
      containsPersonalData: false,
    });
  } catch (error) {
    await failCustomerIntelligenceJobRun(
      jobRun,
      error,
    );

    console.error(
      "Booking demand forecast maintenance failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "BOOKING_DEMAND_FORECAST_FAILED",
        message:
          "Booking demand could not be forecast.",
      },
      {
        status: 500,
      },
    );
  }
}
