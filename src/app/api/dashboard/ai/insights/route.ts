import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import {
  ADMINISTRATION_PERMISSIONS,
  requireAdministrationPermission,
} from "@/lib/administration-access";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAY_MS = 24 * 60 * 60 * 1000;
const PREDICTION_MODEL =
  "HAZARD_SLOT_V1";
const DEMAND_MODEL =
  "BOOKING_DEMAND_V1";

type DemandSlot = {
  startAt: string;
  endAt: string;
  predictedCount: number;
};

function percentage(
  value: number,
  total: number,
) {
  return total > 0
    ? Number(
        (
          100 *
          value /
          total
        ).toFixed(1),
      )
    : null;
}

function average(
  values: number[],
) {
  return values.length > 0
    ? Number(
        (
          values.reduce(
            (total, value) =>
              total + value,
            0,
          ) /
          values.length
        ).toFixed(1),
      )
    : null;
}

function demandSource(
  methodology: unknown,
) {
  if (
    methodology !== null &&
    typeof methodology === "object" &&
    !Array.isArray(methodology) &&
    "source" in methodology &&
    methodology.source ===
      "HISTORICAL_BACKTEST"
  ) {
    return "HISTORICAL_BACKTEST";
  }

  return "LIVE_VERIFIED";
}

function demandSlots(
  value: unknown,
): DemandSlot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      item === null ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      !("startAt" in item) ||
      !("endAt" in item) ||
      !("predictedCount" in item) ||
      typeof item.startAt !== "string" ||
      typeof item.endAt !== "string" ||
      typeof item.predictedCount !==
        "number"
    ) {
      return [];
    }

    return [
      {
        startAt: item.startAt,
        endAt: item.endAt,
        predictedCount:
          item.predictedCount,
      },
    ];
  });
}

