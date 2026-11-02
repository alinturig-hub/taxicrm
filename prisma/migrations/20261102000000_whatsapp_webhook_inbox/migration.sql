-- Dedicated transport inbox: independent from canonical booking ingestion.
CREATE TABLE "WhatsAppWebhookInbox" (
 "id" TEXT PRIMARY KEY,
 "connectionKey" TEXT NOT NULL,
 "bodyHash" TEXT NOT NULL,
 "rawBody" TEXT NOT NULL,
 "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "status" TEXT NOT NULL DEFAULT 'RECEIVED' CHECK ("status" IN ('RECEIVED','PROCESSING','PROCESSED','FAILED')),
 "attemptCount" INTEGER NOT NULL DEFAULT 0 CHECK ("attemptCount">=0),
 "processedAt" TIMESTAMPTZ,
 UNIQUE("connectionKey","bodyHash")
);
CREATE INDEX "WhatsAppWebhookInbox_status_receivedAt_idx" ON "WhatsAppWebhookInbox"("status","receivedAt");
