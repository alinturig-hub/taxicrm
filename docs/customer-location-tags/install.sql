BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DO $$
BEGIN
 IF current_database() <> 'postgres' OR to_regclass('public."Booking"') IS NULL OR to_regclass('public."CustomerTimeTagConfiguration"') IS NULL THEN
  RAISE EXCEPTION 'Unexpected database or missing prerequisite';
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='CustomerTimeTagConfiguration' AND column_name='placeRules' AND data_type <> 'jsonb') THEN
  RAISE EXCEPTION 'Existing placeRules column has an unexpected type';
 END IF;
END $$;
ALTER TABLE public."CustomerTimeTagConfiguration" ADD COLUMN IF NOT EXISTS "placeRules" JSONB;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='taxicrm_shared_app') OR NOT has_column_privilege('taxicrm_shared_app','public."CustomerTimeTagConfiguration"','placeRules','SELECT') OR NOT has_column_privilege('taxicrm_shared_app','public."CustomerTimeTagConfiguration"','placeRules','UPDATE') THEN
  RAISE EXCEPTION 'TaxiCRM application role lacks the required column privileges';
 END IF;
END $$;
SELECT current_database() AS database_name, current_user AS migration_role, 'ready' AS location_rules_column;
COMMIT;
