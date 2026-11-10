-- Owner-run additive install for My workspace + previously approved time-tag rules.
-- Safe to run after the earlier tag-only installer: existing rules/layouts are preserved.
-- No Booking updates, bulk tag run, message sending or runtime flag changes.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
DO $$ BEGIN
 IF current_database()<>'postgres' OR to_regclass('public."Booking"') IS NULL OR to_regclass('public."User"') IS NULL OR to_regclass('public."CustomerBehaviourTag"') IS NULL THEN RAISE EXCEPTION 'Unexpected shared database target'; END IF;
 IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public."User"'::regclass)<>current_user OR (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public."Booking"'::regclass)<>current_user THEN RAISE EXCEPTION 'Run as the existing table owner'; END IF;
 IF to_regclass('public."CustomerTimeTagConfiguration"') IS NULL THEN
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
 END IF;
 IF to_regclass('public."UserWorkspacePreference"') IS NULL THEN
CREATE TABLE public."UserWorkspacePreference" (
 "userId" TEXT NOT NULL PRIMARY KEY,
 revision INTEGER NOT NULL DEFAULT 1,
 configuration JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "UserWorkspacePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
 END IF;
END $$;
DO $$ DECLARE expected record; actual text; BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('CustomerTimeTagConfiguration','id','text'),('CustomerTimeTagConfiguration','revision','integer'),('CustomerTimeTagConfiguration','rules','jsonb'),('CustomerTimeTagConfiguration','updatedById','text'),('CustomerTimeTagConfiguration','createdAt','timestamp(3) without time zone'),('CustomerTimeTagConfiguration','updatedAt','timestamp(3) without time zone'),
 ('UserWorkspacePreference','userId','text'),('UserWorkspacePreference','revision','integer'),('UserWorkspacePreference','configuration','jsonb'),('UserWorkspacePreference','createdAt','timestamp(3) without time zone'),('UserWorkspacePreference','updatedAt','timestamp(3) without time zone')) AS x(relation,column_name,column_type)
 LOOP
  SELECT format_type(atttypid,atttypmod) INTO actual FROM pg_attribute WHERE attrelid=to_regclass(format('public.%I',expected.relation)) AND attname=expected.column_name AND NOT attisdropped;
  IF actual IS DISTINCT FROM expected.column_type THEN RAISE EXCEPTION 'Unexpected schema for %.%',expected.relation,expected.column_name; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public."CustomerTimeTagConfiguration" WHERE id='default' AND revision>0 AND jsonb_typeof(rules)='array') THEN RAISE EXCEPTION 'Existing time-tag configuration needs inspection'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public."UserWorkspacePreference"'::regclass AND contype='f' AND confrelid='public."User"'::regclass AND confdeltype='c' AND confupdtype='c') THEN RAISE EXCEPTION 'Unexpected workspace user relation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public."UserWorkspacePreference"'::regclass AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY ("userId")') THEN RAISE EXCEPTION 'Unexpected workspace primary key'; END IF;
END $$;
REVOKE ALL ON public."CustomerTimeTagConfiguration",public."UserWorkspacePreference" FROM PUBLIC,taxicrm_shared_app,needacabplus_shared_app;
GRANT SELECT,INSERT,UPDATE ON public."CustomerTimeTagConfiguration",public."UserWorkspacePreference" TO taxicrm_shared_app;
GRANT SELECT ON public."CustomerTimeTagConfiguration",public."UserWorkspacePreference" TO cabby_ro;
DO $$ DECLARE relation text; BEGIN
 FOREACH relation IN ARRAY ARRAY['CustomerTimeTagConfiguration','UserWorkspacePreference'] LOOP
  IF has_table_privilege('taxicrm_shared_app',to_regclass(format('public.%I',relation)),'DELETE') OR has_table_privilege('needacabplus_shared_app',to_regclass(format('public.%I',relation)),'INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Unexpected inherited privilege on %',relation; END IF;
 END LOOP;
END $$;
SELECT current_database(),current_user,
 (SELECT count(*) FROM public."CustomerTimeTagConfiguration") AS rule_configurations,
 (SELECT count(*) FROM public."UserWorkspacePreference") AS saved_workspaces;
COMMIT;
