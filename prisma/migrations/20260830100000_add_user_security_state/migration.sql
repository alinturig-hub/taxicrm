ALTER TABLE "User"
ADD COLUMN
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN
  "lastLoginAt" TIMESTAMP(3),
ADD COLUMN
  "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN
  "deactivatedAt" TIMESTAMP(3);
