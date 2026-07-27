-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "currentBookingId" INTEGER,
ADD COLUMN     "currentDriverId" TEXT,
ADD COLUMN     "currentLatitude" DECIMAL(10,7),
ADD COLUMN     "currentLongitude" DECIMAL(10,7),
ADD COLUMN     "currentStatus" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VehicleSnapshot" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AUTOCAB',
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "bookingId" INTEGER,
    "vehicleStatus" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceWebhookId" TEXT,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "VehicleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleSnapshot_vehicleId_snapshotAt_idx" ON "VehicleSnapshot"("vehicleId", "snapshotAt");

-- CreateIndex
CREATE INDEX "VehicleSnapshot_driverId_snapshotAt_idx" ON "VehicleSnapshot"("driverId", "snapshotAt");

-- CreateIndex
CREATE INDEX "VehicleSnapshot_bookingId_idx" ON "VehicleSnapshot"("bookingId");

-- CreateIndex
CREATE INDEX "VehicleSnapshot_vehicleStatus_idx" ON "VehicleSnapshot"("vehicleStatus");

-- CreateIndex
CREATE INDEX "VehicleSnapshot_snapshotAt_idx" ON "VehicleSnapshot"("snapshotAt");

-- CreateIndex
CREATE INDEX "VehicleSnapshot_sourceWebhookId_idx" ON "VehicleSnapshot"("sourceWebhookId");

-- CreateIndex
CREATE INDEX "Vehicle_currentDriverId_idx" ON "Vehicle"("currentDriverId");

-- CreateIndex
CREATE INDEX "Vehicle_currentStatus_idx" ON "Vehicle"("currentStatus");

-- CreateIndex
CREATE INDEX "Vehicle_currentBookingId_idx" ON "Vehicle"("currentBookingId");

-- CreateIndex
CREATE INDEX "Vehicle_lastSeenAt_idx" ON "Vehicle"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSnapshot" ADD CONSTRAINT "VehicleSnapshot_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSnapshot" ADD CONSTRAINT "VehicleSnapshot_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
