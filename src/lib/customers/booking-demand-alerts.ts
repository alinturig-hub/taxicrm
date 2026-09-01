import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

const MODEL_VERSION =
  "BOOKING_DEMAND_V1";
const JOB_KEY =
  "BOOKING_DEMAND_FORECAST";
const STALE_AFTER_MINUTES = 210;
const HIGH_ERROR_PERCENT = 20;

type AlertInput = {
  alertKey: string;
  type: string;
  severity: "WARNING" | "CRITICAL";
  forecastId?: string | null;
  message: string;
  evidence: Prisma.InputJsonValue;
};

async function openAlert(
  input: AlertInput,
  now: Date,
) {
  return prisma.bookingDemandAlert.upsert({
    where: {
      alertKey: input.alertKey,
    },
    create: {
      alertKey: input.alertKey,
      type: input.type,
      severity: input.severity,
      status: "OPEN",
      forecastId:
        input.forecastId ?? null,
      message: input.message,
      evidence: input.evidence,
      detectedAt: now,
      lastSeenAt: now,
      resolvedAt: null,
    },
    update: {
      severity: input.severity,
      status: "OPEN",
      forecastId:
        input.forecastId ?? null,
      message: input.message,
      evidence: input.evidence,
      lastSeenAt: now,
      resolvedAt: null,
    },
  });
}

async function resolveAlert(
  alertKey: string,
  now: Date,
) {
  const result =
    await prisma.bookingDemandAlert.updateMany({
      where: {
        alertKey,
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
        lastSeenAt: now,
      },
    });

  return result.count;
}

function slotTotal(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.reduce<number>(
    (total, rawSlot) => {
      if (
        typeof rawSlot !== "object" ||
        rawSlot === null ||
        !(
          "predictedCount" in rawSlot
        )
      ) {
        return total;
      }

      const count = Number(
        rawSlot.predictedCount,
      );

      return total +
        (Number.isFinite(count)
          ? count
          : 0);
    },
    0,
  );
}

