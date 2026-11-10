-- Exact owner-reviewed installation; do not run the full shared migration chain.
-- Metadata-only relaxation. No data updates, table creation, grants or booking changes.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
DO $$
DECLARE target regclass := to_regclass('public."CustomerBookingPrediction"');
BEGIN
  IF current_database() <> 'postgres' OR target IS NULL
     OR to_regclass('public."Booking"') IS NULL THEN
    RAISE EXCEPTION 'Unexpected shared database target';
  END IF;
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=target) <> current_user THEN
    RAISE EXCEPTION 'Run as the existing prediction-table owner, not an analytical/application role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=target AND attname='observedRate'
    AND NOT attisdropped AND format_type(atttypid,atttypmod)='numeric(6,2)') THEN
    RAISE EXCEPTION 'Unexpected observedRate column';
  END IF;
END $$;
ALTER TABLE public."CustomerBookingPrediction" ALTER COLUMN "observedRate" DROP NOT NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute
    WHERE attrelid='public."CustomerBookingPrediction"'::regclass
      AND attname='observedRate' AND attnotnull) THEN
    RAISE EXCEPTION 'Nullable benchmark verification failed';
  END IF;
END $$;
SELECT current_database() AS database_name, current_user AS migration_owner,
       NOT attnotnull AS observed_rate_nullable
FROM pg_attribute WHERE attrelid='public."CustomerBookingPrediction"'::regclass
  AND attname='observedRate';
COMMIT;
