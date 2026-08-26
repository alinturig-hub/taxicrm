import { getServerSession } from "next-auth";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODEL_VERSION = "HAZARD_SLOT_V1";
const HORIZON_HOURS = 24;
const ALLOWED_DAYS = new Set([
  7,
  14,
  30,
]);

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

export async function GET(
  request: NextRequest,
) {
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
    const requestedDays = Number(
      request.nextUrl.searchParams.get(
        "days",
      ) ?? 7,
    );

    const days = ALLOWED_DAYS.has(
      requestedDays,
    )
      ? requestedDays
      : 7;

    const now = new Date();
    const periodStart = new Date(
      now.getTime() -
        days *
          24 *
          60 *
          60 *
          1000,
    );

    const baseWhere = {
      modelVersion: MODEL_VERSION,
      horizonHours: HORIZON_HOURS,
      issuedAt: {
        gte: periodStart,
      },
    };

    const [
      periodPredictions,
      pendingPredictions,
      lifetimeStatusGroups,
    ] = await Promise.all([
      prisma.customerBookingPrediction.findMany({
        where: baseWhere,
        select: {
          status: true,
          level: true,
          score: true,
          observedRate: true,
          likelyWindowStartAt: true,
          likelyWindowEndAt: true,
          likelyWindowHit: true,
          likelyWindowDistanceMinutes: true,
        },
      }),

      prisma.customerBookingPrediction.findMany({
        where: {
          modelVersion:
            MODEL_VERSION,
          horizonHours:
            HORIZON_HOURS,
          status: "PENDING",
          windowEndAt: {
            gte: now,
          },
        },
        orderBy: [
          {
            observedRate: "desc",
          },
          {
            score: "desc",
          },
          {
            likelyWindowStartAt:
              "asc",
          },
        ],
        take: 100,
        select: {
          id: true,
          normalCustomerId: true,
          issuedAt: true,
          windowEndAt: true,
          likelyWindowStartAt: true,
          likelyWindowEndAt: true,
          score: true,
          level: true,
          observedRate: true,
          evidenceConfidence: true,
          calibrationSamples: true,
          customer: {
            select: {
              displayName: true,
            },
          },
        },
      }),

      prisma.customerBookingPrediction.groupBy({
        by: [
          "status",
        ],
        where: {
          modelVersion:
            MODEL_VERSION,
          horizonHours:
            HORIZON_HOURS,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const resolved =
      periodPredictions.filter(
        (prediction) =>
          prediction.status === "HIT" ||
          prediction.status ===
            "MISSED",
      );

    const hits = resolved.filter(
      (prediction) =>
        prediction.status === "HIT",
    );

    const slotEvaluated =
      resolved.filter(
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
          prediction.status === "HIT" &&
          prediction
            .likelyWindowHit === true,
      );

    const missDistances =
      hits
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

    const levels = [
      "HIGH",
      "ELEVATED",
      "MODERATE",
      "LOW",
    ];

    const performanceByLevel =
      levels.map((level) => {
        const samples =
          resolved.filter(
            (prediction) =>
              prediction.level === level,
          );

        const levelHits =
          samples.filter(
            (prediction) =>
              prediction.status === "HIT",
          );

        const levelSlotSamples =
          samples.filter(
            (prediction) =>
              prediction
                .likelyWindowStartAt !==
                null &&
              prediction
                .likelyWindowEndAt !==
                null,
          );

        const levelSlotHits =
          levelSlotSamples.filter(
            (prediction) =>
              prediction.status ===
                "HIT" &&
              prediction
                .likelyWindowHit ===
                true,
          );

        return {
          level,
          evaluated: samples.length,
          hits: levelHits.length,
          missed:
            samples.length -
            levelHits.length,
          hitRate: percentage(
            levelHits.length,
            samples.length,
          ),
          slotHitRate: percentage(
            levelSlotHits.length,
            levelSlotSamples.length,
          ),
        };
      });

    const statusCounts = Object.fromEntries(
      lifetimeStatusGroups.map(
        (group) => [
          group.status,
          group._count._all,
        ],
      ),
    );

    return NextResponse.json({
      success: true,
      generatedAt: now,
      modelVersion:
        MODEL_VERSION,
      horizonHours:
        HORIZON_HOURS,
      periodDays: days,
      summary: {
        pending:
          statusCounts.PENDING ?? 0,
        hit:
          statusCounts.HIT ?? 0,
        missed:
          statusCounts.MISSED ?? 0,
        evaluated:
          resolved.length,
        hitRate: percentage(
          hits.length,
          resolved.length,
        ),
        slotEvaluated:
          slotEvaluated.length,
        slotHits:
          slotHits.length,
        slotHitRate: percentage(
          slotHits.length,
          slotEvaluated.length,
        ),
        averageSlotMissMinutes:
          missDistances.length > 0
            ? Math.round(
                missDistances.reduce(
                  (total, value) =>
                    total + value,
                  0,
                ) /
                  missDistances.length,
              )
            : null,
      },
      performanceByLevel,
      opportunities:
        pendingPredictions.map(
          (prediction) => ({
            predictionId:
              prediction.id,
            customerId:
              prediction.normalCustomerId,
            customerName:
              prediction.customer
                .displayName,
            issuedAt:
              prediction.issuedAt,
            windowEndAt:
              prediction.windowEndAt,
            likelyWindowStartAt:
              prediction
                .likelyWindowStartAt,
            likelyWindowEndAt:
              prediction
                .likelyWindowEndAt,
            score: Number(
              prediction.score,
            ),
            level:
              prediction.level,
            observedRate: Number(
              prediction.observedRate,
            ),
            evidenceConfidence:
              prediction
                .evidenceConfidence,
            calibrationSamples:
              prediction
                .calibrationSamples,
            status:
              "PENDING",
          }),
        ),
      privacy: {
        containsContactDetails: false,
        containsRoutes: false,
        containsProtectedPlaces: false,
      },
    });
  } catch (error) {
    console.error(
      "Customer prediction dashboard failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "CUSTOMER_PREDICTION_DASHBOARD_FAILED",
        message:
          "Customer prediction dashboard could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}
