import type { Prisma } from "@/generated/prisma/client";

type EvidenceDatabase = Pick<
  Prisma.TransactionClient,
  "customerPredictionEvidenceEvent"
>;

export type PredictionEvidenceEvent = {
  predictionId: string;
  eventType:
    | "PREDICTION_ISSUED"
    | "BOOKING_MATCHED"
    | "HORIZON_24H_CONFIRMED"
    | "TIME_SLOT_CONFIRMED"
    | "TIME_SLOT_MISSED"
    | "HORIZON_24H_MISSED";
  occurredAt: Date;
  source:
    | "REAL_TIME"
    | "SCHEDULED_EVALUATION"
    | "HISTORICAL_BACKFILL";
  bookingId?: string | null;
  minutesFromIssued?: number | null;
  timeSlotDistanceMinutes?: number | null;
  outcome?: string | null;
};

function evidenceMessage(
  event: PredictionEvidenceEvent,
) {
  switch (event.eventType) {
    case "PREDICTION_ISSUED":
      return "A new 24-hour booking prediction was issued.";

    case "BOOKING_MATCHED":
      return "A booking was observed inside the prediction horizon.";

    case "HORIZON_24H_CONFIRMED":
      return "The predicted 24-hour booking outcome was confirmed.";

    case "TIME_SLOT_CONFIRMED":
      return "The booking occurred inside the predicted three-hour interval.";

    case "TIME_SLOT_MISSED":
      return "A booking occurred inside 24 hours but outside the predicted three-hour interval.";

    case "HORIZON_24H_MISSED":
      return "No booking was observed before the 24-hour prediction expired.";
  }
}

function evidenceDedupeKey(
  event: PredictionEvidenceEvent,
) {
  return [
    event.predictionId,
    event.eventType,
    event.bookingId ?? "NO_BOOKING",
  ].join(":");
}

export async function recordPredictionEvidence(
  database: EvidenceDatabase,
  events: PredictionEvidenceEvent[],
) {
  if (events.length === 0) {
    return {
      requested: 0,
      created: 0,
    };
  }

  const result =
    await database.customerPredictionEvidenceEvent.createMany({
      data: events.map((event) => ({
        predictionId:
          event.predictionId,
        dedupeKey:
          evidenceDedupeKey(event),
        eventType:
          event.eventType,
        source:
          event.source,
        occurredAt:
          event.occurredAt,
        bookingId:
          event.bookingId ?? null,
        minutesFromIssued:
          event.minutesFromIssued ?? null,
        timeSlotDistanceMinutes:
          event.timeSlotDistanceMinutes ??
          null,
        outcome:
          event.outcome ?? null,
        message:
          evidenceMessage(event),
      })),
      skipDuplicates: true,
    });

  return {
    requested: events.length,
    created: result.count,
  };
}

export function minutesBetween(
  from: Date,
  to: Date,
) {
  return Math.max(
    0,
    Math.round(
      (
        to.getTime() -
        from.getTime()
      ) / 60_000,
    ),
  );
}
