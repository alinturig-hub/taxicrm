ALTER TABLE "PlaceIntelligence"
ADD COLUMN "poiCategoryStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "poiCategoryAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "poiCategoryLastAttemptAt" TIMESTAMP(3),
ADD COLUMN "poiCategoryNextRetryAt" TIMESTAMP(3),
ADD COLUMN "poiCategoryEnrichedAt" TIMESTAMP(3),
ADD COLUMN "poiCategoryLastError" TEXT,
ADD COLUMN "poiCategoryMatchDistanceMetres" DECIMAL(8,2),
ADD COLUMN "poiCategoryProviderPlaceId" TEXT,
ADD COLUMN "poiCategoryRawPayload" JSONB;

CREATE INDEX
"PlaceIntelligence_poiCategoryStatus_poiCategoryNextRetryAt_idx"
ON "PlaceIntelligence"(
  "poiCategoryStatus",
  "poiCategoryNextRetryAt"
);

CREATE TABLE "CustomerBehaviourTag" (
  "id" TEXT NOT NULL,
  "normalCustomerId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "evidenceCount" INTEGER NOT NULL,
  "eligibleCount" INTEGER NOT NULL,
  "percentage" DECIMAL(6,2) NOT NULL,
  "windowDays" INTEGER NOT NULL DEFAULT 14,
  "windowStartAt" TIMESTAMP(3) NOT NULL,
  "windowEndAt" TIMESTAMP(3) NOT NULL,
  "lastObservedAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'AUTOMATIC',
  "modelVersion" TEXT NOT NULL DEFAULT 'CUSTOMER_TAGS_V1',
  "explanation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerBehaviourTag_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
"CustomerBehaviourTag_normalCustomerId_tagId_key"
ON "CustomerBehaviourTag"(
  "normalCustomerId",
  "tagId"
);

CREATE INDEX
"CustomerBehaviourTag_tagId_active_idx"
ON "CustomerBehaviourTag"(
  "tagId",
  "active"
);

CREATE INDEX
"CustomerBehaviourTag_normalCustomerId_active_idx"
ON "CustomerBehaviourTag"(
  "normalCustomerId",
  "active"
);

CREATE INDEX
"CustomerBehaviourTag_category_active_idx"
ON "CustomerBehaviourTag"(
  "category",
  "active"
);

CREATE INDEX
"CustomerBehaviourTag_updatedAt_idx"
ON "CustomerBehaviourTag"(
  "updatedAt"
);

ALTER TABLE "CustomerBehaviourTag"
ADD CONSTRAINT
"CustomerBehaviourTag_normalCustomerId_fkey"
FOREIGN KEY ("normalCustomerId")
REFERENCES "NormalCustomer"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
