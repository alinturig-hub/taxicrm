import { getAutocabVehicles } from "@/lib/autocab/rest-client";
import { getAutocabApiCredentials } from "@/lib/integrations/autocab/configuration";
import { prisma } from "@/lib/prisma";

import { mapAutocabVehicle } from "./mapper";
import type {
  AutocabVehicleRecord,
  VehicleSyncResult,
} from "./types";

const PROVIDER = "AUTOCAB";

function isVehicleRecord(
  value: unknown,
): value is AutocabVehicleRecord {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate = value as {
    id?: unknown;
  };

  return (
    typeof candidate.id === "number" &&
    Number.isFinite(candidate.id)
  );
}

function calculateNextSyncAt(from: Date) {
  return new Date(
    from.getTime() + 24 * 60 * 60 * 1000,
  );
}

export async function syncAutocabVehicles(
  source = "MANUAL",
): Promise<VehicleSyncResult> {
  const startedAt = new Date();
  const startedTime = Date.now();

  const configuration =
    await prisma.autocabApiConfiguration.findUnique({
      where: {
        provider: PROVIDER,
      },
    });

  if (!configuration) {
    throw new Error(
      "Autocab API configuration does not exist.",
    );
  }

  if (!configuration.isEnabled) {
    throw new Error(
      "Autocab REST integration is disabled.",
    );
  }

  const runningJob =
    await prisma.integrationSyncJob.findFirst({
      where: {
        provider: PROVIDER,
        entity: "VEHICLES",
        status: "RUNNING",
      },
      orderBy: {
        startedAt: "desc",
      },
    });

  if (runningJob) {
    throw new Error(
      "A vehicle synchronisation is already running.",
    );
  }

  const job =
    await prisma.integrationSyncJob.create({
      data: {
        provider: PROVIDER,
        entity: "VEHICLES",
        status: "RUNNING",
        source,
      },
    });

  let recordsReceived = 0;
  let recordsEligible = 0;
  let recordsCreated = 0;
  let recordsUpdated = 0;
  const recordsSkipped = 0;
  let recordsDisabled = 0;
  let recordsFailed = 0;

  try {
    const credentials =
      await getAutocabApiCredentials();

    const response = await getAutocabVehicles({
      baseUrl: credentials.baseUrl,
      apiKey: credentials.apiKey,
      timeoutMs: 30000,
    });

    const allVehicles =
      response.filter(isVehicleRecord);

    recordsReceived = response.length;

    const eligibleVehicles =
      allVehicles.filter(
        (vehicle) => vehicle.isActive !== false,
      );

    recordsEligible = eligibleVehicles.length;

    const existingVehicles =
      await prisma.vehicle.findMany({
        where: {
          provider: PROVIDER,
        },
        select: {
          id: true,
          externalId: true,
          isActive: true,
        },
      });

    const existingByExternalId = new Map(
      existingVehicles.map((vehicle) => [
        vehicle.externalId,
        vehicle,
      ]),
    );

    for (const vehicle of eligibleVehicles) {
      const externalId = String(vehicle.id);
      const existing =
        existingByExternalId.get(externalId);

      try {
        const data =
          mapAutocabVehicle(vehicle);

        if (!existing) {
          await prisma.vehicle.create({
            data,
          });

          recordsCreated += 1;
          continue;
        }

        await prisma.vehicle.update({
          where: {
            id: existing.id,
          },
          data,
        });

        recordsUpdated += 1;
      } catch (error) {
        recordsFailed += 1;

        console.error(
          `Vehicle sync failed for Autocab vehicle ${externalId}:`,
          error,
        );
      }
    }

    const activeExternalIds =
      allVehicles
        .filter(
          (vehicle) =>
            vehicle.isActive !== false,
        )
        .map((vehicle) =>
          String(vehicle.id),
        );

    const vehiclesToDisable =
      await prisma.vehicle.count({
        where: {
          provider: PROVIDER,
          isActive: true,
          externalId: {
            notIn: activeExternalIds,
          },
        },
      });

    if (vehiclesToDisable > 0) {
      await prisma.vehicle.updateMany({
        where: {
          provider: PROVIDER,
          isActive: true,
          externalId: {
            notIn: activeExternalIds,
          },
        },
        data: {
          isActive: false,
        },
      });

      recordsDisabled = vehiclesToDisable;
    }

    const finishedAt = new Date();
    const durationMs =
      Date.now() - startedTime;

    const nextSyncAt =
      calculateNextSyncAt(finishedAt);

    const status =
      recordsFailed > 0
        ? "PARTIAL"
        : "SUCCESS";

    const message = [
      `${recordsReceived} received`,
      `${recordsCreated} created`,
      `${recordsUpdated} updated`,
      `${recordsSkipped} skipped`,
      `${recordsDisabled} disabled`,
      `${recordsFailed} failed`,
    ].join(", ");

    await prisma.integrationSyncJob.update({
      where: {
        id: job.id,
      },
      data: {
        status,
        finishedAt,
        durationMs,
        recordsReceived,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        recordsDisabled,
        recordsFailed,
        message,
        metadata: {
          recordsEligible,
          activeOnly: true,
        },
      },
    });

    return {
      jobId: job.id,
      status,
      startedAt,
      finishedAt,
      durationMs,
      recordsReceived,
      recordsEligible,
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
      recordsDisabled,
      recordsFailed,
      nextSyncAt,
      message,
    };
  } catch (error) {
    const finishedAt = new Date();

    await prisma.integrationSyncJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs:
          Date.now() - startedTime,
        error:
          error instanceof Error
            ? error.message
            : "Vehicle synchronization failed.",
      },
    });

    throw error;
  }
}
