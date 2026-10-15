-- Additive registry only: no existing records, writers or financial keys change.
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "draftKey" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "credentialCiphertext" TEXT,
    "capabilities" JSONB NOT NULL,
    "ownershipPolicy" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IntegrationConnection_status_check" CHECK ("status" IN ('DRAFT','VALIDATED','ACTIVE','DISABLED')),
    CONSTRAINT "IntegrationConnection_provider_check" CHECK ("providerCode" IN ('NEEDACABPLUS','AUTOCAB','LOCAL'))
);
CREATE UNIQUE INDEX "IntegrationConnection_draftKey_key" ON "IntegrationConnection"("draftKey");
CREATE INDEX "IntegrationConnection_providerCode_status_idx" ON "IntegrationConnection"("providerCode", "status");

CREATE TABLE "ConnectionExternalReference" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConnectionExternalReference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConnectionExternalReference_entity_check" CHECK ("entityType" IN ('BOOKING','DRIVER','VEHICLE','CUSTOMER','ACCOUNT','ZONE'))
);
CREATE UNIQUE INDEX "ConnectionExternalReference_connectionId_entityType_externalId_key" ON "ConnectionExternalReference"("connectionId", "entityType", "externalId");
CREATE INDEX "ConnectionExternalReference_entityType_canonicalId_idx" ON "ConnectionExternalReference"("entityType", "canonicalId");
ALTER TABLE "ConnectionExternalReference" ADD CONSTRAINT "ConnectionExternalReference_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
