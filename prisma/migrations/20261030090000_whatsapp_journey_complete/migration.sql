CREATE TABLE "WhatsAppConfiguration" (
  "id" TEXT PRIMARY KEY DEFAULT 'journey-complete',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "enabledSince" TIMESTAMP(3),
  "phoneNumberId" TEXT NOT NULL,
  "templateName" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en_GB',
  "graphVersion" TEXT NOT NULL DEFAULT 'v23.0',
  "encryptedToken" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "WhatsAppConsent" (
  "phone" TEXT PRIMARY KEY,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "evidence" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL
);
CREATE TABLE "WhatsAppDelivery" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL UNIQUE,
  "webhookEventId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "WhatsAppDelivery_createdAt_idx" ON "WhatsAppDelivery"("createdAt");
