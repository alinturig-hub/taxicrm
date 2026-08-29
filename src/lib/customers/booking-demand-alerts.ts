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

  for (const forecast of evaluatedForecasts) {
    const actual =
      forecast.actualCount;

    if (actual === null) {
      continue;
    }

    const outsideRange =
      actual < forecast.lowerBound ||
      actual > forecast.upperBound;

    const rangeAlertKey =
      `BOOKING_DEMAND:ACTUAL_OUTSIDE_RANGE:${forecast.id}`;

    if (outsideRange) {
      await openAlert(
        {
          alertKey:
            rangeAlertKey,
          type:
            "ACTUAL_OUTSIDE_RANGE",
          severity: "WARNING",
          forecastId: forecast.id,
          message:
            "Verified booking demand finished outside the forecast range.",
          evidence: {
            predictedCount:
              forecast.predictedCount,
            lowerBound:
              forecast.lowerBound,
            upperBound:
              forecast.upperBound,
            actualCount: actual,
            absoluteError:
              forecast.absoluteError,
            percentageError:
              forecast.percentageError ===
                null
                ? null
                : Number(
                    forecast
                      .percentageError,
                  ),
            evaluatedAt:
              forecast.evaluatedAt
                ?.toISOString() ??
              null,
          },
        },
        now,
      );
      opened += 1;
    } else {
      resolved +=
        await resolveAlert(
          rangeAlertKey,
          now,
        );
    }

    const errorPercent =
      forecast.percentageError === null
        ? null
        : Number(
            forecast.percentageError,
          );

    const errorAlertKey =
      `BOOKING_DEMAND:LIVE_ERROR_ABOVE_20_PERCENT:${forecast.id}`;

    if (
      errorPercent !== null &&
      errorPercent >
        HIGH_ERROR_PERCENT
    ) {
      await openAlert(
        {
          alertKey:
            errorAlertKey,
          type:
            "LIVE_ERROR_ABOVE_20_PERCENT",
          severity: "WARNING",
          forecastId: forecast.id,
          message:
            "Verified live booking-demand error exceeded 20 percent.",
          evidence: {
            predictedCount:
              forecast.predictedCount,
            actualCount: actual,
            absoluteError:
              forecast.absoluteError,
            percentageError:
              errorPercent,
            thresholdPercent:
              HIGH_ERROR_PERCENT,
          },
        },
        now,
      );
      opened += 1;
    } else {
      resolved +=
        await resolveAlert(
          errorAlertKey,
          now,
        );
    }
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
