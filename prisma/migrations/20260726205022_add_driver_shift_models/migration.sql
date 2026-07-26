-- CreateEnum
CREATE TYPE "DriverShiftStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
    "externalId" TEXT NOT NULL,
    "callsign" TEXT,
    "forename" TEXT,
    "surname" TEXT,
    "badgeNumber" TEXT,
    "licenceNumber" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
    "externalId" TEXT NOT NULL,
    "callsign" TEXT,
    "deviceId" TEXT,
    "vinNumber" TEXT,
    "plateNumber" TEXT,
    "registration" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverShift" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "status" "DriverShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "subEventType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "modifiedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "sourceWebhookEvent" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Driver_callsign_idx" ON "Driver"("callsign");

-- CreateIndex
CREATE INDEX "Driver_badgeNumber_idx" ON "Driver"("badgeNumber");

-- CreateIndex
CREATE INDEX "Driver_licenceNumber_idx" ON "Driver"("licenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_provider_externalId_key" ON "Driver"("provider", "externalId");

-- CreateIndex
CREATE INDEX "Vehicle_callsign_idx" ON "Vehicle"("callsign");

-- CreateIndex
CREATE INDEX "Vehicle_registration_idx" ON "Vehicle"("registration");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_provider_externalId_key" ON "Vehicle"("provider", "externalId");

-- CreateIndex
CREATE INDEX "DriverShift_status_idx" ON "DriverShift"("status");

-- CreateIndex
CREATE INDEX "DriverShift_startedAt_idx" ON "DriverShift"("startedAt");

-- CreateIndex
CREATE INDEX "DriverShift_endedAt_idx" ON "DriverShift"("endedAt");

-- CreateIndex
CREATE INDEX "DriverShift_vehicleId_idx" ON "DriverShift"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverShift_provider_driverId_startedAt_key" ON "DriverShift"("provider", "driverId", "startedAt");

-- AddForeignKey
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
