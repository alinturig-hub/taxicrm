ALTER TABLE "ApiEndpointConfiguration"
ADD COLUMN "responseType" TEXT,
ADD COLUMN "recordKey" TEXT,
ADD COLUMN "jsonSchema" JSONB,
ADD COLUMN "exampleResponse" JSONB,
ADD COLUMN "filterConfiguration" JSONB,
ADD COLUMN "storeRecords" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ApiEndpointRecord" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceVersion" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiEndpointRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiEndpointRecord_endpointId_externalId_key"
ON "ApiEndpointRecord"("endpointId", "externalId");

CREATE INDEX "ApiEndpointRecord_endpointId_idx"
ON "ApiEndpointRecord"("endpointId");

CREATE INDEX "ApiEndpointRecord_isActive_idx"
ON "ApiEndpointRecord"("isActive");

ALTER TABLE "ApiEndpointRecord"
ADD CONSTRAINT "ApiEndpointRecord_endpointId_fkey"
FOREIGN KEY ("endpointId")
REFERENCES "ApiEndpointConfiguration"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
