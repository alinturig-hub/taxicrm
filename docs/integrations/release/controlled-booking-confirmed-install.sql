-- OWNER REVIEW REQUIRED. Do not run without approval of this exact file hash.
-- Shared postgres database only, migration owner postgres. Atomic, additive schema/ACL installation.
-- Creates five empty tables, one sequence, indexes/constraints, one SECURITY DEFINER function
-- owned by postgres and six row triggers (including Booking/BookingLocation).
-- No booking/customer row changes, notification activation, sending, retry or Prisma history replay.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=public;
DO $preconditions$
DECLARE name text; role_name text;
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres' THEN
  RAISE EXCEPTION 'Unexpected database or migration owner';
 END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('controlled-booking-confirmed-install-v1',0)) THEN
  RAISE EXCEPTION 'Another controlled install is running';
 END IF;
 FOREACH name IN ARRAY ARRAY['public."Booking"','public."BookingLocation"','public.customer_accounts',
  'public.web_booking_attempts','public.whatsapp_service_nonce','public.whatsapp_event_inbox',
  'public."WhatsAppConversation"','public."WhatsAppMessage"','public."WhatsAppSharedEvent"',
  'public."WhatsAppRecipientGrant"','public."WhatsAppOutboundMessage"','public._prisma_migrations'] LOOP
  IF to_regclass(name) IS NULL THEN RAISE EXCEPTION 'Missing prerequisite: %',name; END IF;
 END LOOP;
 FOREACH name IN ARRAY ARRAY['public."Booking"','public."BookingLocation"','public."WhatsAppOutboundMessage"'] LOOP
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=to_regclass(name))<>'postgres' THEN
   RAISE EXCEPTION 'Unexpected prerequisite owner: %',name;
  END IF;
 END LOOP;
 FOREACH role_name IN ARRAY ARRAY['needacabplus_shared_app','taxicrm_shared_app'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolbypassrls) THEN
   RAISE EXCEPTION 'Unexpected application role: %',role_name;
  END IF;
 END LOOP;
 FOREACH name IN ARRAY ARRAY['public.notification_rules','public.notification_rule_revisions',
  'public.notification_decisions','public.notification_decisions_id_seq','public.notification_decisions_filter',
  'public.notification_controlled_events','public."WhatsAppControlledDispatch"'] LOOP
  IF to_regclass(name) IS NOT NULL THEN RAISE EXCEPTION 'Already present; stop without replay: %',name; END IF;
 END LOOP;
 IF to_regprocedure('public.controlled_booking_fence()') IS NOT NULL OR EXISTS(
  SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('controlled_booking_fence','controlled_locations_fence',
   'controlled_rules_fence','controlled_accounts_fence','controlled_attempts_fence','controlled_permissions_fence')) THEN
  RAISE EXCEPTION 'Controlled function/trigger already exists';
 END IF;
 IF EXISTS(SELECT 1 FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) THEN
  RAISE EXCEPTION 'Unfinished Prisma migration; review before installation';
 END IF;
END $preconditions$;

-- Reviewed source: scripts/migrations/20261104_notifications_dry_run.sql
-- DEVELOPMENT ONLY. No changes to bookings, existing outboxes or send flags.
CREATE TABLE notification_rules (
 id text PRIMARY KEY, version integer NOT NULL CHECK(version>0), status text NOT NULL CHECK(status IN ('draft','active','disabled')),
 definition jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), mode text NOT NULL DEFAULT 'DRY_RUN' CHECK(mode='DRY_RUN')
);
CREATE TABLE notification_rule_revisions (
 rule_id text NOT NULL REFERENCES notification_rules(id), version integer NOT NULL,
 action text NOT NULL CHECK(action IN ('save','activate','disable')), definition jsonb NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(rule_id,version)
);
CREATE TABLE notification_decisions (
 id bigserial PRIMARY KEY, request_id uuid NOT NULL UNIQUE, rule_id text NOT NULL, rule_version integer NOT NULL,
 booking_id text NOT NULL CHECK(booking_id LIKE 'SYNTHETIC-%'), event text NOT NULL, channel text NOT NULL,
 result text NOT NULL, reason text NOT NULL, decision jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 mode text NOT NULL DEFAULT 'DRY_RUN' CHECK(mode='DRY_RUN')
);
CREATE INDEX notification_decisions_filter ON notification_decisions(rule_id,event,created_at DESC);

