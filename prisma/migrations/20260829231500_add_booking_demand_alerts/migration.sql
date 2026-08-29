CREATE TABLE "BookingDemandAlert" (
  "id" TEXT NOT NULL,
  "alertKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "forecastId" TEXT,
  "message" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingDemandAlert_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "BookingDemandAlert_alertKey_key"
ON "BookingDemandAlert"("alertKey");

CREATE INDEX
  "BookingDemandAlert_status_severity_detectedAt_idx"
ON "BookingDemandAlert"(
  "status",
  "severity",
  "detectedAt"
);

CREATE INDEX
  "BookingDemandAlert_type_status_idx"
ON "BookingDemandAlert"(
  "type",
  "status"
);

CREATE INDEX
  "BookingDemandAlert_forecastId_idx"
ON "BookingDemandAlert"("forecastId");

CREATE INDEX
  "BookingDemandAlert_lastSeenAt_idx"
ON "BookingDemandAlert"("lastSeenAt");

ALTER TABLE "BookingDemandAlert"
ADD CONSTRAINT
  "BookingDemandAlert_forecastId_fkey"
FOREIGN KEY ("forecastId")
REFERENCES "BookingDemandForecast"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
