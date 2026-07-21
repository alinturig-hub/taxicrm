-- CreateEnum
CREATE TYPE "WebhookProcessingMode" AS ENUM ('ALWAYS', 'WHEN_CONDITIONS_MATCH');

-- CreateEnum
CREATE TYPE "WebhookConditionMode" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "WebhookConditionOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'EXISTS', 'NOT_EXISTS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUALS', 'LESS_THAN', 'LESS_THAN_OR_EQUALS', 'IN', 'NOT_IN');

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "webhookConfigurationId" TEXT;

-- CreateTable
CREATE TABLE "AutocabWebhookConfiguration" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "endpointSlug" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "processingMode" "WebhookProcessingMode" NOT NULL DEFAULT 'ALWAYS',
    "conditionMode" "WebhookConditionMode" NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutocabWebhookConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookCondition" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "operator" "WebhookConditionOperator" NOT NULL,
    "expectedValue" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutocabWebhookConfiguration_eventType_key" ON "AutocabWebhookConfiguration"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "AutocabWebhookConfiguration_endpointSlug_key" ON "AutocabWebhookConfiguration"("endpointSlug");

-- CreateIndex
CREATE INDEX "AutocabWebhookConfiguration_isEnabled_idx" ON "AutocabWebhookConfiguration"("isEnabled");

-- CreateIndex
CREATE INDEX "AutocabWebhookConfiguration_endpointSlug_idx" ON "AutocabWebhookConfiguration"("endpointSlug");

-- CreateIndex
CREATE INDEX "WebhookCondition_configurationId_position_idx" ON "WebhookCondition"("configurationId", "position");

-- CreateIndex
CREATE INDEX "WebhookCondition_fieldPath_idx" ON "WebhookCondition"("fieldPath");

-- CreateIndex
CREATE INDEX "WebhookEvent_webhookConfigurationId_idx" ON "WebhookEvent"("webhookConfigurationId");

-- AddForeignKey
ALTER TABLE "WebhookCondition" ADD CONSTRAINT "WebhookCondition_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "AutocabWebhookConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_webhookConfigurationId_fkey" FOREIGN KEY ("webhookConfigurationId") REFERENCES "AutocabWebhookConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

