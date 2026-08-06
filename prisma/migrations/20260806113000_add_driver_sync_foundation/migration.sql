CREATE TYPE "IntegrationSyncStatus" AS ENUM (
  'RUNNING',
  'SUCCESS',
  'PARTIAL',
  'FAILED'
);

CREATE TYPE "IntegrationSyncEntity" AS ENUM (
  'DRIVERS',
  'VEHICLES',
  'COMPANIES',
  'ZONES',
  'CAPABILITIES'
);

ALTER TABLE "AutocabApiConfiguration"
ADD COLUMN "driverSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "driverSyncIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,
ADD COLUMN "importActiveDriversOnly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "createNewDrivers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updateExistingDrivers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "markMissingDriversInactive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastDriverSyncAt" TIMESTAMP(3),
ADD COLUMN "nextDriverSyncAt" TIMESTAMP(3),
ADD COLUMN "lastDriverSyncStatus" "IntegrationSyncStatus",
ADD COLUMN "lastDriverSyncMessage" TEXT;

CREATE INDEX
"AutocabApiConfiguration_driverSyncEnabled_nextDriverSyncAt_idx"
ON "AutocabApiConfiguration"(
  "driverSyncEnabled",
  "nextDriverSyncAt"
);

ALTER TABLE "Driver"
ADD COLUMN "rowVersion" INTEGER,
ADD COLUMN "fullName" TEXT,
ADD COLUMN "mobile" TEXT,
ADD COLUMN "telephone" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "companyId" INTEGER,
ADD COLUMN "shiftPatternId" INTEGER,
ADD COLUMN "fleetOwnerId" INTEGER,
ADD COLUMN "postalAddressSummary" TEXT,
ADD COLUMN "badgeExpiryDate" TIMESTAMP(3),
ADD COLUMN "cpcExpiryDate" TIMESTAMP(3),
ADD COLUMN "dbsExpiryDate" TIMESTAMP(3),
ADD COLUMN "tachographExpiryDate" TIMESTAMP(3),
ADD COLUMN "licenceExpiryDate" TIMESTAMP(3),
ADD COLUMN "insuranceExpiryDate" TIMESTAMP(3),
ADD COLUMN "medicalCardExpiryDate" TIMESTAMP(3),
ADD COLUMN "capabilities" JSONB,
ADD COLUMN "lastApiSyncAt" TIMESTAMP(3),
ADD COLUMN "lastSeenInApiAt" TIMESTAMP(3),
ADD COLUMN "markedInactiveAt" TIMESTAMP(3);

CREATE INDEX "Driver_active_idx"
ON "Driver"("active");

CREATE INDEX "Driver_suspended_idx"
ON "Driver"("suspended");

CREATE INDEX "Driver_companyId_idx"
ON "Driver"("companyId");

CREATE INDEX "Driver_lastApiSyncAt_idx"
ON "Driver"("lastApiSyncAt");

CREATE TABLE "IntegrationSyncJob" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
  "entity" "IntegrationSyncEntity" NOT NULL,
  "status" "IntegrationSyncStatus" NOT NULL DEFAULT 'RUNNING',
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "recordsReceived" INTEGER NOT NULL DEFAULT 0,
  "recordsCreated" INTEGER NOT NULL DEFAULT 0,
  "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
  "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
  "recordsDisabled" INTEGER NOT NULL DEFAULT 0,
  "recordsFailed" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "error" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IntegrationSyncJob_pkey"
  PRIMARY KEY ("id")
);

CREATE INDEX
"IntegrationSyncJob_provider_entity_startedAt_idx"
ON "IntegrationSyncJob"(
  "provider",
  "entity",
  "startedAt"
);

CREATE INDEX
"IntegrationSyncJob_status_idx"
ON "IntegrationSyncJob"("status");

CREATE INDEX
"IntegrationSyncJob_startedAt_idx"
ON "IntegrationSyncJob"("startedAt");
