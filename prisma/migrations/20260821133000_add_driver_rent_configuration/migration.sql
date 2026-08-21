-- CreateTable
CREATE TABLE "DriverRentConfiguration" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'GLOBAL',
    "rentPercentage" DECIMAL(7,2) NOT NULL DEFAULT 20.00,
    "weeklyCap" DECIMAL(12,2) NOT NULL DEFAULT 160.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverRentConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverRentConfiguration_key_key"
ON "DriverRentConfiguration"("key");

-- Seed the global driver rent settings
INSERT INTO "DriverRentConfiguration" (
    "id",
    "key",
    "rentPercentage",
    "weeklyCap",
    "createdAt",
    "updatedAt"
)
VALUES (
    'global-driver-rent',
    'GLOBAL',
    20.00,
    160.00,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
