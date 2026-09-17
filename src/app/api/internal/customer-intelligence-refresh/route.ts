import {
  NextRequest,
  NextResponse,
} from "next/server";

import { syncCustomerBehaviourTags } from "@/lib/customers/sync-customer-behaviour-tags";
import { enrichFrequentPlaceCategories } from "@/lib/places/geoapify-place-category-enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

let refreshRunning = false;

export async function POST(
  request: NextRequest,
) {
  const secret =
    request.headers.get(
      "x-cron-secret",
    );

  if (
    !process.env.CRON_SECRET ||
    secret !==
      process.env.CRON_SECRET
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

  if (refreshRunning) {
    return NextResponse.json(
      {
        success: false,
        error:
          "CUSTOMER_INTELLIGENCE_REFRESH_RUNNING",
        message:
          "Customer intelligence refresh is already running.",
        containsPersonalData:
          false,
      },
      {
        status: 409,
      },
    );
  }

  refreshRunning = true;
  const startedAt = new Date();

  try {
    const places =
      await enrichFrequentPlaceCategories({
        limit: 250,
        minimumUses: 5,
      });

    const customerTags =
      await syncCustomerBehaviourTags();

    const finishedAt = new Date();

    return NextResponse.json({
      success: true,
      status:
        customerTags.failedCustomers > 0 ||
        places.failed > 0
          ? "PARTIAL"
          : "SUCCESS",
      startedAt,
      finishedAt,
      durationMs:
        finishedAt.getTime() -
        startedAt.getTime(),
      places,
      customerTags,
      containsPersonalData:
        false,
    });
  } catch (error) {
    console.error(
      "Scheduled customer intelligence refresh failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "CUSTOMER_INTELLIGENCE_REFRESH_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Customer intelligence refresh failed.",
        containsPersonalData:
          false,
      },
      {
        status: 500,
      },
    );
  } finally {
    refreshRunning = false;
  }
}
