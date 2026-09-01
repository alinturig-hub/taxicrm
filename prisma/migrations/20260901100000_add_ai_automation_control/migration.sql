CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DISABLED',
  "mode" TEXT NOT NULL DEFAULT 'SIMULATION',
  "requiresApproval" BOOLEAN NOT NULL DEFAULT TRUE,
  "expectedIntervalMin" INTEGER NOT NULL,
  "defaultBatchSize" INTEGER NOT NULL,
  "configuration" JSONB NOT NULL,
  "lastSimulatedAt" TIMESTAMP(3),
  "lastExecutedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "AutomationExecution" (
  "id" TEXT NOT NULL,
  "executionKey" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "requestedByUserId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "selected" INTEGER NOT NULL DEFAULT 0,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "succeeded" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "hasMore" BOOLEAN,
  "evidence" JSONB NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationExecution_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "AutomationRule_key_key"
ON "AutomationRule"("key");

CREATE UNIQUE INDEX
  "AutomationRule_jobKey_key"
ON "AutomationRule"("jobKey");

CREATE INDEX
  "AutomationRule_status_mode_idx"
ON "AutomationRule"("status", "mode");

CREATE INDEX
  "AutomationRule_jobKey_idx"
ON "AutomationRule"("jobKey");

CREATE UNIQUE INDEX
  "AutomationExecution_executionKey_key"
ON "AutomationExecution"("executionKey");

CREATE INDEX
  "AutomationExecution_ruleId_startedAt_idx"
ON "AutomationExecution"("ruleId", "startedAt");

CREATE INDEX
  "AutomationExecution_status_startedAt_idx"
ON "AutomationExecution"("status", "startedAt");

CREATE INDEX
  "AutomationExecution_requestedByUserId_startedAt_idx"
ON "AutomationExecution"(
  "requestedByUserId",
  "startedAt"
);

ALTER TABLE "AutomationExecution"
ADD CONSTRAINT
  "AutomationExecution_ruleId_fkey"
FOREIGN KEY ("ruleId")
REFERENCES "AutomationRule"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

INSERT INTO "AdministrationPermission" (
  "id",
  "key",
  "module",
  "action",
  "name",
  "description",
  "updatedAt"
)
VALUES
  (
    'perm_automation_view',
    'automation.view',
    'AUTOMATION',
    'VIEW',
    'View automation',
    'View automation rules, simulations and aggregate execution evidence.',
    CURRENT_TIMESTAMP
  ),
  (
    'perm_automation_manage',
    'automation.manage',
    'AUTOMATION',
    'MANAGE',
    'Manage automation',
    'Simulate, approve and manage controlled automation rules.',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AdministrationRolePermission" (
  "roleId",
  "permissionId"
)
SELECT
  role.id,
  permission.id
FROM "AdministrationRole" role
CROSS JOIN "AdministrationPermission" permission
WHERE
  role."key" IN (
    'SUPER_ADMIN',
    'ADMIN'
  )
  AND permission."key" IN (
    'automation.view',
    'automation.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "AdministrationRolePermission" (
  "roleId",
  "permissionId"
)
SELECT
  role.id,
  permission.id
FROM "AdministrationRole" role
CROSS JOIN "AdministrationPermission" permission
WHERE
  role."key" = 'OPERATIONS_MANAGER'
  AND permission."key" IN (
    'automation.view',
    'automation.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO "AdministrationRolePermission" (
  "roleId",
  "permissionId"
)
SELECT
  role.id,
  permission.id
FROM "AdministrationRole" role
CROSS JOIN "AdministrationPermission" permission
WHERE
  role."key" = 'ANALYST'
  AND permission."key" =
    'automation.view'
ON CONFLICT DO NOTHING;

INSERT INTO "AutomationRule" (
  "id",
  "key",
  "name",
  "description",
  "jobKey",
  "status",
  "mode",
  "requiresApproval",
  "expectedIntervalMin",
  "defaultBatchSize",
  "configuration",
  "updatedAt"
)
VALUES
  (
    'automation_booking_predictions',
    'BOOKING_PREDICTION_MAINTENANCE',
    'Booking prediction maintenance',
    'Evaluate expired predictions and refresh customer booking signals.',
    'CUSTOMER_BOOKING_PREDICTIONS',
    'DISABLED',
    'SIMULATION',
    TRUE,
    15,
    50,
    '{"externalActions":false,"customerContact":false,"existingCronPreserved":true}'::jsonb,
    CURRENT_TIMESTAMP
  ),
  (
    'automation_demand_forecast',
    'BOOKING_DEMAND_FORECAST',
    'Booking demand forecast',
    'Maintain the unique booking-request forecast for the next 24 hours.',
    'BOOKING_DEMAND_FORECAST',
    'DISABLED',
    'SIMULATION',
    TRUE,
    180,
    1,
    '{"externalActions":false,"customerContact":false,"existingCronPreserved":true}'::jsonb,
    CURRENT_TIMESTAMP
  ),
  (
    'automation_profile_snapshots',
    'CUSTOMER_PROFILE_SNAPSHOTS',
    'Customer profile snapshots',
    'Create privacy-safe daily customer intelligence snapshots.',
    'CUSTOMER_PROFILE_SNAPSHOTS',
    'DISABLED',
    'SIMULATION',
    TRUE,
    1440,
    50,
    '{"externalActions":false,"customerContact":false,"existingCronPreserved":true}'::jsonb,
    CURRENT_TIMESTAMP
  ),
  (
    'automation_historical_geoapify',
    'HISTORICAL_GEOAPIFY_BACKFILL',
    'Historical place enrichment',
    'Enrich historical booking locations within the controlled provider allowance.',
    'HISTORICAL_GEOAPIFY_BACKFILL',
    'DISABLED',
    'SIMULATION',
    TRUE,
    1440,
    100,
    '{"externalActions":true,"customerContact":false,"existingCronPreserved":true,"creditControlled":true}'::jsonb,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AdministrationAuditEvent" (
  "id",
  "action",
  "targetType",
  "evidence",
  "occurredAt"
)
VALUES (
  'audit_ai_automation_initialized',
  'AI_AUTOMATION_INITIALIZED',
  'SYSTEM',
  '{"containsPersonalData":false,"rules":4,"defaultMode":"SIMULATION","allRulesDisabled":true,"existingCronsPreserved":true}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
