-- Additive; no edits to existing webhook receipts or outbound claims.
CREATE TABLE "WhatsAppConversation" (
 id TEXT PRIMARY KEY, scope TEXT NOT NULL, participant TEXT NOT NULL,
 mode TEXT NOT NULL DEFAULT 'AUTOMATED' CHECK(mode IN ('AUTOMATED','OPERATOR')),
 revision INTEGER NOT NULL DEFAULT 0, "assignedUserId" TEXT,
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(scope,participant)
);
CREATE TABLE "WhatsAppMessage" (
 id BIGSERIAL PRIMARY KEY, scope TEXT NOT NULL, "conversationId" TEXT NOT NULL REFERENCES "WhatsAppConversation"(id),
 "providerMessageId" TEXT NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('INBOUND','OUTBOUND')),
 content JSONB NOT NULL, status TEXT NOT NULL, "occurredAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(scope,"providerMessageId")
);
CREATE INDEX ON "WhatsAppMessage"("conversationId",id);
CREATE TABLE "WhatsAppSharedEvent" (
 id BIGSERIAL PRIMARY KEY, scope TEXT NOT NULL, "eventKey" TEXT NOT NULL, type TEXT NOT NULL, payload JSONB NOT NULL,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "deliveredAt" TIMESTAMPTZ,
 attempts INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(scope,"eventKey")
);
CREATE TABLE "WhatsAppServiceNonce" (id TEXT PRIMARY KEY,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE "WhatsAppHandoffCommand" (scope TEXT NOT NULL,id TEXT NOT NULL,"requestHash" TEXT NOT NULL,result JSONB NOT NULL,PRIMARY KEY(scope,id));
CREATE TABLE "WhatsAppServiceIntent" (
 id TEXT PRIMARY KEY, scope TEXT NOT NULL, "operationKey" TEXT NOT NULL,"requestHash" TEXT NOT NULL,
 "conversationId" TEXT NOT NULL REFERENCES "WhatsAppConversation"(id), payload JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'HELD' CHECK(status IN ('HELD','CANCELLED','EXPIRED')),
 "expiresAt" TIMESTAMPTZ NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(scope,"operationKey")
);
-- Intents remain HELD until approved template bindings and provider dispatch are enabled separately.
