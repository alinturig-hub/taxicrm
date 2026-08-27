import { prisma } from "@/lib/prisma";

export const CUSTOMER_INTELLIGENCE_JOBS = {
  BOOKING_PREDICTIONS:
    "CUSTOMER_BOOKING_PREDICTIONS",
  PROFILE_SNAPSHOTS:
    "CUSTOMER_PROFILE_SNAPSHOTS",
  HISTORICAL_GEOAPIFY:
    "HISTORICAL_GEOAPIFY_BACKFILL",
} as const;

export type CustomerIntelligenceJobKey =
  typeof CUSTOMER_INTELLIGENCE_JOBS[
    keyof typeof CUSTOMER_INTELLIGENCE_JOBS
  ];

export type CustomerIntelligenceJobRun = {
  id: string;
  startedAt: Date;
};

export type CustomerIntelligenceJobSummary = {
  selected?: number;
  processed?: number;
  succeeded?: number;
  failed?: number;
  hasMore?: boolean | null;
  message?: string | null;
};

function safeCount(
  value: number | undefined,
) {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(value),
  );
}

function redactErrorMessage(
  error: unknown,
) {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown job error.";

  return message
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[REDACTED_EMAIL]",
    )
    .replace(
      /https?:\/\/[^\s]+/gi,
      "[REDACTED_URL]",
    )
    .replace(
      /\+?[0-9][0-9\s().-]{8,}[0-9]/g,
      "[REDACTED_NUMBER]",
    )
    .slice(0, 2000);
}

export async function startCustomerIntelligenceJobRun(
  jobKey: CustomerIntelligenceJobKey,
  source = "CRON",
): Promise<CustomerIntelligenceJobRun> {
  const run =
    await prisma.customerIntelligenceJobRun.create({
      data: {
        jobKey,
        source,
        status: "RUNNING",
      },
      select: {
        id: true,
        startedAt: true,
      },
    });

  return run;
}

export async function completeCustomerIntelligenceJobRun(
  run: CustomerIntelligenceJobRun,
  summary: CustomerIntelligenceJobSummary,
) {
  const finishedAt = new Date();

  return prisma.customerIntelligenceJobRun.update({
    where: {
      id: run.id,
    },
    data: {
      status:
        safeCount(summary.failed) > 0
          ? "FAILED"
          : "SUCCEEDED",
      finishedAt,
      durationMs: Math.max(
        0,
        finishedAt.getTime() -
          run.startedAt.getTime(),
      ),
      selected:
        safeCount(summary.selected),
      processed:
        safeCount(summary.processed),
      succeeded:
        safeCount(summary.succeeded),
      failed:
        safeCount(summary.failed),
      hasMore:
        summary.hasMore ?? null,
      message:
        summary.message?.slice(0, 1000) ??
        null,
      error:
        safeCount(summary.failed) > 0
          ? "One or more records failed."
          : null,
    },
  });
}

export async function failCustomerIntelligenceJobRun(
  run: CustomerIntelligenceJobRun,
  error: unknown,
) {
  const finishedAt = new Date();

  try {
    await prisma.customerIntelligenceJobRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: "FAILED",
        finishedAt,
        durationMs: Math.max(
          0,
          finishedAt.getTime() -
            run.startedAt.getTime(),
        ),
        failed: 1,
        error:
          redactErrorMessage(error),
      },
    });
  } catch (trackingError) {
    console.error(
      "Customer intelligence job failure could not be recorded:",
      trackingError,
    );
  }
}
