CREATE TABLE "AutocabApiConfiguration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://autocab-api.azure-api.net',
    "apiKeyEncrypted" TEXT,
    "apiKeyLastFour" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutocabApiConfiguration_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
"AutocabApiConfiguration_provider_key"
ON "AutocabApiConfiguration"("provider");

CREATE INDEX
"AutocabApiConfiguration_isEnabled_idx"
ON "AutocabApiConfiguration"("isEnabled");
