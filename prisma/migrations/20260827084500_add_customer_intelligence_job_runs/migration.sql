CREATE TABLE "CustomerIntelligenceJobRun" (
  "id" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "source" TEXT NOT NULL DEFAULT 'CRON',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "selected" INTEGER NOT NULL DEFAULT 0,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "succeeded" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "hasMore" BOOLEAN,
  "message" TEXT,
  "error" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerIntelligenceJobRun_pkey"
    PRIMARY KEY ("id")
);

CREATE INDEX
  "CustomerIntelligenceJobRun_jobKey_startedAt_idx"
ON "CustomerIntelligenceJobRun"(
  "jobKey",
  "startedAt"
);

CREATE INDEX
  "CustomerIntelligenceJobRun_status_startedAt_idx"
ON "CustomerIntelligenceJobRun"(
  "status",
  "startedAt"
);

CREATE INDEX
  "CustomerIntelligenceJobRun_startedAt_idx"
ON "CustomerIntelligenceJobRun"(
  "startedAt"
);
