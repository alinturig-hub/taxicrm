CREATE TABLE "CustomerProfileSnapshot" (
  "id" TEXT NOT NULL,
  "normalCustomerId" TEXT NOT NULL,
  "snapshotDate" DATE NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalBookings" INTEGER NOT NULL,
  "profileSafe" BOOLEAN NOT NULL,
  "lifecycle" TEXT NOT NULL,
  "needScore" INTEGER,
  "needLevel" TEXT NOT NULL,
  "needConfidence" INTEGER NOT NULL,
  "relationshipScore" INTEGER,
  "relationshipLevel" TEXT NOT NULL,
  "regularityScore" INTEGER,
  "scheduleStatus" TEXT NOT NULL,
  "returnRate" DECIMAL(6,2) NOT NULL,
  "serviceOutcomeLevel" TEXT NOT NULL,
  "recentAdverseRate" DECIMAL(6,2) NOT NULL,
  "dataQualityScore" INTEGER NOT NULL,
  "dataQualityGrade" TEXT NOT NULL,
  "behaviourChangeScore" INTEGER,
  "behaviourChangeDirection" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerProfileSnapshot_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "CustomerProfileSnapshot_normalCustomerId_snapshotDate_key"
ON "CustomerProfileSnapshot"(
  "normalCustomerId",
  "snapshotDate"
);

CREATE INDEX
  "CustomerProfileSnapshot_snapshotDate_idx"
ON "CustomerProfileSnapshot"("snapshotDate");

CREATE INDEX
  "CustomerProfileSnapshot_needLevel_snapshotDate_idx"
ON "CustomerProfileSnapshot"(
  "needLevel",
  "snapshotDate"
);

CREATE INDEX
  "CustomerProfileSnapshot_serviceOutcomeLevel_snapshotDate_idx"
ON "CustomerProfileSnapshot"(
  "serviceOutcomeLevel",
  "snapshotDate"
);

ALTER TABLE "CustomerProfileSnapshot"
ADD CONSTRAINT
  "CustomerProfileSnapshot_normalCustomerId_fkey"
FOREIGN KEY ("normalCustomerId")
REFERENCES "NormalCustomer"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
