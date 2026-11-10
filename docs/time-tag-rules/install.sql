-- Owner-run write: new configuration only; no Booking changes or bulk tag run.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
DO $$ BEGIN
 IF current_database()<>'postgres' OR to_regclass('public."Booking"') IS NULL OR to_regclass('public."CustomerBehaviourTag"') IS NULL THEN RAISE EXCEPTION 'Unexpected database target'; END IF;
 IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public."CustomerBehaviourTag"'::regclass)<>current_user THEN RAISE EXCEPTION 'Run as existing table owner'; END IF;
 IF to_regclass('public."CustomerTimeTagConfiguration"') IS NOT NULL THEN RAISE EXCEPTION 'Already installed; inspect before rerunning'; END IF;
END $$;
CREATE TABLE public."CustomerTimeTagConfiguration" (
 id TEXT NOT NULL PRIMARY KEY,
 revision INTEGER NOT NULL DEFAULT 1,
 rules JSONB NOT NULL,
 "updatedById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
INSERT INTO public."CustomerTimeTagConfiguration" (id,revision,rules,"updatedById","updatedAt")
VALUES ('default',1,'[{"id": "EARLY_MORNING_USER", "name": "Early Morning User", "start": "04:00", "end": "08:00", "windowDays": 14, "minimumMatches": 3, "minimumPercent": 40, "enabled": true}, {"id": "LATE_EVENING_USER", "name": "Late Evening User", "start": "22:00", "end": "04:00", "windowDays": 14, "minimumMatches": 3, "minimumPercent": 40, "enabled": true}]'::jsonb,'OWNER_INSTALL',CURRENT_TIMESTAMP);
REVOKE ALL ON public."CustomerTimeTagConfiguration" FROM PUBLIC, taxicrm_shared_app, needacabplus_shared_app;
GRANT SELECT, INSERT, UPDATE ON public."CustomerTimeTagConfiguration" TO taxicrm_shared_app;
GRANT SELECT ON public."CustomerTimeTagConfiguration" TO cabby_ro;
DO $$ BEGIN
 IF has_table_privilege('taxicrm_shared_app','public."CustomerTimeTagConfiguration"','DELETE') OR has_table_privilege('needacabplus_shared_app','public."CustomerTimeTagConfiguration"','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Unexpected effective privileges'; END IF;
END $$;
SELECT current_database(),current_user,revision,jsonb_array_length(rules) AS initial_rules FROM public."CustomerTimeTagConfiguration" WHERE id='default';
COMMIT;
