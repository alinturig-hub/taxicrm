CREATE TABLE "WhatsAppOutboundMessage" (
 "id" TEXT PRIMARY KEY,
 "connectionKey" TEXT NOT NULL,
 "operationKey" TEXT NOT NULL,
 "requestHash" TEXT NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "recipient" TEXT NOT NULL,
 "templateSnapshot" JSONB NOT NULL,
 "purpose" TEXT NOT NULL CHECK("purpose" IN ('MARKETING','SERVICE')),
 "eligibilityEvidence" JSONB NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'QUEUED' CHECK("status" IN ('QUEUED','SENDING','ACCEPTED','UNKNOWN','REJECTED','CANCELLED')),
 "providerMessageId" TEXT,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "claimedAt" TIMESTAMPTZ,
 "finishedAt" TIMESTAMPTZ,
 "attemptCount" INTEGER NOT NULL DEFAULT 0 CHECK("attemptCount" BETWEEN 0 AND 1),
 UNIQUE("connectionKey","operationKey"),
 UNIQUE("connectionKey","providerMessageId"),
 CHECK("status" <> 'ACCEPTED' OR "providerMessageId" IS NOT NULL)
);
CREATE INDEX "WhatsAppOutboundMessage_status_createdAt_idx" ON "WhatsAppOutboundMessage"("status","createdAt");
