import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODEL_VERSION = "HAZARD_SLOT_V1";
const HORIZON_HOURS = 24;
const PREDICTION_STALE_MINUTES = 30;
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
    ]);

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

    const healthLevels = [
      predictionHealth,
      snapshotHealth,
      geoHealth,
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
          status: predictionHealth,
          lastCalculatedAt:
            latestCalculation,
          minutesSinceActivity:
            predictionMinutesSinceActivity,
          staleAfterMinutes:
            PREDICTION_STALE_MINUTES,
          failedProfiles:
            predictionFailed,
        },
        snapshots: {
          status: snapshotHealth,
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
          status: geoHealth,
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
