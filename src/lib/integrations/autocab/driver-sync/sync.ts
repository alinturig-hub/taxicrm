import { getAutocabDrivers } from "@/lib/autocab/rest-client";
import { getAutocabApiCredentials } from "@/lib/integrations/autocab/configuration";
import { prisma } from "@/lib/prisma";

import { mapAutocabDriver } from "./mapper";
import type {
  AutocabDriverRecord,
  DriverSyncResult,
  DriverSyncSource,
} from "./types";

const PROVIDER = "AUTOCAB";

function calculateNextSyncAt(
  from: Date,
  intervalMinutes: number,
) {
  return new Date(
    from.getTime() +
      Math.max(5, intervalMinutes) *
        60 *
        1000,
  );
}

function isAutocabDriverRecord(
  value: unknown,
): value is AutocabDriverRecord {
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

export async function syncAutocabDrivers(
  source: DriverSyncSource = "MANUAL",
): Promise<DriverSyncResult> {
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
        entity: "DRIVERS",
        status: "RUNNING",
      },
      orderBy: {
        startedAt: "desc",
      },
    });

  if (runningJob) {
    const maximumRuntimeMs =
      30 * 60 * 1000;

    const stillRunning =
      Date.now() -
        runningJob.startedAt.getTime() <
      maximumRuntimeMs;

    if (stillRunning) {
      throw new Error(
        "A driver synchronisation is already running.",
      );
    }

    await prisma.integrationSyncJob.update({
      where: {
        id: runningJob.id,
      },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error:
          "Job exceeded the maximum runtime and was closed automatically.",
      },
    });
  }

  const job =
    await prisma.integrationSyncJob.create({
      data: {
        provider: PROVIDER,
        entity: "DRIVERS",
        status: "RUNNING",
        source,
      },
    });

  let recordsReceived = 0;
  let recordsEligible = 0;
  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsSkipped = 0;
  let recordsDisabled = 0;
  let recordsFailed = 0;

  try {
    const credentials =
      await getAutocabApiCredentials();

    const response = await getAutocabDrivers({
      baseUrl: credentials.baseUrl,
      apiKey: credentials.apiKey,
      timeoutMs: 30000,
    });

    const allDrivers = response.filter(
      isAutocabDriverRecord,
    );

    recordsReceived = response.length;

    const eligibleDrivers =
      configuration.importActiveDriversOnly
        ? allDrivers.filter(
            (driver) => driver.active === true,
          )
        : allDrivers;

    recordsEligible = eligibleDrivers.length;

    const existingDrivers =
      await prisma.driver.findMany({
        where: {
          provider: PROVIDER,
        },
        select: {
          id: true,
          externalId: true,
          active: true,
        },
      });

    const existingByExternalId = new Map(
      existingDrivers.map((driver) => [
        driver.externalId,
        driver,
      ]),
    );

    const syncedAt = new Date();

    for (const driver of eligibleDrivers) {
      const externalId = String(driver.id);
      const existing =
        existingByExternalId.get(externalId);

      try {
        const data = mapAutocabDriver(
          driver,
          syncedAt,
        );

        if (!existing) {
          if (
            !configuration.createNewDrivers
          ) {
            recordsSkipped += 1;
            continue;
          }

          await prisma.driver.create({
            data,
          });

          recordsCreated += 1;
          continue;
        }

        if (
          !configuration.updateExistingDrivers
        ) {
          await prisma.driver.update({
            where: {
              id: existing.id,
            },
            data: {
              lastSeenInApiAt: syncedAt,
              lastApiSyncAt: syncedAt,
            },
          });

          recordsSkipped += 1;
          continue;
        }

        await prisma.driver.update({
          where: {
            id: existing.id,
          },
          data,
        });

        recordsUpdated += 1;
      } catch (error) {
        recordsFailed += 1;

        console.error(
          `Driver sync failed for Autocab driver ${externalId}:`,
          error,
        );
      }
    }

    if (
      configuration.markMissingDriversInactive &&
      allDrivers.length > 0
    ) {
      const activeExternalIds = allDrivers
        .filter(
          (driver) => driver.active === true,
        )
        .map((driver) => String(driver.id));

      const driversToDisable =
        await prisma.driver.count({
          where: {
            provider: PROVIDER,
            active: true,
            externalId: {
              notIn: activeExternalIds,
            },
          },
        });

      if (driversToDisable > 0) {
        const disabledAt = new Date();

        await prisma.driver.updateMany({
          where: {
            provider: PROVIDER,
            active: true,
            externalId: {
              notIn: activeExternalIds,
            },
          },
          data: {
            active: false,
            markedInactiveAt: disabledAt,
            lastApiSyncAt: disabledAt,
          },
        });

        recordsDisabled =
          driversToDisable;
      }
    }

    const finishedAt = new Date();
    const durationMs =
      Date.now() - startedTime;

    const nextSyncAt =
      calculateNextSyncAt(
        finishedAt,
        configuration.driverSyncIntervalMinutes,
      );

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

    await prisma.$transaction([
      prisma.integrationSyncJob.update({
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
            activeOnly:
              configuration.importActiveDriversOnly,
          },
        },
      }),

      prisma.autocabApiConfiguration.update({
        where: {
          provider: PROVIDER,
        },
        data: {
          lastDriverSyncAt: finishedAt,
          nextDriverSyncAt: nextSyncAt,
          lastDriverSyncStatus: status,
          lastDriverSyncMessage: message,
          lastSuccessfulSyncAt:
            status === "SUCCESS"
              ? finishedAt
              : configuration.lastSuccessfulSyncAt,
          lastError:
            status === "SUCCESS"
              ? null
              : `${recordsFailed} driver records failed.`,
        },
      }),
    ]);

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
    const durationMs =
      Date.now() - startedTime;

    const message =
      error instanceof Error
        ? error.message
        : "Unknown driver synchronisation error.";

    await prisma.$transaction([
      prisma.integrationSyncJob.update({
        where: {
          id: job.id,
        },
        data: {
          status: "FAILED",
          finishedAt,
          durationMs,
          recordsReceived,
          recordsCreated,
          recordsUpdated,
          recordsSkipped,
          recordsDisabled,
          recordsFailed,
          error: message.slice(0, 5000),
        },
      }),

      prisma.autocabApiConfiguration.update({
        where: {
          provider: PROVIDER,
        },
        data: {
          lastDriverSyncAt: finishedAt,
          lastDriverSyncStatus: "FAILED",
          lastDriverSyncMessage: message,
          lastError: message.slice(0, 5000),
        },
      }),
    ]);

    throw error;
  }
}
