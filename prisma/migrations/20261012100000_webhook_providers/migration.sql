CREATE TABLE "WebhookProvider" (
 "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT,
 "baseUrl" TEXT NOT NULL, "apiKeyHeader" TEXT NOT NULL DEFAULT 'x-autocab-api-key',
 "apiKeyEncrypted" TEXT, "isEnabled" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
INSERT INTO "WebhookProvider" ("id","name","description","baseUrl","isEnabled","updatedAt")
 VALUES ('autocab','Autocab','Existing TaxiCRM Autocab receiver','https://taxicrm.plymhub.ai/api/webhooks/autocab',true,CURRENT_TIMESTAMP);
ALTER TABLE "AutocabWebhookConfiguration" ADD COLUMN "providerId" TEXT NOT NULL DEFAULT 'autocab';
ALTER TABLE "AutocabWebhookConfiguration" ADD CONSTRAINT "AutocabWebhookConfiguration_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "WebhookProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
