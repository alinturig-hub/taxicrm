-- CreateTable
CREATE TABLE "SmsGatewayConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "endpoint" TEXT NOT NULL,
    "signedParametersEncrypted" TEXT NOT NULL,
    "phoneParameter" TEXT NOT NULL DEFAULT 'customer_phone',
    "messageParameter" TEXT NOT NULL DEFAULT 'message',
    "senderParameter" TEXT NOT NULL DEFAULT 'sender',
    "sender" TEXT NOT NULL DEFAULT 'TaxiCRM',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsGatewayConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceField" TEXT NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "defaultRecipient" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "sourceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationJobRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "jobRunId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationJob_isEnabled_nextRunAt_idx" ON "NotificationJob"("isEnabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "NotificationJobRun_startedAt_idx" ON "NotificationJobRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJobRun_jobId_scheduledFor_key" ON "NotificationJobRun"("jobId", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_jobRunId_eventType_destination_key" ON "NotificationDelivery"("jobRunId", "eventType", "destination");

-- AddForeignKey
ALTER TABLE "NotificationJobRun" ADD CONSTRAINT "NotificationJobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "NotificationJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_jobRunId_fkey" FOREIGN KEY ("jobRunId") REFERENCES "NotificationJobRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
