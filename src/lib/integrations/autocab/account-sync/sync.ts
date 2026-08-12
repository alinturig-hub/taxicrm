import { getAutocabCustomers } from "@/lib/autocab/rest-client";
import { getAutocabApiCredentials } from "@/lib/integrations/autocab/configuration";
import { prisma } from "@/lib/prisma";

import { mapAutocabAccount } from "./mapper";
import type {
  AccountSyncResult,
  AutocabAccountRecord,
} from "./types";

const PROVIDER = "AUTOCAB";

function isAccountRecord(
  value: unknown,
): value is AutocabAccountRecord {
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

export async function syncAutocabAccounts(
  source = "MANUAL",
): Promise<AccountSyncResult> {
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
        entity: "ACCOUNTS",
        status: "RUNNING",
      },
      orderBy: {
        startedAt: "desc",
      },
    });

  if (runningJob) {
    throw new Error(
      "An account synchronisation is already running.",
    );
  }

  const job =
    await prisma.integrationSyncJob.create({
      data: {
        provider: PROVIDER,
        entity: "ACCOUNTS",
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

    const response = await getAutocabCustomers({
      baseUrl: credentials.baseUrl,
      apiKey: credentials.apiKey,
      timeoutMs: 30000,
    });

    const allAccounts =
      response.filter(isAccountRecord);

    recordsReceived = response.length;

    const eligibleAccounts =
      allAccounts.filter(
        (account) =>
          account.active !== false &&
          account.accountCode !== null &&
          account.accountCode !== undefined &&
          String(account.accountCode).trim().length > 0,
      );

    recordsEligible = eligibleAccounts.length;

    const existingAccounts =
      await prisma.autocabAccount.findMany({
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
      existingAccounts.map((account) => [
        account.externalId,
        account,
      ]),
    );

    const syncedAt = new Date();

    for (const account of eligibleAccounts) {
      const externalId = String(account.id);
      const existing =
        existingByExternalId.get(externalId);

      try {
        const data =
          mapAutocabAccount(
            account,
            syncedAt,
          );

        if (!existing) {
          await prisma.autocabAccount.create({
            data,
          });

          recordsCreated += 1;
          continue;
        }

        await prisma.autocabAccount.update({
          where: {
            id: existing.id,
          },
          data,
        });

        recordsUpdated += 1;
      } catch (error) {
        recordsFailed += 1;

        console.error(
          `Account sync failed for Autocab account ${externalId}:`,
          error,
        );
      }
    }

    const activeExternalIds =
      allAccounts
        .filter(
          (account) => account.active !== false,
        )
        .map((account) =>
          String(account.id),
        );

    const accountsToDisable =
      await prisma.autocabAccount.count({
        where: {
          provider: PROVIDER,
          active: true,
          externalId: {
            notIn: activeExternalIds,
          },
        },
      });

    if (accountsToDisable > 0) {
      await prisma.autocabAccount.updateMany({
        where: {
          provider: PROVIDER,
          active: true,
          externalId: {
            notIn: activeExternalIds,
          },
        },
        data: {
          active: false,
        },
      });

      recordsDisabled = accountsToDisable;
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
            : "Account synchronization failed.",
      },
    });

    throw error;
  }
}