-- Reviewed source: scripts/migrations/20261105_controlled_booking_confirmed.sql
-- Development migration only. Never applied automatically by request handlers.
CREATE TABLE notification_controlled_events(
 operation_key text PRIMARY KEY, request_id uuid NOT NULL UNIQUE,scope text NOT NULL,
 intent jsonb NOT NULL CHECK(intent->>'booking_id' IS NOT NULL AND intent->>'booking_id'='autocab:SYNTHETIC-BC-53fd75f0-eb4d-4042-8ee6-92ebcc845f9d'),
 request jsonb NOT NULL, fence bigint NOT NULL DEFAULT 0,
 result jsonb,provider_message_id text,status text NOT NULL DEFAULT 'CREATED',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION controlled_booking_fence() RETURNS trigger AS $$
DECLARE r jsonb := COALESCE(to_jsonb(NEW),to_jsonb(OLD)); o jsonb := to_jsonb(OLD);
BEGIN
 -- Only the bound synthetic booking, its associations, saved rule and recipient can invalidate this trial.
 IF TG_TABLE_NAME='Booking' THEN
  IF r->>'externalId' IS DISTINCT FROM 'SYNTHETIC-BC-53fd75f0-eb4d-4042-8ee6-92ebcc845f9d' AND o->>'externalId' IS DISTINCT FROM 'SYNTHETIC-BC-53fd75f0-eb4d-4042-8ee6-92ebcc845f9d' THEN RETURN NULL; END IF;
 ELSIF TG_TABLE_NAME='BookingLocation' THEN
  IF NOT EXISTS(SELECT 1 FROM public."Booking" WHERE id IN (r->>'bookingId',o->>'bookingId') AND "externalId"='SYNTHETIC-BC-53fd75f0-eb4d-4042-8ee6-92ebcc845f9d') THEN RETURN NULL; END IF;
 ELSIF TG_TABLE_NAME='notification_rules' THEN
  IF NOT EXISTS(SELECT 1 FROM public.notification_controlled_events WHERE intent#>>'{rule,id}' IN (r->>'id',o->>'id')) THEN RETURN NULL; END IF;
 ELSIF TG_TABLE_NAME='web_booking_attempts' THEN
  IF r->>'external_booking_id' IS DISTINCT FROM 'SYNTHETIC-BC-53fd75f0-eb4d-4042-8ee6-92ebcc845f9d' AND o->>'external_booking_id' IS DISTINCT FROM 'SYNTHETIC-BC-53fd75f0-eb4d-4042-8ee6-92ebcc845f9d' THEN RETURN NULL; END IF;
 ELSIF TG_TABLE_NAME='customer_accounts' THEN
  IF NOT EXISTS(SELECT 1 FROM public.web_booking_attempts WHERE external_booking_id='SYNTHETIC-BC-53fd75f0-eb4d-4042-8ee6-92ebcc845f9d' AND user_id IN (r->>'id',o->>'id')) THEN RETURN NULL; END IF;
 ELSIF TG_TABLE_NAME='WhatsAppRecipientGrant' THEN
  IF NOT EXISTS(SELECT 1 FROM public.notification_controlled_events WHERE (intent->>'recipient'=r->>'recipient' AND scope=r->>'scope') OR (intent->>'recipient'=o->>'recipient' AND scope=o->>'scope')) THEN RETURN NULL; END IF;
 ELSE RETURN NULL;
 END IF;
 UPDATE public.notification_controlled_events SET fence=fence+1 WHERE status IN ('CREATED','SENDING','UNKNOWN');
 RETURN NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp;
CREATE TRIGGER controlled_booking_fence AFTER INSERT OR UPDATE OR DELETE ON "Booking" FOR EACH ROW EXECUTE FUNCTION controlled_booking_fence();
CREATE TRIGGER controlled_locations_fence AFTER INSERT OR UPDATE OR DELETE ON "BookingLocation" FOR EACH ROW EXECUTE FUNCTION controlled_booking_fence();
CREATE TRIGGER controlled_rules_fence AFTER INSERT OR UPDATE OR DELETE ON notification_rules FOR EACH ROW EXECUTE FUNCTION controlled_booking_fence();
CREATE TRIGGER controlled_accounts_fence AFTER INSERT OR UPDATE OR DELETE ON customer_accounts FOR EACH ROW EXECUTE FUNCTION controlled_booking_fence();
CREATE TRIGGER controlled_attempts_fence AFTER INSERT OR UPDATE OR DELETE ON web_booking_attempts FOR EACH ROW EXECUTE FUNCTION controlled_booking_fence();
CREATE TRIGGER controlled_permissions_fence AFTER INSERT OR UPDATE OR DELETE ON "WhatsAppRecipientGrant" FOR EACH ROW EXECUTE FUNCTION controlled_booking_fence();

-- Reviewed source: prisma/migrations/20261105090000_controlled_booking_confirmed/migration.sql
-- Prepared only: never applied automatically by the controlled request handler.
CREATE TABLE "WhatsAppControlledDispatch"(
 scope text NOT NULL,operation_key text NOT NULL,request_hash text NOT NULL,intent jsonb NOT NULL CHECK(intent->>'booking_id' IS NOT NULL AND intent->>'booking_id'='autocab:SYNTHETIC-BC-53fd75f0-eb4d-4042-8ee6-92ebcc845f9d'),
 status text NOT NULL DEFAULT 'VALIDATING' CHECK(status IN ('VALIDATING','SENDING','BLOCKED','UNKNOWN','REJECTED','ACCEPTED','SENT','DELIVERED','READ','FAILED')),result jsonb,provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(scope,operation_key)
);

-- v2: postgres default ACLs grant CRUD on new tables to TaxiCRM in the live database.
-- Normalize ONLY the five relations and sequence created above in this transaction.
-- Preserve global/schema default ACLs, cabby_ro SELECT and ALL pre-existing objects/ACLs.
REVOKE ALL PRIVILEGES ON TABLE public.notification_rules, public.notification_rule_revisions,
 public.notification_decisions, public.notification_controlled_events, public."WhatsAppControlledDispatch"
 FROM taxicrm_shared_app, needacabplus_shared_app, PUBLIC;
REVOKE ALL PRIVILEGES ON SEQUENCE public.notification_decisions_id_seq
 FROM taxicrm_shared_app, needacabplus_shared_app, PUBLIC;

-- Reviewed source: docs/integrations/release/controlled_booking_confirmed_grants.sql
-- REVIEW ONLY. Apply once to the approved shared database after both table migrations.
-- Additive ACL delta; does not create roles, change logins/owners, grant DELETE or touch bookings.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='needacabplus_shared_app') THEN
  RAISE EXCEPTION 'Expected NAC runtime role is missing';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='taxicrm_shared_app') THEN
  RAISE EXCEPTION 'Expected TaxiCRM runtime role is missing';
 END IF;
 IF to_regclass('public.notification_rules') IS NULL
 OR to_regclass('public.notification_rule_revisions') IS NULL
 OR to_regclass('public.notification_decisions') IS NULL
 OR to_regclass('public.notification_decisions_id_seq') IS NULL
 OR to_regclass('public.notification_controlled_events') IS NULL
 OR to_regclass('public."WhatsAppControlledDispatch"') IS NULL
 OR to_regclass('public."WhatsAppOutboundMessage"') IS NULL THEN
  RAISE EXCEPTION 'Required reviewed notification tables/sequence are missing';
 END IF;
