CREATE TABLE "CustomerBookingPrediction" (
  "id" TEXT NOT NULL,
  "normalCustomerId" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "horizonHours" INTEGER NOT NULL DEFAULT 24,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "windowStartAt" TIMESTAMP(3) NOT NULL,
  "windowEndAt" TIMESTAMP(3) NOT NULL,
  "likelyWindowStartAt" TIMESTAMP(3),
  "likelyWindowEndAt" TIMESTAMP(3),
  "score" DECIMAL(6,2) NOT NULL,
  "level" TEXT NOT NULL,
  "observedRate" DECIMAL(6,2) NOT NULL,
  "evidenceConfidence" INTEGER NOT NULL,
  "calibrationSamples" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "matchedBookingId" TEXT,
  "evaluatedAt" TIMESTAMP(3),
  "inputFingerprint" TEXT NOT NULL,
  "activeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerBookingPrediction_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "CustomerIntelligenceState" (
  "normalCustomerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DIRTY',
  "inputFingerprint" TEXT,
  "dirtyAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCalculatedAt" TIMESTAMP(3),
  "nextRefreshAt" TIMESTAMP(3),
  "lastError" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerIntelligenceState_pkey"
    PRIMARY KEY ("normalCustomerId")
);

CREATE UNIQUE INDEX
  "CustomerBookingPrediction_activeKey_key"
ON "CustomerBookingPrediction"("activeKey");

CREATE UNIQUE INDEX
  "CustomerBookingPrediction_customer_model_horizon_fingerprint_key"
ON "CustomerBookingPrediction"(
  "normalCustomerId",
  "modelVersion",
  "horizonHours",
  "inputFingerprint"
);

CREATE INDEX
  "CustomerBookingPrediction_customer_issued_idx"
ON "CustomerBookingPrediction"(
  "normalCustomerId",
  "issuedAt"
);

CREATE INDEX
  "CustomerBookingPrediction_status_windowEnd_idx"
ON "CustomerBookingPrediction"(
  "status",
  "windowEndAt"
);

CREATE INDEX
  "CustomerBookingPrediction_matchedBooking_idx"
ON "CustomerBookingPrediction"(
  "matchedBookingId"
);

CREATE INDEX
  "CustomerBookingPrediction_model_horizon_status_idx"
ON "CustomerBookingPrediction"(
  "modelVersion",
  "horizonHours",
  "status"
);

CREATE INDEX
  "CustomerIntelligenceState_status_dirty_idx"
ON "CustomerIntelligenceState"(
  "status",
  "dirtyAt"
);

CREATE INDEX
  "CustomerIntelligenceState_nextRefresh_idx"
ON "CustomerIntelligenceState"(
  "nextRefreshAt"
);

ALTER TABLE "CustomerBookingPrediction"
ADD CONSTRAINT
  "CustomerBookingPrediction_normalCustomerId_fkey"
FOREIGN KEY ("normalCustomerId")
REFERENCES "NormalCustomer"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "CustomerIntelligenceState"
ADD CONSTRAINT
  "CustomerIntelligenceState_normalCustomerId_fkey"
FOREIGN KEY ("normalCustomerId")
REFERENCES "NormalCustomer"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
