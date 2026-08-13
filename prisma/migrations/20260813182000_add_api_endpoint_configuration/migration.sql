CREATE TABLE "ApiEndpointConfiguration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "url" TEXT NOT NULL,
    "path" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastStatusCode" INTEGER,
    "lastResponseTimeMs" INTEGER,
    "lastError" TEXT,
    "sampleResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiEndpointConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiEndpointConfiguration_url_key"
ON "ApiEndpointConfiguration"("url");

CREATE INDEX "ApiEndpointConfiguration_provider_idx"
ON "ApiEndpointConfiguration"("provider");

CREATE INDEX "ApiEndpointConfiguration_isEnabled_idx"
ON "ApiEndpointConfiguration"("isEnabled");