END $$;

GRANT USAGE ON SCHEMA public TO needacabplus_shared_app, taxicrm_shared_app;

-- NAC Notifications rule/preview persistence introduced earlier in draft PR31.
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_rules TO needacabplus_shared_app;
GRANT SELECT, INSERT ON TABLE public.notification_rule_revisions TO needacabplus_shared_app;
GRANT SELECT, INSERT ON TABLE public.notification_decisions TO needacabplus_shared_app;
GRANT USAGE, SELECT ON SEQUENCE public.notification_decisions_id_seq TO needacabplus_shared_app;

-- NAC owns event registration and status projection, but cannot delete/re-key it through these grants.
GRANT SELECT, INSERT ON TABLE public.notification_controlled_events TO needacabplus_shared_app;
GRANT UPDATE (status, result, provider_message_id)
 ON TABLE public.notification_controlled_events TO needacabplus_shared_app;

-- CRM reads/locks the canonical fence. FOR UPDATE requires an UPDATE privilege on at least one column.
GRANT SELECT (operation_key, fence), UPDATE (fence)
 ON TABLE public.notification_controlled_events TO taxicrm_shared_app;

-- CRM owns only the new controlled dispatch registration and its outcomes.
GRANT SELECT, INSERT ON TABLE public."WhatsAppControlledDispatch" TO taxicrm_shared_app;
GRANT UPDATE (status, result, provider_message_id)
 ON TABLE public."WhatsAppControlledDispatch" TO taxicrm_shared_app;

