ALTER TABLE "PlaceIntelligence"
ADD COLUMN "poiCategorySource" TEXT,
ADD COLUMN "poiCategoryReviewedAt" TIMESTAMP(3),
ADD COLUMN "poiCategoryReviewedBy" TEXT;

CREATE INDEX
"PlaceIntelligence_poiCategorySource_idx"
ON "PlaceIntelligence"("poiCategorySource");
