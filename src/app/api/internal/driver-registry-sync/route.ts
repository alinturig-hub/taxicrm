import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  syncAutocabDrivers,
} from "@/lib/integrations/autocab/driver-sync/sync";

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
    secret !==
      process.env.CRON_SECRET
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const result =
      await syncAutocabDrivers(
        "SCHEDULED",
      );

    return NextResponse.json({
      success: true,
      status:
        result.status,
      startedAt:
        result.startedAt,
      finishedAt:
        result.finishedAt,
      durationMs:
        result.durationMs,
      drivers: {
        jobId:
          result.jobId,
        received:
          result.recordsReceived,
        eligible:
          result.recordsEligible,
        created:
          result.recordsCreated,
        updated:
          result.recordsUpdated,
        skipped:
          result.recordsSkipped,
        disabled:
          result.recordsDisabled,
        failed:
          result.recordsFailed,
        nextSyncAt:
          result.nextSyncAt,
      },
      containsPersonalData:
        false,
    });
  } catch (error) {
    console.error(
      "Scheduled driver registry sync failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Driver registry synchronization failed.";

    const status =
      message.includes(
        "already running",
      )
        ? 409
        : message.includes(
              "disabled",
            ) ||
            message.includes(
              "configuration",
            )
          ? 400
          : 500;

    return NextResponse.json(
      {
        success: false,
        error:
          "DRIVER_REGISTRY_SYNC_FAILED",
        message,
        containsPersonalData:
          false,
      },
      {
        status,
      },
    );
  }
}
