ALTER TYPE "IntegrationSyncEntity" ADD VALUE IF NOT EXISTS 'ACCOUNTS';

CREATE TABLE "AutocabAccount" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
    "externalId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "displayName" TEXT,
    "accountType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedReason" TEXT,
    "companyId" TEXT,
    "companyName" TEXT,
    "contactName" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "rawPayload" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutocabAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutocabAccount_provider_externalId_key"
ON "AutocabAccount"("provider", "externalId");

CREATE INDEX "AutocabAccount_accountCode_idx"
ON "AutocabAccount"("accountCode");

CREATE INDEX "AutocabAccount_active_idx"
ON "AutocabAccount"("active");

DROP INDEX IF EXISTS
"AccountRevenueRule_provider_accountId_accountCode_key";

CREATE UNIQUE INDEX
"AccountRevenueRule_provider_accountCode_key"
ON "AccountRevenueRule"("provider", "accountCode");
