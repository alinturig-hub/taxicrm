import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { CUSTOMER_INTELLIGENCE_JOBS } from "@/lib/customers/customer-intelligence-job-runs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODEL_VERSION = "HAZARD_SLOT_V1";
const HORIZON_HOURS = 24;
const PREDICTION_STALE_MINUTES = 30;
const DEMAND_FORECAST_STALE_MINUTES = 210;
const DEMAND_MODEL_VERSION =
  "BOOKING_DEMAND_V1";
const GEOAPIFY_BACKFILL_CEILING = 2000;

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

function londonDateKey(value: Date) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(value);
}

function londonHour(value: Date) {
  return Number(
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Europe/London",
        hour: "2-digit",
        hour12: false,
      },
    ).format(value),
  );
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

  try {
    const now = new Date();
    const todayKey = londonDateKey(now);
    const todayDate =
      new Date(`${todayKey}T00:00:00.000Z`);
    const accuracyStart = new Date(
      now.getTime() -
        14 * 24 * 60 * 60 * 1000,
    );

    const historicalBookingFilter = {
      OR: [
        {
          pickupDueTime: {
            lte: now,
          },
        },
        {
          pickupDueTime: null,
          bookedAtTime: {
            lte: now,
          },
        },
      ],
    };

    const [
      intelligenceStateGroups,
      latestIntelligence,
      predictionStatusGroups,
      latestPrediction,
      resolvedPredictions,
      todaySnapshots,
      latestSnapshot,
      eligibleSnapshotCustomers,
      historicalLocations,
      waitingHistoricalLocations,
      readyHistoricalLocations,
      protectedHistoricalLocations,
      geoapify,
      recentJobRuns,
    ] = await Promise.all([
      prisma.customerIntelligenceState.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),

      prisma.customerIntelligenceState.aggregate({
        _max: {
          lastCalculatedAt: true,
        },
      }),

      prisma.customerBookingPrediction.groupBy({
        by: ["status"],
        where: {
          modelVersion: MODEL_VERSION,
          horizonHours: HORIZON_HOURS,
        },
        _count: {
          _all: true,
        },
      }),

      prisma.customerBookingPrediction.aggregate({
        where: {
          modelVersion: MODEL_VERSION,
          horizonHours: HORIZON_HOURS,
        },
        _max: {
          updatedAt: true,
        },
      }),

      prisma.customerBookingPrediction.findMany({
        where: {
          modelVersion: MODEL_VERSION,
          horizonHours: HORIZON_HOURS,
          issuedAt: {
            gte: accuracyStart,
          },
          status: {
            in: ["HIT", "MISSED"],
          },
        },
        select: {
          status: true,
          likelyWindowStartAt: true,
          likelyWindowEndAt: true,
          likelyWindowHit: true,
          likelyWindowDistanceMinutes: true,
        },
      }),

      prisma.customerProfileSnapshot.count({
        where: {
          snapshotDate: todayDate,
        },
      }),

      prisma.customerProfileSnapshot.aggregate({
        _max: {
          generatedAt: true,
        },
      }),

      prisma.normalCustomer.count({
        where: {
          lastBookingAt: {
            gte: new Date(
              now.getTime() -
                60 * 24 * 60 * 60 * 1000,
            ),
          },
          bookings: {
            some: {},
          },
        },
      }),

      prisma.bookingLocation.count({
        where: {
          booking: historicalBookingFilter,
        },
      }),

      prisma.bookingLocation.count({
        where: {
          booking: historicalBookingFilter,
          placeIntelligenceId: null,
          latitude: {
            not: null,
          },
          longitude: {
            not: null,
          },
        },
      }),

      prisma.bookingLocation.count({
        where: {
          booking: historicalBookingFilter,
          placeIntelligence: {
            status: "READY",
          },
        },
      }),

      prisma.bookingLocation.count({
        where: {
          booking: historicalBookingFilter,
          placeIntelligence: {
            status: "READY",
            isSensitive: true,
          },
        },
      }),

      prisma.geoapifyApiConfiguration.findUnique({
        where: {
          provider: "GEOAPIFY",
        },
        select: {
          isEnabled: true,
          dailyLimit: true,
          dailyUsed: true,
          usageDate: true,
          lastSuccessfulLookupAt: true,
          lastError: true,
        },
      }),

      prisma.customerIntelligenceJobRun.findMany({
        where: {
          jobKey: {
            in: Object.values(
              CUSTOMER_INTELLIGENCE_JOBS,
            ),
          },
        },
        orderBy: {
          startedAt: "desc",
        },
        take: 30,
        select: {
          id: true,
          jobKey: true,
          status: true,
          source: true,
          startedAt: true,
          finishedAt: true,
          durationMs: true,
          selected: true,
          processed: true,
          succeeded: true,
          failed: true,
          hasMore: true,
          message: true,
          error: true,
        },
      }),
    ]);

    const [
      activeDemandForecast,
      evaluatedDemandForecasts,
    ] = await Promise.all([
      prisma.bookingDemandForecast.findFirst({
        where: {
          modelVersion:
            DEMAND_MODEL_VERSION,
          targetType:
            "BOOKING_REQUESTS",
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
        orderBy: {
          issuedAt: "desc",
        },
        select: {
          id: true,
          issuedAt: true,
          windowStartAt: true,
          windowEndAt: true,
          predictedCount: true,
          lowerBound: true,
          upperBound: true,
          calibrationDays: true,
          backtestMape: true,
          slotForecasts: true,
        },
      }),

      prisma.bookingDemandForecast.findMany({
        where: {
          modelVersion:
            DEMAND_MODEL_VERSION,
          status: {
            not: "PENDING",
          },
          actualCount: {
            not: null,
          },
        },
        select: {
          forecastKey: true,
          lowerBound: true,
          upperBound: true,
          actualCount: true,
        },
      }),
    ]);

    const observedDemandSoFar =
      activeDemandForecast
        ? await prisma.booking.count({
            where: {
              bookedAtTime: {
                gte:
                  activeDemandForecast
                    .windowStartAt,
                lte: new Date(
                  Math.min(
                    now.getTime(),
                    activeDemandForecast
                      .windowEndAt
                      .getTime(),
                  ),
                ),
              },
            },
          })
        : 0;

    const historicalDemandResults =
      evaluatedDemandForecasts.filter(
        (forecast) =>
          forecast.forecastKey.includes(
            "HISTORICAL_BACKTEST",
          ),
      );

    const liveDemandResults =
      evaluatedDemandForecasts.filter(
        (forecast) =>
          !forecast.forecastKey.includes(
            "HISTORICAL_BACKTEST",
          ),
      );

    const insideDemandRange = (
      forecast: {
        lowerBound: number;
        upperBound: number;
        actualCount: number | null;
      },
    ) =>
      forecast.actualCount !== null &&
      forecast.actualCount >=
        forecast.lowerBound &&
      forecast.actualCount <=
        forecast.upperBound;

    const historicalRangeHits =
      historicalDemandResults.filter(
        insideDemandRange,
      ).length;

    const liveRangeHits =
      liveDemandResults.filter(
        insideDemandRange,
      ).length;

    const demandSlots =
      activeDemandForecast &&
      Array.isArray(
        activeDemandForecast.slotForecasts,
      )
        ? activeDemandForecast
            .slotForecasts as Array<{
              predictedCount?: unknown;
            }>
        : [];

    const demandSlotTotal =
      demandSlots.reduce(
        (total, slot) => {
          const value = Number(
            slot.predictedCount,
          );

          return total +
            (Number.isFinite(value)
              ? value
              : 0);
        },
        0,
      );

    const demandSlotTotalsMatch =
      activeDemandForecast === null ||
      demandSlotTotal ===
        activeDemandForecast
          .predictedCount;

    const [
      openDemandAlerts,
      recentDemandAlerts,
    ] = await Promise.all([
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
        select: {
          id: true,
          alertKey: true,
          type: true,
          severity: true,
          status: true,
          forecastId: true,
          message: true,
          evidence: true,
          detectedAt: true,
          lastSeenAt: true,
          resolvedAt: true,
        },
      }),

      prisma.bookingDemandAlert.findMany({
        orderBy: {
          detectedAt: "desc",
        },
        take: 20,
        select: {
          id: true,
          alertKey: true,
          type: true,
          severity: true,
          status: true,
          forecastId: true,
          message: true,
          evidence: true,
          detectedAt: true,
          lastSeenAt: true,
          resolvedAt: true,
        },
      }),
    ]);

    const criticalDemandAlerts =
      openDemandAlerts.filter(
        (alert) =>
          alert.severity ===
          "CRITICAL",
      ).length;

    const warningDemandAlerts =
      openDemandAlerts.filter(
        (alert) =>
          alert.severity ===
          "WARNING",
      ).length;

    const latestRunByJob =
      new Map(
        Object.values(
          CUSTOMER_INTELLIGENCE_JOBS,
        ).map((jobKey) => [
          jobKey,
          recentJobRuns.find(
            (run) =>
              run.jobKey === jobKey,
          ) ?? null,
        ]),
      );

    const predictionRun =
      latestRunByJob.get(
        CUSTOMER_INTELLIGENCE_JOBS
          .BOOKING_PREDICTIONS,
      ) ?? null;

    const demandForecastRun =
      latestRunByJob.get(
        CUSTOMER_INTELLIGENCE_JOBS
          .BOOKING_DEMAND_FORECAST,
      ) ?? null;

    const snapshotRun =
      latestRunByJob.get(
        CUSTOMER_INTELLIGENCE_JOBS
          .PROFILE_SNAPSHOTS,
      ) ?? null;

    const geoapifyRun =
      latestRunByJob.get(
        CUSTOMER_INTELLIGENCE_JOBS
          .HISTORICAL_GEOAPIFY,
      ) ?? null;

    const stateCounts =
      Object.fromEntries(
        intelligenceStateGroups.map(
          (group) => [
            group.status,
            group._count._all,
          ],
        ),
      );

    const predictionCounts =
      Object.fromEntries(
        predictionStatusGroups.map(
          (group) => [
            group.status,
            group._count._all,
          ],
        ),
      );

    const resolved =
      resolvedPredictions.length;

    const hits =
      resolvedPredictions.filter(
        (prediction) =>
          prediction.status === "HIT",
      ).length;

    const slotEvaluated =
      resolvedPredictions.filter(
        (prediction) =>
          prediction.likelyWindowStartAt !==
            null &&
          prediction.likelyWindowEndAt !==
            null,
      );

    const slotHits =
      slotEvaluated.filter(
        (prediction) =>
          prediction.status === "HIT" &&
          prediction.likelyWindowHit === true,
      ).length;

    const slotMissDistances =
      resolvedPredictions
        .map(
          (prediction) =>
            prediction
              .likelyWindowDistanceMinutes,
        )
        .filter(
          (value): value is number =>
            value !== null &&
            value > 0,
        );

    const latestCalculation =
      latestIntelligence._max
        .lastCalculatedAt;

    const predictionMinutesSinceActivity =
      latestCalculation
        ? Math.round(
            (
              now.getTime() -
              latestCalculation.getTime()
            ) /
              60000,
          )
        : null;

    const predictionFailed =
      stateCounts.FAILED ?? 0;

    const predictionHealth =
      predictionFailed > 0
        ? "CRITICAL"
        : predictionMinutesSinceActivity ===
              null ||
            predictionMinutesSinceActivity >
              PREDICTION_STALE_MINUTES
          ? "WARNING"
          : "HEALTHY";

    const snapshotExpected =
      londonHour(now) >= 4;

    const snapshotHealth =
      todaySnapshots > 0
        ? "HEALTHY"
        : snapshotExpected
          ? "WARNING"
          : "WAITING";

    const geoUsageIsToday = Boolean(
      geoapify?.usageDate &&
        londonDateKey(
          geoapify.usageDate,
        ) === todayKey,
    );

    const geoDailyUsed =
      geoUsageIsToday
        ? geoapify?.dailyUsed ?? 0
        : 0;

    const geoDailyLimit =
      geoapify?.dailyLimit ?? 0;

    const geoHealth =
      !geoapify?.isEnabled
        ? "CRITICAL"
        : geoapify.lastError
          ? "WARNING"
          : geoDailyUsed >= geoDailyLimit
            ? "CRITICAL"
            : "HEALTHY";

    const predictionJobHealth =
      predictionRun?.status === "FAILED"
        ? "CRITICAL"
        : predictionRun?.status ===
              "RUNNING" &&
            now.getTime() -
              predictionRun.startedAt.getTime() >
              PREDICTION_STALE_MINUTES *
                60 *
                1000
          ? "CRITICAL"
          : predictionRun &&
              now.getTime() -
                predictionRun.startedAt.getTime() <=
                PREDICTION_STALE_MINUTES *
                  60 *
                  1000
            ? predictionHealth
            : "WARNING";

    const demandForecastMinutesSinceRun =
      demandForecastRun
        ? Math.round(
            (
              now.getTime() -
              demandForecastRun
                .startedAt
                .getTime()
            ) /
              60000,
          )
        : null;

    const demandForecastJobHealth =
      demandForecastRun?.status ===
          "FAILED" ||
        criticalDemandAlerts > 0
        ? "CRITICAL"
        : warningDemandAlerts > 0
          ? "WARNING"
        : demandForecastRun?.status ===
              "RUNNING" &&
            demandForecastMinutesSinceRun !==
              null &&
            demandForecastMinutesSinceRun >
              DEMAND_FORECAST_STALE_MINUTES
          ? "CRITICAL"
          : !activeDemandForecast ||
              !demandSlotTotalsMatch
            ? "CRITICAL"
            : demandForecastMinutesSinceRun ===
                  null ||
                demandForecastMinutesSinceRun >
                  DEMAND_FORECAST_STALE_MINUTES
              ? "WARNING"
              : "HEALTHY";

    const snapshotRunIsToday = Boolean(
      snapshotRun &&
        londonDateKey(
          snapshotRun.startedAt,
        ) === todayKey,
    );

    const snapshotJobHealth =
      snapshotRunIsToday &&
      snapshotRun?.status === "FAILED"
        ? "CRITICAL"
        : snapshotRunIsToday &&
            snapshotRun?.status ===
              "SUCCEEDED"
          ? snapshotHealth
          : snapshotExpected
            ? "WARNING"
            : "WAITING";

    const geoapifyRunIsToday = Boolean(
      geoapifyRun &&
        londonDateKey(
          geoapifyRun.startedAt,
        ) === todayKey,
    );

    const geoapifyJobHealth =
      geoapifyRunIsToday &&
      geoapifyRun?.status === "FAILED"
        ? "CRITICAL"
        : geoapifyRunIsToday &&
            geoapifyRun?.status ===
              "RUNNING"
          ? "WARNING"
          : geoHealth;

    const healthLevels = [
      predictionJobHealth,
      demandForecastJobHealth,
      snapshotJobHealth,
      geoapifyJobHealth,
    ];

    const overallStatus =
      healthLevels.includes("CRITICAL")
        ? "CRITICAL"
        : healthLevels.includes("WARNING")
          ? "WARNING"
          : "HEALTHY";

    return NextResponse.json({
      success: true,
      containsPersonalData: false,
      generatedAt: now,
      overallStatus,
      jobs: {
        predictions: {
          status: predictionJobHealth,
          lastRun: predictionRun,
          lastCalculatedAt:
            latestCalculation,
          minutesSinceActivity:
            predictionMinutesSinceActivity,
          staleAfterMinutes:
            PREDICTION_STALE_MINUTES,
          failedProfiles:
            predictionFailed,
        },
        demandForecast: {
          status:
            demandForecastJobHealth,
          lastRun:
            demandForecastRun,
          minutesSinceRun:
            demandForecastMinutesSinceRun,
          staleAfterMinutes:
            DEMAND_FORECAST_STALE_MINUTES,
          active:
            activeDemandForecast
              ? {
                  id:
                    activeDemandForecast.id,
                  issuedAt:
                    activeDemandForecast
                      .issuedAt,
                  windowStartAt:
                    activeDemandForecast
                      .windowStartAt,
                  windowEndAt:
                    activeDemandForecast
                      .windowEndAt,
                  predictedCount:
                    activeDemandForecast
                      .predictedCount,
                  lowerBound:
                    activeDemandForecast
                      .lowerBound,
                  upperBound:
                    activeDemandForecast
                      .upperBound,
                  observedSoFar:
                    observedDemandSoFar,
                  calibrationDays:
                    activeDemandForecast
                      .calibrationDays,
                  backtestMape:
                    Number(
                      activeDemandForecast
                        .backtestMape,
                    ),
                  slotTotal:
                    demandSlotTotal,
                  slotTotalsMatch:
                    demandSlotTotalsMatch,
                }
              : null,
          alerts: {
            open:
              openDemandAlerts.length,
            critical:
              criticalDemandAlerts,
            warning:
              warningDemandAlerts,
            current:
              openDemandAlerts,
            recent:
              recentDemandAlerts,
          },
          rangeEvidence: {
            historical: {
              evaluated:
                historicalDemandResults
                  .length,
              insideRange:
                historicalRangeHits,
              coverageRate:
                percentage(
                  historicalRangeHits,
                  historicalDemandResults
                    .length,
                ),
            },
            live: {
              evaluated:
                liveDemandResults.length,
              insideRange:
                liveRangeHits,
              coverageRate:
                percentage(
                  liveRangeHits,
                  liveDemandResults.length,
                ),
            },
          },
        },
        snapshots: {
          status: snapshotJobHealth,
          lastRun: snapshotRun,
          latestGeneratedAt:
            latestSnapshot._max
              .generatedAt,
          completedToday:
            todaySnapshots,
          eligibleActiveCustomers:
            eligibleSnapshotCustomers,
          expectedAfterLondonHour: 4,
        },
        geoapify: {
          status: geoapifyJobHealth,
          lastRun: geoapifyRun,
          lastSuccessfulLookupAt:
            geoapify
              ?.lastSuccessfulLookupAt ??
            null,
          lastError:
            geoapify?.lastError ?? null,
          enabled:
            geoapify?.isEnabled ?? false,
        },
      },
      recentJobRuns,
      intelligenceStates: {
        dirty: stateCounts.DIRTY ?? 0,
        current: stateCounts.CURRENT ?? 0,
        failed: stateCounts.FAILED ?? 0,
      },
      predictions: {
        modelVersion: MODEL_VERSION,
        horizonHours: HORIZON_HOURS,
        pending:
          predictionCounts.PENDING ?? 0,
        hit:
          predictionCounts.HIT ?? 0,
        missed:
          predictionCounts.MISSED ?? 0,
        latestActivityAt:
          latestPrediction._max.updatedAt,
        accuracyPeriodDays: 14,
        evaluated: resolved,
        hitRate:
          percentage(hits, resolved),
        timeSlotEvaluated:
          slotEvaluated.length,
        timeSlotHitRate:
          percentage(
            slotHits,
            slotEvaluated.length,
          ),
        averageTimeSlotMissMinutes:
          slotMissDistances.length > 0
            ? Math.round(
                slotMissDistances.reduce(
                  (total, value) =>
                    total + value,
                  0,
                ) /
                  slotMissDistances.length,
              )
            : null,
      },
      geoapify: {
        dailyUsed: geoDailyUsed,
        dailyLimit: geoDailyLimit,
        creditsRemaining:
          Math.max(
            geoDailyLimit -
              geoDailyUsed,
            0,
          ),
        backfillCeiling:
          GEOAPIFY_BACKFILL_CEILING,
        backfillCreditsRemaining:
          Math.max(
            GEOAPIFY_BACKFILL_CEILING -
              geoDailyUsed,
            0,
          ),
        historicalLocations,
        readyHistoricalLocations,
        waitingHistoricalLocations,
        protectedHistoricalLocations,
        coveragePercent:
          percentage(
            readyHistoricalLocations,
            historicalLocations,
          ),
      },
    });
  } catch (error) {
    console.error(
      "Customer intelligence health failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "CUSTOMER_INTELLIGENCE_HEALTH_FAILED",
        message:
          "Customer intelligence health could not be calculated.",
      },
      {
        status: 500,
      },
    );
  }
}
