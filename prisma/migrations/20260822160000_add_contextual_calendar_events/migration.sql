CREATE TABLE "ContextualCalendarEvent" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "locationName" TEXT,
    "description" TEXT,
    "impactLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextualCalendarEvent_pkey"
      PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "ContextualCalendarEvent_source_externalId_key"
ON "ContextualCalendarEvent"(
  "source",
  "externalId"
);

CREATE INDEX
  "ContextualCalendarEvent_startsAt_endsAt_idx"
ON "ContextualCalendarEvent"(
  "startsAt",
  "endsAt"
);

CREATE INDEX
  "ContextualCalendarEvent_category_startsAt_idx"
ON "ContextualCalendarEvent"(
  "category",
  "startsAt"
);

CREATE INDEX
  "ContextualCalendarEvent_active_startsAt_idx"
ON "ContextualCalendarEvent"(
  "active",
  "startsAt"
);
