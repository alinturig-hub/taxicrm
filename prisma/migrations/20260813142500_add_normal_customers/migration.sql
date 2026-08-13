CREATE TABLE "NormalCustomer" (
    "id" TEXT NOT NULL,
    "normalizedTelephone" TEXT NOT NULL,
    "telephoneNumber" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "firstBookingAt" TIMESTAMP(3),
    "lastBookingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormalCustomer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NormalCustomer_normalizedTelephone_key"
ON "NormalCustomer"("normalizedTelephone");

CREATE INDEX "NormalCustomer_telephoneNumber_idx"
ON "NormalCustomer"("telephoneNumber");

CREATE INDEX "NormalCustomer_email_idx"
ON "NormalCustomer"("email");

CREATE INDEX "NormalCustomer_lastBookingAt_idx"
ON "NormalCustomer"("lastBookingAt");

ALTER TABLE "Booking"
ADD COLUMN "normalCustomerId" TEXT;

CREATE INDEX "Booking_normalCustomerId_idx"
ON "Booking"("normalCustomerId");

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_normalCustomerId_fkey"
FOREIGN KEY ("normalCustomerId")
REFERENCES "NormalCustomer"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
