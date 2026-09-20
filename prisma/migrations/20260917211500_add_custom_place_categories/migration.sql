CREATE TABLE "PlaceCategoryDefinition" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isSensitive" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlaceCategoryDefinition_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
"PlaceCategoryDefinition_slug_key"
ON "PlaceCategoryDefinition"("slug");

CREATE INDEX
"PlaceCategoryDefinition_isActive_label_idx"
ON "PlaceCategoryDefinition"("isActive", "label");

CREATE INDEX
"PlaceCategoryDefinition_createdAt_idx"
ON "PlaceCategoryDefinition"("createdAt");
