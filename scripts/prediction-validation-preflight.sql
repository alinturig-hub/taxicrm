-- Read-only source-quality inventory. Does not export customers or establish
-- ingestion coverage. Run only against the documented shared primary as cabby_ro.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
DO $$
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'cabby_ro' THEN
    RAISE EXCEPTION 'Expected postgres database and cabby_ro analytical role';
  END IF;
END $$;

SELECT current_database() AS database_name, current_user AS analytical_role,
       current_setting('transaction_read_only') AS read_only,
       now() AS checked_at_utc;

SELECT count(*) AS canonical_bookings, max("updatedAt") AS latest_update_utc,
       min("bookedAtTime") AS first_booking_action_utc,
       max("bookedAtTime") FILTER (WHERE "bookedAtTime" <= now()) AS latest_booking_action_utc,
       count(*) FILTER (WHERE "bookedAtTime" IS NULL) AS missing_booking_time,
       count(*) FILTER (WHERE "bookedAtTime" > now()) AS future_booking_time,
       count(*) FILTER (WHERE "normalCustomerId" IS NULL) AS unlinked_bookings
FROM public."Booking";

-- Status is a quality dimension, not a retrospective filter for booking-action predictions.
SELECT status, count(*) AS bookings,
       count(*) FILTER (WHERE "bookedAtTime" IS NULL) AS missing_booking_time
FROM public."Booking"
GROUP BY status ORDER BY bookings DESC;

-- Version inventory only: no prediction or customer identifiers are returned.
SELECT "modelVersion", status, count(*) AS predictions,
       min("issuedAt") AS first_issued_utc,
       max("issuedAt") AS last_issued_utc
FROM public."CustomerBookingPrediction"
GROUP BY "modelVersion", status
ORDER BY "modelVersion", status;

ROLLBACK;
