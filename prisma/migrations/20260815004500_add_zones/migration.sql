CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
    "externalId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "mdtZoneId" INTEGER,
    "name" TEXT NOT NULL,
    "descriptor" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rawPayload" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Zone_provider_externalId_key"
ON "Zone"("provider", "externalId");

CREATE INDEX "Zone_companyId_idx"
ON "Zone"("companyId");

CREATE INDEX "Zone_active_idx"
ON "Zone"("active");

CREATE INDEX "Zone_name_idx"
ON "Zone"("name");