export async function GET() {
  const session =
    await getServerSession(authOptions);

  if (!session?.user) {
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

  const access =
    await requireAdministrationPermission(
      session.user.email,
      ADMINISTRATION_PERMISSIONS
        .INTELLIGENCE_VIEW,
    );

  if (!access) {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const now = new Date();
    const periodStart = new Date(
      now.getTime() -
        14 * DAY_MS,
    );

    const [
      activeForecast,
      evaluatedForecasts,
      predictionOutcomes,
      openAlerts,
    ] = await Promise.all([
      prisma.bookingDemandForecast.findFirst({
        where: {
          modelVersion:
            DEMAND_MODEL,
          targetType:
            "BOOKING_REQUESTS",
          status: "PENDING",
          windowEndAt: {
            gt: now,
          },
        },
        orderBy: {
          issuedAt: "desc",
        },
      }),

      prisma.bookingDemandForecast.findMany({
        where: {
          modelVersion:
            DEMAND_MODEL,
          targetType:
            "BOOKING_REQUESTS",
          status: "EVALUATED",
        },
        orderBy: {
          windowEndAt: "desc",
        },
        take: 60,
        select: {
          id: true,
          methodology: true,
          predictedCount: true,
          actualCount: true,
          percentageError: true,
          lowerBound: true,
          upperBound: true,
          windowStartAt: true,
          windowEndAt: true,
        },
      }),

      prisma.customerBookingPrediction.findMany({
        where: {
          modelVersion:
            PREDICTION_MODEL,
          horizonHours: 24,
          issuedAt: {
            gte: periodStart,
          },
          status: {
            in: [
              "HIT",
              "MISSED",
            ],
          },
        },
        select: {
          status: true,
          level: true,
          likelyWindowStartAt: true,
          likelyWindowEndAt: true,
          likelyWindowHit: true,
        },
      }),

      prisma.bookingDemandAlert.findMany({
        where: {
          status: "OPEN",
        },
        orderBy: [
          {
            severity: "asc",
          },
          {
            detectedAt: "desc",
          },
        ],
        take: 20,
        select: {
          id: true,
          type: true,
          severity: true,
          forecastId: true,
          evidence: true,
          message: true,
          detectedAt: true,
          lastSeenAt: true,
        },
      }),
    ]);

    const observedSoFar =
      activeForecast
        ? await prisma.booking.count({
            where: {
              bookedAtTime: {
                gte:
                  activeForecast
                    .windowStartAt,
                lt: new Date(
                  Math.min(
                    now.getTime(),
                    activeForecast
                      .windowEndAt
                      .getTime(),
                  ),
                ),
              },
            },
          })
        : 0;

    const slots = demandSlots(
      activeForecast?.slotForecasts,
    );

    const peakSlot =
      [...slots].sort(
        (first, second) =>
          second.predictedCount -
          first.predictedCount,
      )[0] ?? null;

    const liveVerified =
      evaluatedForecasts.filter(
        (forecast) =>
          demandSource(
            forecast.methodology,
          ) === "LIVE_VERIFIED",
      );

    const historicalBacktests =
      evaluatedForecasts.filter(
        (forecast) =>
          demandSource(
            forecast.methodology,
          ) ===
          "HISTORICAL_BACKTEST",
      );

    const liveErrors =
      liveVerified.flatMap(
        (forecast) =>
          forecast.percentageError ===
          null
            ? []
            : [
                Number(
                  forecast
                    .percentageError,
                ),
              ],
      );

    const backtestErrors =
      historicalBacktests.flatMap(
        (forecast) =>
          forecast.percentageError ===
          null
            ? []
            : [
                Number(
                  forecast
                    .percentageError,
                ),
              ],
      );

    const liveInsideRange =
      liveVerified.filter(
        (forecast) =>
          forecast.actualCount !==
            null &&
          forecast.actualCount >=
            forecast.lowerBound &&
          forecast.actualCount <=
            forecast.upperBound,
      ).length;

    const backtestInsideRange =
      historicalBacktests.filter(
        (forecast) =>
          forecast.actualCount !==
            null &&
          forecast.actualCount >=
            forecast.lowerBound &&
          forecast.actualCount <=
            forecast.upperBound,
      ).length;

    const predictionHits =
      predictionOutcomes.filter(
        (prediction) =>
          prediction.status === "HIT",
      );

    const slotEvaluated =
      predictionOutcomes.filter(
        (prediction) =>
          prediction
            .likelyWindowStartAt !==
            null &&
          prediction
            .likelyWindowEndAt !==
            null,
      );

    const slotHits =
      slotEvaluated.filter(
        (prediction) =>
          prediction.status ===
            "HIT" &&
          prediction
            .likelyWindowHit === true,
      );

    const levels = [
      "HIGH",
      "ELEVATED",
      "MODERATE",
      "LOW",
    ].map((level) => {
      const evaluated =
        predictionOutcomes.filter(
          (prediction) =>
            prediction.level === level,
        );
      const hits =
        evaluated.filter(
          (prediction) =>
            prediction.status ===
              "HIT",
        );

      return {
        level,
        evaluated:
          evaluated.length,
        hits: hits.length,
        hitRate: percentage(
          hits.length,
          evaluated.length,
        ),
      };
    });

    const rankedLevels =
      levels
        .filter(
          (level) =>
            level.evaluated >= 20 &&
            level.hitRate !== null,
        )
        .sort(
          (first, second) =>
            (
              second.hitRate ?? 0
            ) -
            (
              first.hitRate ?? 0
            ),
        );

    const strongestLevel =
      rankedLevels[0] ?? null;
    const weakestLevel =
      rankedLevels.at(-1) ?? null;

    return NextResponse.json({
      success: true,
      generatedAt: now,
      periodDays: 14,
      overview: {
        state:
          openAlerts.length > 0
            ? "ATTENTION"
            : "STABLE",
        activeInsights:
          4 +
          (
            openAlerts.length > 0
              ? 1
              : 0
          ),
        openAlerts:
          openAlerts.length,
      },
      demand: activeForecast
        ? {
            forecastId:
              activeForecast.id,
            windowStartAt:
              activeForecast
                .windowStartAt,
            windowEndAt:
              activeForecast
                .windowEndAt,
            predictedBookings:
              activeForecast
                .predictedCount,
            lowerBound:
              activeForecast
                .lowerBound,
            upperBound:
              activeForecast
                .upperBound,
            observedSoFar,
            progressPercent:
              Math.min(
                100,
                Math.max(
                  0,
                  Number(
                    (
                      100 *
                      (
                        now.getTime() -
                        activeForecast
                          .windowStartAt
                          .getTime()
                      ) /
                      (
                        activeForecast
                          .windowEndAt
                          .getTime() -
                        activeForecast
                          .windowStartAt
                          .getTime()
                      )
                    ).toFixed(1),
                  ),
                ),
              ),
            peakSlot,
            slotTotal:
              slots.reduce(
                (total, slot) =>
                  total +
                  slot.predictedCount,
                0,
              ),
            totalsMatch:
              slots.reduce(
                (total, slot) =>
                  total +
                  slot.predictedCount,
                0,
              ) ===
              activeForecast
                .predictedCount,
          }
        : null,
      forecastEvidence: {
        live: {
          evaluated:
            liveVerified.length,
          averageErrorPercent:
            average(liveErrors),
          insideRange:
            liveInsideRange,
          rangeCoveragePercent:
            percentage(
              liveInsideRange,
              liveVerified.length,
            ),
          confidence:
            liveVerified.length >= 7
              ? "MEASURED"
              : "LEARNING",
        },
        backtest: {
          evaluated:
            historicalBacktests.length,
          averageErrorPercent:
            average(backtestErrors),
          insideRange:
            backtestInsideRange,
          rangeCoveragePercent:
            percentage(
              backtestInsideRange,
              historicalBacktests.length,
            ),
        },
      },
      customerPredictionEvidence: {
        evaluated:
          predictionOutcomes.length,
        hits:
          predictionHits.length,
        hitRate: percentage(
          predictionHits.length,
          predictionOutcomes.length,
        ),
        slotEvaluated:
          slotEvaluated.length,
        slotHits:
          slotHits.length,
        slotHitRate: percentage(
          slotHits.length,
          slotEvaluated.length,
        ),
        strongestLevel,
        weakestLevel,
      },
      alerts: openAlerts,
      privacy: {
        aggregateOnly: true,
        containsCustomerIdentity: false,
        containsContactDetails: false,
        containsRoutes: false,
        containsProtectedPlaces: false,
      },
    });
  } catch (error) {
    console.error(
      "AI insights dashboard failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "AI_INSIGHTS_DASHBOARD_FAILED",
        message:
          "AI insights could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}
