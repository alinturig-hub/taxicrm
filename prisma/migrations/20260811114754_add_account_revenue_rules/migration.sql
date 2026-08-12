-- CreateTable
CREATE TABLE "AccountRevenueRule" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
    "accountId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "displayName" TEXT,
    "waitingChargeable" BOOLEAN NOT NULL DEFAULT false,
    "waitingRatePerMinute" DECIMAL(8,2) NOT NULL DEFAULT 0.30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountRevenueRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountRevenueRule_accountCode_idx" ON "AccountRevenueRule"("accountCode");

-- CreateIndex
CREATE INDEX "AccountRevenueRule_waitingChargeable_idx" ON "AccountRevenueRule"("waitingChargeable");

-- CreateIndex
CREATE UNIQUE INDEX "AccountRevenueRule_provider_accountId_accountCode_key" ON "AccountRevenueRule"("provider", "accountId", "accountCode");

-- Backfill Booking.accountCode from the latest raw webhook payload
-- for historical bookings that already have an accountId.
UPDATE "Booking" AS b
SET "accountCode" = source.account_code
FROM (
  SELECT DISTINCT ON (we."externalBookingId")
    we."externalBookingId",
    BTRIM(
      we.payload->'Account'->>'AccountCode'
    ) AS account_code
  FROM "WebhookEvent" AS we
  WHERE we.payload->'Account'->>'AccountCode' IS NOT NULL
    AND BTRIM(
      we.payload->'Account'->>'AccountCode'
    ) <> ''
  ORDER BY
    we."externalBookingId",
    we."receivedAt" DESC
) AS source
WHERE b."externalId" = source."externalBookingId"
  AND b."accountId" IS NOT NULL
  AND b."accountCode" IS NULL;
