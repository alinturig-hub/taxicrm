-- CreateEnum
CREATE TYPE "BookingTimelineSource" AS ENUM ('AUTOCAB', 'SYSTEM', 'USER', 'AI');

-- CreateTable
CREATE TABLE "BookingTimelineEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "webhookEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" "BookingTimelineSource" NOT NULL DEFAULT 'AUTOCAB',
    "createdBy" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingTimelineEvent_bookingId_occurredAt_idx" ON "BookingTimelineEvent"("bookingId", "occurredAt");

-- CreateIndex
CREATE INDEX "BookingTimelineEvent_eventType_idx" ON "BookingTimelineEvent"("eventType");

-- CreateIndex
CREATE INDEX "BookingTimelineEvent_source_idx" ON "BookingTimelineEvent"("source");

-- CreateIndex
CREATE INDEX "BookingTimelineEvent_webhookEventId_idx" ON "BookingTimelineEvent"("webhookEventId");

-- AddForeignKey
ALTER TABLE "BookingTimelineEvent" ADD CONSTRAINT "BookingTimelineEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTimelineEvent" ADD CONSTRAINT "BookingTimelineEvent_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

