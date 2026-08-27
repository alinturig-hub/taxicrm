CREATE TABLE "CustomerPredictionEvidenceEvent" (
  "id" TEXT NOT NULL,
  "predictionId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "bookingId" TEXT,
  "minutesFromIssued" INTEGER,
  "timeSlotDistanceMinutes" INTEGER,
  "outcome" TEXT,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerPredictionEvidenceEvent_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "CustomerPredictionEvidenceEvent_dedupeKey_key"
ON "CustomerPredictionEvidenceEvent"(
  "dedupeKey"
);

CREATE INDEX
  "CustomerPredictionEvidenceEvent_predictionId_occurredAt_idx"
ON "CustomerPredictionEvidenceEvent"(
  "predictionId",
  "occurredAt"
);

CREATE INDEX
  "CustomerPredictionEvidenceEvent_eventType_occurredAt_idx"
ON "CustomerPredictionEvidenceEvent"(
  "eventType",
  "occurredAt"
);

CREATE INDEX
  "CustomerPredictionEvidenceEvent_bookingId_idx"
ON "CustomerPredictionEvidenceEvent"(
  "bookingId"
);

CREATE INDEX
  "CustomerPredictionEvidenceEvent_occurredAt_idx"
ON "CustomerPredictionEvidenceEvent"(
  "occurredAt"
);

ALTER TABLE "CustomerPredictionEvidenceEvent"
ADD CONSTRAINT
  "CustomerPredictionEvidenceEvent_predictionId_fkey"
FOREIGN KEY ("predictionId")
REFERENCES "CustomerBookingPrediction"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
