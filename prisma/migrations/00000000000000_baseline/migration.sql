CREATE TYPE "BookingLocationType" AS ENUM ('PICKUP', 'DESTINATION');

CREATE TYPE "WebhookProcessingStatus" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED'
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
  "externalId" TEXT NOT NULL,
  "originalBookingId" TEXT,
  "bookingType" TEXT,
  "typeOfBooking" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "pickupDueTime" TIMESTAMP(3),
  "dropOffDueTime" TIMESTAMP(3),
  "bookedAtTime" TIMESTAMP(3),
  "customerName" TEXT,
  "telephoneNumber" TEXT,
  "customerEmail" TEXT,
  "paymentType" TEXT,
  "accountType" TEXT,
  "accountId" TEXT,
  "accountName" TEXT,
  "companyId" TEXT,
  "companyName" TEXT,
  "companyRegisteredNo" TEXT,
  "companyCode" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "passengers" INTEGER NOT NULL DEFAULT 1,
  "luggage" INTEGER NOT NULL DEFAULT 0,
  "driverNote" TEXT,
  "officeNote" TEXT,
  "ourReference" TEXT,
  "flightDetails" TEXT,
  "bookedBy" TEXT,
  "bookingSource" TEXT,
  "cabExchangeReference" TEXT,
  "loyaltyCardId" TEXT,
  "loyaltyCardCostValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "isStreetPickup" BOOLEAN NOT NULL DEFAULT false,
  "fare" DECIMAL(12,2),
  "cost" DECIMAL(12,2),
  "price" DECIMAL(12,2),
  "extraCost" DECIMAL(12,2),
  "fixedCost" DECIMAL(12,2),
  "fixedPrice" DECIMAL(12,2),
  "chargingAreaCost" DECIMAL(12,2),
  "chargingAreaPrice" DECIMAL(12,2),
  "waitingTime" DECIMAL(12,2),
  "waitingTimeChargeable" DECIMAL(12,2),
  "gratuityAmount" DECIMAL(12,2),
  "costSource" TEXT,
  "pricingTariff" TEXT,
  "pricingSource" TEXT,
  "distance" DECIMAL(12,3),
  "systemDistance" DECIMAL(12,3),
  "meterDistance" DECIMAL(12,3),
  "meterDistanceMetres" INTEGER,
  "gpsMeterDistance" DECIMAL(12,3),
  "gpsMeterPrice" DECIMAL(12,2),
  "gpsMeterPriceSource" TEXT,
  "estimatedDistance" DECIMAL(12,3),
  "estimatedPrice" DECIMAL(12,2),
  "estimatedPriceSource" TEXT,
  "estimatedTime" TEXT,
  "capabilities" JSONB,
  "yourReferences" JSONB,
  "promotionCodeDiscount" JSONB,
  "rawPayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingLocation" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "type" "BookingLocationType" NOT NULL,
  "address" TEXT NOT NULL,
  "zoneId" TEXT,
  "zoneDescriptor" TEXT,
  "zoneName" TEXT,
  "longitude" DECIMAL(11,8),
  "latitude" DECIMAL(10,8),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingVia" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "address" TEXT NOT NULL,
  "zoneId" TEXT,
  "zoneDescriptor" TEXT,
  "zoneName" TEXT,
  "longitude" DECIMAL(11,8),
  "latitude" DECIMAL(10,8),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingVia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
  "eventType" TEXT NOT NULL,
  "externalBookingId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "headers" JSONB,
  "processingError" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "bookingId" TEXT,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingSnapshot" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "webhookEventId" TEXT,
  "version" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Booking_provider_externalId_key"
ON "Booking"("provider", "externalId");

CREATE INDEX "Booking_pickupDueTime_idx" ON "Booking"("pickupDueTime");
CREATE INDEX "Booking_telephoneNumber_idx" ON "Booking"("telephoneNumber");
CREATE INDEX "Booking_customerEmail_idx" ON "Booking"("customerEmail");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

CREATE UNIQUE INDEX "BookingLocation_bookingId_type_key"
ON "BookingLocation"("bookingId", "type");

CREATE INDEX "BookingLocation_zoneId_idx" ON "BookingLocation"("zoneId");

CREATE UNIQUE INDEX "BookingVia_bookingId_position_key"
ON "BookingVia"("bookingId", "position");

CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key"
ON "WebhookEvent"("idempotencyKey");

CREATE INDEX "WebhookEvent_provider_eventType_idx"
ON "WebhookEvent"("provider", "eventType");

CREATE INDEX "WebhookEvent_externalBookingId_idx"
ON "WebhookEvent"("externalBookingId");

CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

CREATE UNIQUE INDEX "BookingSnapshot_bookingId_version_key"
ON "BookingSnapshot"("bookingId", "version");

CREATE UNIQUE INDEX "BookingSnapshot_webhookEventId_key"
ON "BookingSnapshot"("webhookEventId");

CREATE INDEX "BookingSnapshot_bookingId_createdAt_idx"
ON "BookingSnapshot"("bookingId", "createdAt");

CREATE INDEX "BookingSnapshot_eventType_idx"
ON "BookingSnapshot"("eventType");

ALTER TABLE "BookingLocation"
ADD CONSTRAINT "BookingLocation_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingVia"
ADD CONSTRAINT "BookingVia_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookEvent"
ADD CONSTRAINT "WebhookEvent_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingSnapshot"
ADD CONSTRAINT "BookingSnapshot_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingSnapshot"
ADD CONSTRAINT "BookingSnapshot_webhookEventId_fkey"
FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
