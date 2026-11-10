import { predictionJobBlock, predictionJobSkipped } from "@/modules/predictions/job-access";
import { PredictionsDisabled } from "@/modules/predictions/lifecycle";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { evaluateBookingDemandAlerts } from "@/lib/customers/booking-demand-alerts";
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

  const moduleBlock = await predictionJobBlock();
  if (moduleBlock) return moduleBlock;

  const jobRun =
    await startCustomerIntelligenceJobRun(
      CUSTOMER_INTELLIGENCE_JOBS
        .BOOKING_DEMAND_FORECAST,
    );

  try {
    const result =
      await maintainBookingDemandForecast();

    const alerts =
      await evaluateBookingDemandAlerts();

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
      alerts,
      containsPersonalData: false,
    });
  } catch (error) {
    if (error instanceof PredictionsDisabled) {
      await completeCustomerIntelligenceJobRun(jobRun, { selected: 0, processed: 0, succeeded: 0, failed: 0, hasMore: false, message: "Predictions paused by installation settings." });
      return predictionJobSkipped();
    }
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
