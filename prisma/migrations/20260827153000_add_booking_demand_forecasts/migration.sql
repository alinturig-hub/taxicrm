CREATE TABLE "BookingDemandForecast" (
  "id" TEXT NOT NULL,
  "forecastKey" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "targetType" TEXT NOT NULL
    DEFAULT 'BOOKING_REQUESTS',
  "horizonHours" INTEGER NOT NULL
    DEFAULT 24,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "windowStartAt" TIMESTAMP(3) NOT NULL,
  "windowEndAt" TIMESTAMP(3) NOT NULL,
  "predictedCount" INTEGER NOT NULL,
  "lowerBound" INTEGER NOT NULL,
  "upperBound" INTEGER NOT NULL,
  "status" TEXT NOT NULL
    DEFAULT 'PENDING',
  "actualCount" INTEGER,
  "absoluteError" INTEGER,
  "percentageError" DECIMAL(7, 2),
  "evaluatedAt" TIMESTAMP(3),
  "calibrationDays" INTEGER NOT NULL,
  "backtestMae" DECIMAL(8, 2) NOT NULL,
  "backtestMape" DECIMAL(6, 2) NOT NULL,
  "averageBias" DECIMAL(8, 2) NOT NULL,
  "slotForecasts" JSONB NOT NULL,
  "slotActuals" JSONB,
  "methodology" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingDemandForecast_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "BookingDemandForecast_forecastKey_key"
ON "BookingDemandForecast"(
  "forecastKey"
);

CREATE INDEX
  "BookingDemandForecast_status_windowEndAt_idx"
ON "BookingDemandForecast"(
  "status",
  "windowEndAt"
);

CREATE INDEX
  "BookingDemandForecast_issuedAt_idx"
ON "BookingDemandForecast"(
  "issuedAt"
);

CREATE INDEX
  "BookingDemandForecast_modelVersion_horizonHours_status_idx"
ON "BookingDemandForecast"(
  "modelVersion",
  "horizonHours",
  "status"
);
