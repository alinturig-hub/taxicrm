CREATE TABLE "GeoapifyApiConfiguration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'GEOAPIFY',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.geoapify.com',
    "apiKeyEncrypted" TEXT,
    "apiKeyLastFour" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyLimit" INTEGER NOT NULL DEFAULT 3000,
    "dailyUsed" INTEGER NOT NULL DEFAULT 0,
    "usageDate" TIMESTAMP(3),
    "lastTestedAt" TIMESTAMP(3),
    "lastSuccessfulLookupAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoapifyApiConfiguration_pkey"
      PRIMARY KEY ("id")
);

CREATE TABLE "PlaceIntelligence" (
    "id" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "originalAddress" TEXT,
    "placeName" TEXT,
    "formattedAddress" TEXT,
    "category" TEXT,
    "categories" JSONB,
    "website" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'GEOAPIFY',
    "providerPlaceId" TEXT,
    "confidence" DECIMAL(5,2),
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "sensitivityReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "enrichedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceIntelligence_pkey"
      PRIMARY KEY ("id")
);

ALTER TABLE "BookingLocation"
  ADD COLUMN "placeIntelligenceId" TEXT;

CREATE UNIQUE INDEX
  "GeoapifyApiConfiguration_provider_key"
ON "GeoapifyApiConfiguration"("provider");

CREATE INDEX
  "GeoapifyApiConfiguration_isEnabled_idx"
ON "GeoapifyApiConfiguration"("isEnabled");

CREATE UNIQUE INDEX
  "PlaceIntelligence_locationKey_key"
ON "PlaceIntelligence"("locationKey");

CREATE INDEX
  "PlaceIntelligence_status_nextRetryAt_idx"
ON "PlaceIntelligence"("status", "nextRetryAt");

CREATE INDEX
  "PlaceIntelligence_provider_providerPlaceId_idx"
ON "PlaceIntelligence"("provider", "providerPlaceId");

CREATE INDEX
  "PlaceIntelligence_latitude_longitude_idx"
ON "PlaceIntelligence"("latitude", "longitude");

CREATE INDEX
  "PlaceIntelligence_isSensitive_idx"
ON "PlaceIntelligence"("isSensitive");

CREATE INDEX
  "BookingLocation_placeIntelligenceId_idx"
ON "BookingLocation"("placeIntelligenceId");

ALTER TABLE "BookingLocation"
  ADD CONSTRAINT
    "BookingLocation_placeIntelligenceId_fkey"
  FOREIGN KEY ("placeIntelligenceId")
  REFERENCES "PlaceIntelligence"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
