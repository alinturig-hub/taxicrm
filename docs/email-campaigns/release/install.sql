-- Install only after confirming the intended live database and reviewing the release.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public,pg_catalog;
DO $$ BEGIN
 IF current_database() <> 'postgres' OR to_regclass('public."Booking"') IS NULL THEN RAISE EXCEPTION 'Unexpected database'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='taxicrm_shared_app') THEN RAISE EXCEPTION 'Missing application role'; END IF;
 IF to_regclass('public._prisma_migrations') IS NULL THEN RAISE EXCEPTION 'Prisma migration history is missing'; END IF;
 IF EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name='20261118120000_email_campaigns') THEN RAISE EXCEPTION 'Email migration already in Prisma history'; END IF;
 IF to_regclass('public.email_campaigns') IS NOT NULL OR to_regclass('public.email_templates') IS NOT NULL OR to_regclass('public.email_campaign_recipients') IS NOT NULL OR to_regclass('public.email_suppressions') IS NOT NULL OR to_regclass('public.email_campaign_events') IS NOT NULL THEN RAISE EXCEPTION 'Email campaign tables already exist'; END IF;
END $$;
-- CRM-owned email marketing records. Does not alter booking or customer tables.
CREATE TABLE email_templates (
 id uuid PRIMARY KEY, name text NOT NULL, subject text NOT NULL, body text NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE email_campaigns (
 id uuid PRIMARY KEY, name text NOT NULL, subject text NOT NULL, body text NOT NULL,
 sender_email text NOT NULL, sender_name text NOT NULL, schedule_at timestamptz,
 timezone text NOT NULL DEFAULT 'Europe/London', status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','PAUSED','CANCELLED','COMPLETED')),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE email_campaign_recipients (
 id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
 address text NOT NULL, consent_evidence text NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CLAIMED','ACCEPTED','REJECTED','UNKNOWN','SUPPRESSED','DELIVERED','BOUNCED')),
 claimed_at timestamptz, provider_message_id text, UNIQUE(campaign_id, address)
);
CREATE TABLE email_suppressions (
 address text PRIMARY KEY, source text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE email_campaign_events (
 id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES email_campaigns(id), recipient_id uuid REFERENCES email_campaign_recipients(id),
 event_type text NOT NULL, provider_event_id text UNIQUE, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_campaign_due_idx ON email_campaigns (schedule_at) WHERE status = 'SCHEDULED';
CREATE INDEX email_campaign_recipient_status_idx ON email_campaign_recipients (campaign_id, status);
REVOKE ALL ON email_templates,email_campaigns,email_campaign_recipients,email_suppressions,email_campaign_events FROM PUBLIC;
REVOKE ALL ON email_templates,email_campaigns,email_campaign_recipients,email_suppressions,email_campaign_events FROM taxicrm_shared_app;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cabby_ro') THEN
 REVOKE ALL ON email_templates,email_campaigns,email_campaign_recipients,email_suppressions,email_campaign_events FROM cabby_ro;
END IF; END $$;
GRANT SELECT,INSERT,UPDATE ON email_templates,email_campaigns,email_campaign_recipients,email_suppressions,email_campaign_events TO taxicrm_shared_app;
DO $$ DECLARE item text; BEGIN
 FOREACH item IN ARRAY ARRAY['email_templates','email_campaigns','email_campaign_recipients','email_suppressions','email_campaign_events'] LOOP
  IF has_table_privilege('taxicrm_shared_app',format('public.%I',item),'DELETE') THEN RAISE EXCEPTION 'Unexpected inherited DELETE privilege for %',item; END IF;
 END LOOP;
END $$;
INSERT INTO public._prisma_migrations (id,checksum,finished_at,migration_name,applied_steps_count) VALUES (gen_random_uuid()::text,'341e4a936ced8c96eb0e36e1dc46031e866e6e25bd89cd4d86b816247951b307',now(),'20261118120000_email_campaigns',0);
COMMIT;
