CREATE TABLE "CompanyDailyMetric" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "bookings" INTEGER NOT NULL DEFAULT 0,
  "completed" INTEGER NOT NULL DEFAULT 0,
  "cancelled" INTEGER NOT NULL DEFAULT 0,
  "noFare" INTEGER NOT NULL DEFAULT 0,
  "rejected" INTEGER NOT NULL DEFAULT 0,
  "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "estimatedRevenueLost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "averageBookingValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "completionRate" DECIMAL(7,2) NOT NULL DEFAULT 0,
  "cancellationRate" DECIMAL(7,2) NOT NULL DEFAULT 0,
  "noFareRate" DECIMAL(7,2) NOT NULL DEFAULT 0,
  "rejectionRate" DECIMAL(7,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyDailyMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyDailyMetric_date_key"
ON "CompanyDailyMetric"("date");

CREATE INDEX "CompanyDailyMetric_date_idx"
ON "CompanyDailyMetric"("date");
