CREATE TABLE "MarketingEmailConnection" (
 "id" TEXT NOT NULL DEFAULT 'primary', "provider" TEXT NOT NULL, "config" JSONB NOT NULL,
 "secretCiphertext" TEXT NOT NULL, "pop3SecretCiphertext" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MarketingEmailConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MarketingEmailTemplate" (
 "id" TEXT NOT NULL, "name" TEXT NOT NULL, "subject" TEXT NOT NULL, "body" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "MarketingEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- Default privileges in existing installations can be broader than needed.
REVOKE ALL ON "MarketingEmailConnection", "MarketingEmailTemplate" FROM PUBLIC;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cabby_ro') THEN
   REVOKE ALL ON "MarketingEmailConnection", "MarketingEmailTemplate" FROM cabby_ro;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taxicrm_shared_app') THEN
   REVOKE ALL ON "MarketingEmailConnection", "MarketingEmailTemplate" FROM taxicrm_shared_app;
   GRANT SELECT, INSERT, UPDATE ON "MarketingEmailConnection", "MarketingEmailTemplate" TO taxicrm_shared_app;
 END IF;
END $$;
