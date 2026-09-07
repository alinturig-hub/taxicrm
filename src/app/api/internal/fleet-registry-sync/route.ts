import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  syncGenericApiEndpoint,
} from "@/lib/integrations/autocab/generic-api-sync/sync";
import {
  syncAutocabVehicles,
} from "@/lib/integrations/autocab/vehicle-sync/sync";
import { prisma } from "@/lib/prisma";

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

  const startedAt = new Date();

  try {
    const capabilityEndpoint =
      await prisma
        .apiEndpointConfiguration
        .findFirst({
          where: {
            name: "Capabilities",
            isEnabled: true,
            storeRecords: true,
          },
          select: {
            id: true,
          },
        });

    if (!capabilityEndpoint) {
      throw new Error(
        "Enabled Capabilities endpoint with record storage was not found.",
      );
    }

    const capabilities =
      await syncGenericApiEndpoint(
        capabilityEndpoint.id,
      );

    const vehicles =
      await syncAutocabVehicles(
        "SCHEDULED",
      );

    const finishedAt = new Date();

    return NextResponse.json({
      success: true,
      status:
        capabilities.failed > 0 ||
        vehicles.status !== "SUCCESS"
          ? "PARTIAL"
          : "SUCCESS",
      startedAt,
      finishedAt,
      durationMs:
        finishedAt.getTime() -
        startedAt.getTime(),
      capabilities: {
        received:
          capabilities.received,
        eligible:
          capabilities.eligible,
        created:
          capabilities.created,
        updated:
          capabilities.updated,
        disabled:
          capabilities.disabled,
        failed:
          capabilities.failed,
      },
      vehicles: {
        jobId:
          vehicles.jobId,
        status:
          vehicles.status,
        received:
          vehicles.recordsReceived,
        eligible:
          vehicles.recordsEligible,
        created:
          vehicles.recordsCreated,
        updated:
          vehicles.recordsUpdated,
        skipped:
          vehicles.recordsSkipped,
        disabled:
          vehicles.recordsDisabled,
        failed:
          vehicles.recordsFailed,
        nextSyncAt:
          vehicles.nextSyncAt,
      },
      containsPersonalData: false,
    });
  } catch (error) {
    console.error(
      "Scheduled fleet registry sync failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "FLEET_REGISTRY_SYNC_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Fleet registry synchronization failed.",
        containsPersonalData: false,
      },
      {
        status: 500,
      },
    );
  }
}
