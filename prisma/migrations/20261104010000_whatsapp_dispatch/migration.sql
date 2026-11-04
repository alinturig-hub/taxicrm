ALTER TABLE "WhatsAppServiceIntent" DROP CONSTRAINT "WhatsAppServiceIntent_status_check";
ALTER TABLE "WhatsAppServiceIntent" ADD CONSTRAINT "WhatsAppServiceIntent_status_check" CHECK(status IN ('HELD','SENDING','ACCEPTED','UNKNOWN','REJECTED','CANCELLED','EXPIRED'));
ALTER TABLE "WhatsAppServiceIntent" ADD COLUMN "outboundId" TEXT, ADD COLUMN "lastReason" TEXT, ADD COLUMN "claimedAt" TIMESTAMPTZ;
ALTER TABLE "WhatsAppServiceIntent" ADD COLUMN "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT now(), ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "WhatsAppRecipientGrant" (
 scope TEXT NOT NULL, recipient TEXT NOT NULL, "customerId" TEXT NOT NULL,
 "serviceAllowed" BOOLEAN NOT NULL DEFAULT false, suppressed BOOLEAN NOT NULL DEFAULT false,
 "verifiedAt" TIMESTAMPTZ NOT NULL, "validUntil" TIMESTAMPTZ NOT NULL,
 "proofType" TEXT NOT NULL CHECK("proofType" IN ('OTP','OPERATOR_VERIFIED','SIGNED_ACCOUNT')),
 "proofReference" TEXT NOT NULL, "updatedBy" TEXT NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(scope,recipient)
);
CREATE TABLE "WhatsAppTemplateBinding" (
 scope TEXT NOT NULL, milestone TEXT NOT NULL, name TEXT NOT NULL, language TEXT NOT NULL,
 "parameterKeys" JSONB NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false,
 "updatedBy" TEXT NOT NULL,"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(scope,milestone)
);
CREATE TABLE "WhatsAppPolicyAudit" (
 id BIGSERIAL PRIMARY KEY,scope TEXT NOT NULL,actor TEXT NOT NULL,type TEXT NOT NULL,payload JSONB NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "WhatsAppServiceIntent"(scope,status,"expiresAt");