export async function evaluateBookingDemandAlerts({
  now = new Date(),
}: {
  now?: Date;
} = {}) {
  const staleBoundary =
    new Date(
      now.getTime() -
        STALE_AFTER_MINUTES *
          60 *
          1000,
    );

  const [
    recentRun,
    activeForecasts,
    evaluatedForecasts,
  ] = await Promise.all([
    prisma.customerIntelligenceJobRun.findFirst({
      where: {
        jobKey: JOB_KEY,
        status: {
          in: [
            "RUNNING",
            "SUCCEEDED",
          ],
        },
        startedAt: {
          gte: staleBoundary,
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
      },
    }),

    prisma.bookingDemandForecast.findMany({
      where: {
        modelVersion:
          MODEL_VERSION,
        status: "PENDING",
        windowEndAt: {
          gt: now,
        },
        forecastKey: {
          not: {
            contains:
              "HISTORICAL_BACKTEST",
          },
        },
      },
      select: {
        id: true,
        predictedCount: true,
        slotForecasts: true,
      },
    }),

    prisma.bookingDemandForecast.findMany({
      where: {
        modelVersion:
          MODEL_VERSION,
        status: {
          not: "PENDING",
        },
        actualCount: {
          not: null,
        },
        forecastKey: {
          not: {
            contains:
              "HISTORICAL_BACKTEST",
          },
        },
      },
      orderBy: {
        evaluatedAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        predictedCount: true,
        lowerBound: true,
        upperBound: true,
        actualCount: true,
        absoluteError: true,
        percentageError: true,
        evaluatedAt: true,
      },
    }),
  ]);

  let opened = 0;
  let resolved = 0;

  const notRunningKey =
    "BOOKING_DEMAND:FORECAST_NOT_RUNNING";

  if (!recentRun) {
    await openAlert(
      {
        alertKey: notRunningKey,
        type:
          "FORECAST_NOT_RUNNING",
        severity: "CRITICAL",
        message:
          "Booking-demand forecasting has not completed or started within the expected interval.",
        evidence: {
          staleAfterMinutes:
            STALE_AFTER_MINUTES,
          checkedAt:
            now.toISOString(),
        },
      },
      now,
    );
    opened += 1;
  } else {
    resolved +=
      await resolveAlert(
        notRunningKey,
        now,
      );
  }

  for (const forecast of activeForecasts) {
    const total =
      slotTotal(
        forecast.slotForecasts,
      );
    const alertKey =
      `BOOKING_DEMAND:SLOT_TOTAL_MISMATCH:${forecast.id}`;

    if (
      total === null ||
      total !== forecast.predictedCount
    ) {
      await openAlert(
        {
          alertKey,
          type:
            "SLOT_TOTAL_MISMATCH",
          severity: "CRITICAL",
          forecastId: forecast.id,
          message:
            "Three-hour forecast totals do not match the central booking-demand estimate.",
          evidence: {
            predictedCount:
              forecast.predictedCount,
            slotTotal: total,
          },
        },
        now,
      );
      opened += 1;
    } else {
      resolved +=
        await resolveAlert(
          alertKey,
          now,
        );
    }
  }

  const legacyAlerts =
    await prisma.bookingDemandAlert.updateMany({
      where: {
        status: "OPEN",
        type: {
          in: [
            "ACTUAL_OUTSIDE_RANGE",
            "LIVE_ERROR_ABOVE_20_PERCENT",
          ],
        },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
        lastSeenAt: now,
      },
    });

  resolved += legacyAlerts.count;

  const accuracyAlertKey =
    "BOOKING_DEMAND:FORECAST_ACCURACY";
  const latestEvaluated =
    evaluatedForecasts[0] ?? null;

  if (
    latestEvaluated?.actualCount !==
    null &&
    latestEvaluated !== null
  ) {
    const actual =
      latestEvaluated.actualCount;

    const outsideRange =
      actual <
        latestEvaluated.lowerBound ||
      actual >
        latestEvaluated.upperBound;

    const errorPercent =
      latestEvaluated
        .percentageError === null
        ? null
        : Number(
            latestEvaluated
              .percentageError,
          );

    const highError =
      errorPercent !== null &&
      errorPercent >
        HIGH_ERROR_PERCENT;

    const reasons = [
      ...(outsideRange
        ? [
            "ACTUAL_OUTSIDE_RANGE",
          ]
        : []),
      ...(highError
        ? [
            "LIVE_ERROR_ABOVE_20_PERCENT",
          ]
        : []),
    ];

    if (reasons.length > 0) {
      const difference =
        actual -
        latestEvaluated
          .predictedCount;

      await openAlert(
        {
          alertKey:
            accuracyAlertKey,
          type:
            "FORECAST_ACCURACY_WARNING",
          severity:
            "WARNING",
          forecastId:
            latestEvaluated.id,
          message:
            difference < 0
              ? "The latest verified booking-demand forecast overestimated actual demand."
              : "The latest verified booking-demand forecast underestimated actual demand.",
          evidence: {
            predictedCount:
              latestEvaluated
                .predictedCount,
            lowerBound:
              latestEvaluated
                .lowerBound,
            upperBound:
              latestEvaluated
                .upperBound,
            actualCount:
              actual,
            difference,
            absoluteError:
              latestEvaluated
                .absoluteError,
            percentageError:
              errorPercent,
            thresholdPercent:
              HIGH_ERROR_PERCENT,
            reasons,
            direction:
              difference < 0
                ? "OVERESTIMATED"
                : "UNDERESTIMATED",
            evaluatedAt:
              latestEvaluated
                .evaluatedAt
                ?.toISOString() ??
              null,
            containsPersonalData:
              false,
          },
        },
        now,
      );

      opened += 1;
    } else {
      resolved +=
        await resolveAlert(
          accuracyAlertKey,
          now,
        );
    }
  } else {
    resolved +=
      await resolveAlert(
        accuracyAlertKey,
        now,
      );
  }

  const openAlerts =
    await prisma.bookingDemandAlert.count({
      where: {
        status: "OPEN",
      },
    });

  return {
    success: true,
    checkedAt: now,
    staleAfterMinutes:
      STALE_AFTER_MINUTES,
    activeForecasts:
      activeForecasts.length,
    evaluatedLiveForecasts:
      evaluatedForecasts.length,
    opened,
    resolved,
    openAlerts,
    containsPersonalData: false,
  };
}
