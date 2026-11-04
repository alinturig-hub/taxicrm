-- Synthetic staging operator schema, reused from existing application migrations.
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'OPERATOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "User"
ADD COLUMN
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN
  "lastLoginAt" TIMESTAMP(3),
ADD COLUMN
  "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN
  "deactivatedAt" TIMESTAMP(3);

CREATE TABLE "AdministrationRole" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdministrationRole_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "AdministrationPermission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdministrationPermission_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "AdministrationUserRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministrationUserRole_pkey"
    PRIMARY KEY ("userId", "roleId")
);

CREATE TABLE "AdministrationRolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministrationRolePermission_pkey"
    PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "AdministrationAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "evidence" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministrationAuditEvent_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "AdministrationRole_key_key"
ON "AdministrationRole"("key");

CREATE INDEX
  "AdministrationRole_isActive_name_idx"
ON "AdministrationRole"("isActive", "name");

CREATE UNIQUE INDEX
  "AdministrationPermission_key_key"
ON "AdministrationPermission"("key");

CREATE INDEX
  "AdministrationPermission_module_action_idx"
ON "AdministrationPermission"("module", "action");

CREATE INDEX
  "AdministrationUserRole_roleId_idx"
ON "AdministrationUserRole"("roleId");

CREATE INDEX
  "AdministrationUserRole_assignedAt_idx"
ON "AdministrationUserRole"("assignedAt");

CREATE INDEX
  "AdministrationRolePermission_permissionId_idx"
ON "AdministrationRolePermission"("permissionId");

CREATE INDEX
  "AdministrationAuditEvent_actorUserId_occurredAt_idx"
ON "AdministrationAuditEvent"("actorUserId", "occurredAt");

CREATE INDEX
  "AdministrationAuditEvent_targetType_targetId_occurredAt_idx"
ON "AdministrationAuditEvent"(
  "targetType",
  "targetId",
  "occurredAt"
);

CREATE INDEX
  "AdministrationAuditEvent_action_occurredAt_idx"
ON "AdministrationAuditEvent"("action", "occurredAt");

ALTER TABLE "AdministrationUserRole"
ADD CONSTRAINT
  "AdministrationUserRole_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AdministrationUserRole"
ADD CONSTRAINT
  "AdministrationUserRole_roleId_fkey"
FOREIGN KEY ("roleId")
REFERENCES "AdministrationRole"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AdministrationRolePermission"
ADD CONSTRAINT
  "AdministrationRolePermission_roleId_fkey"
FOREIGN KEY ("roleId")
REFERENCES "AdministrationRole"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AdministrationRolePermission"
ADD CONSTRAINT
  "AdministrationRolePermission_permissionId_fkey"
FOREIGN KEY ("permissionId")
REFERENCES "AdministrationPermission"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AdministrationAuditEvent"
ADD CONSTRAINT
  "AdministrationAuditEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;


CREATE TABLE "WhatsAppWebhookInbox"(id text PRIMARY KEY,"connectionKey" text NOT NULL,"rawBody" text NOT NULL,"receivedAt" timestamptz DEFAULT now());
