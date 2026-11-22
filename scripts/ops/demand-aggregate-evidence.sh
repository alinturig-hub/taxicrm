#!/bin/sh
# Fixed aggregate demand diagnostic; requires no arguments and consumes no user input.
set -eu
if [ "$#" -ne 0 ]; then printf '%s\n' 'No arguments allowed.' >&2; exit 64; fi
exec /usr/bin/env -i PATH=/usr/bin:/bin HOME=/nonexistent \
  /usr/bin/docker --host=unix:///var/run/docker.sock exec -i --user postgres \
  q9fahphg3lydu18inysgmerq \
  psql -X -w -U cabby_ro -d postgres -v ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='2s';
SET LOCAL TIME ZONE 'UTC';
DO $$ BEGIN
 IF current_database() <> 'postgres' OR current_user <> 'cabby_ro'
 OR current_setting('transaction_read_only') <> 'on'
 OR to_regclass('public."Booking"') IS NULL THEN
  RAISE EXCEPTION 'Unexpected database or role';
 END IF;
END $$;
SELECT current_database() AS database_name, current_user AS inspection_role,
 current_setting('transaction_read_only') AS read_only, now() AS checked_at;
SELECT count(*) AS canonical_bookings, max("updatedAt") AS latest_booking_update_utc
FROM public."Booking";
WITH cohort AS MATERIALIZED (
 SELECT id, "pickupDueTime", "bookedAtTime", "createdAt"
 FROM public."Booking"
 WHERE "pickupDueTime" >= (now() AT TIME ZONE 'UTC') - interval '7 days'
 AND "pickupDueTime" < (now() AT TIME ZONE 'UTC') - interval '1 day'
), evaluated AS (
 SELECT b.*,
  b."pickupDueTime" - interval '24 hours' AS cutoff,
  EXISTS (
   SELECT 1 FROM public."BookingSnapshot" s
   WHERE s."bookingId"=b.id
    AND s."createdAt" <= b."pickupDueTime" - interval '24 hours'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(
       CASE WHEN jsonb_typeof(s.snapshot::jsonb->'locations')='array'
        THEN s.snapshot::jsonb->'locations' ELSE '[]'::jsonb END
      ) loc
      WHERE loc->>'type'='PICKUP' AND NULLIF(trim(loc->>'zoneId'),'') IS NOT NULL
    )
  ) AS zone_in_snapshot_at_cutoff
 FROM cohort b
)
SELECT count(*) AS scheduled_pickups,
 count(*) FILTER (WHERE "bookedAtTime" IS NOT NULL AND "createdAt" <= cutoff AND "bookedAtTime" <= cutoff) AS booking_known_24h_before,
 count(*) FILTER (WHERE "bookedAtTime" IS NOT NULL AND "createdAt" <= cutoff AND "bookedAtTime" <= cutoff AND zone_in_snapshot_at_cutoff) AS zone_in_saved_snapshot_24h_before,
 count(*) FILTER (WHERE "bookedAtTime" IS NULL) AS missing_booking_time
FROM evaluated;
ROLLBACK;
SQL
