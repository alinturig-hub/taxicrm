import { predictionJobBlock, predictionJobSkipped } from "@/modules/predictions/job-access";
import { PredictionsDisabled } from "@/modules/predictions/lifecycle";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { runCustomerPredictionMaintenance } from "@/lib/customers/customer-booking-predictions";
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
        .BOOKING_PREDICTIONS,
    );

  try {
    const body =
      (await request.json().catch(
        () => ({}),
      )) as {
        limit?: unknown;
      };

    const limit =
      typeof body.limit === "number" &&
      Number.isInteger(body.limit)
        ? body.limit
        : 50;

    const result =
      await runCustomerPredictionMaintenance({
        limit,
        activeDays: 60,
        minimumBookings: 5,
      });

    await completeCustomerIntelligenceJobRun(
      jobRun,
      {
        selected: result.selected,
        processed:
          result.refreshed +
          result.failed,
        succeeded: result.refreshed,
        failed: result.failed,
        hasMore: result.hasMore,
        message:
          "Customer booking prediction maintenance completed.",
      },
    );

    return NextResponse.json(result);
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
      "Customer prediction maintenance failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "CUSTOMER_PREDICTION_MAINTENANCE_FAILED",
        message:
          "Customer predictions could not be maintained.",
      },
      {
        status: 500,
      },
    );
  }
}