-- NAC's read-only activation preflight checks existence, not message bodies or recipient data.
GRANT SELECT (scope, operation_key)
 ON TABLE public."WhatsAppControlledDispatch" TO needacabplus_shared_app;
GRANT SELECT ("connectionKey", "operationKey")
 ON TABLE public."WhatsAppOutboundMessage" TO needacabplus_shared_app;

-- Existing shared nonce/inbox/event/outbox privileges are prerequisites, not broadened here.
-- In particular, this script grants no UPDATE on Booking/BookingLocation/customer records,
-- no CRM role access to NAC rule editing, and no permission to resend/reset prior operations.

DO $postconditions$
DECLARE name text; role_name text; rows_count bigint;
BEGIN
 FOREACH name IN ARRAY ARRAY['notification_rules','notification_rule_revisions','notification_decisions',
  'notification_controlled_events','WhatsAppControlledDispatch'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',name) INTO rows_count;
  IF rows_count<>0 THEN RAISE EXCEPTION 'New table unexpectedly nonempty: %',name; END IF;
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=to_regclass(format('public.%I',name)))<>'postgres' THEN
   RAISE EXCEPTION 'Unexpected new owner: %',name;
  END IF;
  FOREACH role_name IN ARRAY ARRAY['needacabplus_shared_app','taxicrm_shared_app'] LOOP
   IF has_table_privilege(role_name,to_regclass(format('public.%I',name)),'DELETE') THEN
    RAISE EXCEPTION 'Unexpected DELETE privilege from inherited/default ACL: %, %',role_name,name;
   END IF;
  END LOOP;
 END LOOP;
 -- Effective privileges must remain narrow after direct defaults are removed.
 FOREACH name IN ARRAY ARRAY['notification_rules','notification_rule_revisions','notification_decisions'] LOOP
  IF has_table_privilege('taxicrm_shared_app',to_regclass(format('public.%I',name)),'INSERT')
  OR has_any_column_privilege('taxicrm_shared_app',to_regclass(format('public.%I',name)),'UPDATE') THEN
   RAISE EXCEPTION 'Unexpected CRM rule/decision write privilege: %',name;
  END IF;
 END LOOP;
 IF has_table_privilege('taxicrm_shared_app','public.notification_controlled_events','UPDATE')
 OR has_column_privilege('taxicrm_shared_app','public.notification_controlled_events','intent','UPDATE')
 OR has_column_privilege('taxicrm_shared_app','public."WhatsAppControlledDispatch"','intent','UPDATE')
 OR has_column_privilege('needacabplus_shared_app','public.notification_controlled_events','intent','UPDATE')
 OR has_any_column_privilege('needacabplus_shared_app','public.notification_rule_revisions','UPDATE')
 OR has_any_column_privilege('needacabplus_shared_app','public.notification_decisions','UPDATE') THEN
  RAISE EXCEPTION 'Unexpected permission to modify immutable operation or audit data';
 END IF;
 IF (SELECT count(*) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
     WHERE NOT t.tgisinternal AND p.oid='public.controlled_booking_fence()'::regprocedure)<>6 THEN
  RAISE EXCEPTION 'Expected exactly six controlled triggers';
 END IF;
 IF NOT has_column_privilege('taxicrm_shared_app','public.notification_controlled_events','fence','UPDATE')
 OR NOT has_column_privilege('needacabplus_shared_app','public."WhatsAppOutboundMessage"','operationKey','SELECT')
 OR NOT has_table_privilege('taxicrm_shared_app','public."WhatsAppControlledDispatch"','INSERT') THEN
  RAISE EXCEPTION 'Required narrow runtime ACL missing';
 END IF;
END $postconditions$;
COMMIT;
