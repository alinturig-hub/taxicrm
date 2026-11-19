BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT current_database(),current_user,current_setting('transaction_read_only') AS read_only,now() AS checked_at;
SELECT to_regclass('public."Booking"') IS NOT NULL AS canonical_booking_present,
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname='taxicrm_shared_app' AND NOT rolsuper AND NOT rolbypassrls) AS restricted_app_role_present;
SELECT name,to_regclass(name) IS NOT NULL AS present FROM unnest(ARRAY['public.email_templates','public.email_campaigns','public.email_campaign_recipients','public.email_suppressions','public.email_campaign_events']) AS name;
SELECT pg_get_userbyid(defaclrole) AS owner,coalesce(n.nspname,'global') AS schema,defaclobjtype,defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE pg_get_userbyid(defaclrole)='postgres';
ROLLBACK;
