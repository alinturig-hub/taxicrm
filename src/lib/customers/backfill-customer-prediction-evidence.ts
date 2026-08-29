import { prisma } from "@/lib/prisma";

import {
  minutesBetween,
  recordPredictionEvidence,
  type PredictionEvidenceEvent,
} from "@/lib/customers/customer-prediction-evidence";

export async function backfillCustomerPredictionEvidence({
  limit = 100,
}: {
  limit?: number;
} = {}) {
  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    500,
  );

  const predictions =
    await prisma.customerBookingPrediction.findMany({
      where: {
        evidenceEvents: {
          none: {
            eventType:
              "PREDICTION_ISSUED",
          },
        },
      },
      orderBy: {
        issuedAt: "asc",
      },
      take: safeLimit,
      select: {
        id: true,
        issuedAt: true,
        windowEndAt: true,
        level: true,
        status: true,
        matchedBookingId: true,
        matchedBookingAt: true,
        likelyWindowHit: true,
        likelyWindowDistanceMinutes:
          true,
      },
    });

  let processed = 0;
  let failed = 0;

  for (const prediction of predictions) {
    try {
      const events:
        PredictionEvidenceEvent[] = [
          {
            predictionId:
              prediction.id,
            eventType:
              "PREDICTION_ISSUED",
            occurredAt:
              prediction.issuedAt,
            source:
              "HISTORICAL_BACKFILL",
            outcome:
              prediction.level,
          },
        ];

      if (
        prediction.status === "HIT" &&
        prediction.matchedBookingId &&
        prediction.matchedBookingAt
      ) {
        const shared = {
          predictionId:
            prediction.id,
          occurredAt:
            prediction.matchedBookingAt,
          source:
            "HISTORICAL_BACKFILL" as const,
          bookingId:
            prediction.matchedBookingId,
          minutesFromIssued:
            minutesBetween(
              prediction.issuedAt,
              prediction.matchedBookingAt,
            ),
        };

        events.push(
          {
            ...shared,
            eventType:
              "BOOKING_MATCHED",
            outcome:
              "BOOKING_OBSERVED",
          },
          {
            ...shared,
            eventType:
              "HORIZON_24H_CONFIRMED",
            outcome:
              "HIT",
          },
          {
            ...shared,
            eventType:
              prediction.likelyWindowHit
                ? "TIME_SLOT_CONFIRMED"
                : "TIME_SLOT_MISSED",
            timeSlotDistanceMinutes:
              prediction
                .likelyWindowDistanceMinutes,
            outcome:
              prediction.likelyWindowHit
                ? "HIT"
                : "MISSED",
          },
        );
      }

      if (prediction.status === "MISSED") {
        events.push({
          predictionId:
            prediction.id,
          eventType:
            "HORIZON_24H_MISSED",
          occurredAt:
            prediction.windowEndAt,
          source:
            "HISTORICAL_BACKFILL",
          outcome:
            "MISSED",
        });
      }

      await prisma.$transaction(
        async (tx) => {
          await recordPredictionEvidence(
            tx,
            events,
          );
        },
      );

      processed += 1;
    } catch (error) {
      failed += 1;

      console.error(
        "Prediction evidence backfill failed:",
        error instanceof Error
          ? error.message
          : "Unknown error",
      );
    }
  }

  return {
    success: failed === 0,
    selected: predictions.length,
    processed,
    failed,
    hasMore:
      predictions.length === safeLimit,
    containsPersonalData: false,
  };
}
