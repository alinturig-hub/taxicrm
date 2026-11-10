-- Bounded pilot chosen using identity and pre-evaluation history only.
-- JSON goes directly to the offline runner. Do not print or persist the stream.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL jit = off;
SET LOCAL max_parallel_workers_per_gather = 0;
SET LOCAL work_mem = '8MB';
DO $$
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'cabby_ro' THEN
    RAISE EXCEPTION 'Expected shared-primary postgres database and cabby_ro';
  END IF;
END $$;

WITH pool AS MATERIALIZED (
  SELECT id, md5(id || ':prediction-v2-pilot-20261110') AS rank
  FROM public."NormalCustomer"
  WHERE "createdAt" <= timestamp '2026-10-26 00:00:00'
  ORDER BY rank, id LIMIT 2000
), scoped AS MATERIALIZED (
  SELECT b.id, b."normalCustomerId", b."bookedAtTime", b."createdAt", pool.rank
  FROM public."Booking" b JOIN pool ON pool.id = b."normalCustomerId"
  WHERE b."bookedAtTime" >= timestamp '2018-08-10 00:00:00'
    AND b."bookedAtTime" <= timestamp '2026-11-09 00:00:00'
), cohort AS MATERIALIZED (
  SELECT "normalCustomerId", rank
  FROM scoped
  GROUP BY "normalCustomerId", rank
  HAVING count(DISTINCT "bookedAtTime") FILTER (
    WHERE "bookedAtTime" <= timestamp '2026-10-26 00:00:00'
      AND "createdAt" <= timestamp '2026-10-26 00:00:00'
  ) >= 5
  ORDER BY rank, "normalCustomerId" LIMIT 100
), selected AS MATERIALIZED (
  SELECT scoped.* FROM scoped JOIN cohort USING ("normalCustomerId", rank)
), bounded AS MATERIALIZED (
  -- Fail closed via the envelope rather than truncating a customer's history.
  SELECT count(*) AS rows, count(DISTINCT "normalCustomerId") AS profiles FROM selected
), normalized_locations AS MATERIALIZED (
  SELECT l."bookingId", l.type,
    trim(regexp_replace(regexp_replace(
      lower(trim(CASE WHEN l.type::text = 'PICKUP'
        THEN coalesce(nullif(l."zoneName", ''), l.address) ELSE l.address END)),
      '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) AS normalized
  FROM public."BookingLocation" l
  JOIN selected b ON b.id = l."bookingId"
  WHERE b."bookedAtTime" <= timestamp '2026-10-26 00:00:00'
    AND b."createdAt" <= timestamp '2026-10-26 00:00:00'
    AND l."createdAt" <= timestamp '2026-10-26 00:00:00'
    AND l.type::text IN ('PICKUP', 'DESTINATION')
    AND (SELECT rows <= 20000 FROM bounded)
), locations AS MATERIALIZED (
  SELECT "bookingId", jsonb_agg(jsonb_build_object(
    'type', type, 'address', CASE WHEN normalized = '' THEN '' ELSE md5(normalized) END,
    'zoneName', NULL
  )) AS tokens
  FROM normalized_locations GROUP BY "bookingId"
), profiles AS MATERIALIZED (
  SELECT md5(b."normalCustomerId" || ':prediction-v2-pilot-20261110') AS key,
    jsonb_agg(to_char(b."bookedAtTime", 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') ORDER BY b."bookedAtTime", b.id) AS actions,
    jsonb_agg(to_char(b."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') ORDER BY b."bookedAtTime", b.id) AS availability,
    jsonb_agg(jsonb_build_object('locations', coalesce(l.tokens, '[]'::jsonb)) ORDER BY b.id) FILTER (
      WHERE b."bookedAtTime" <= timestamp '2026-10-26 00:00:00'
        AND b."createdAt" <= timestamp '2026-10-26 00:00:00'
    ) AS identity_history
  FROM selected b LEFT JOIN locations l ON l."bookingId" = b.id
  WHERE (SELECT rows <= 20000 FROM bounded)
  GROUP BY b."normalCustomerId"
), daily_activity AS (
  SELECT to_char("bookedAtTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London', 'YYYY-MM-DD') AS day,
    count(*) AS bookings
  FROM public."Booking"
  WHERE "bookedAtTime" >= timestamp '2026-10-26 00:00:00'
    AND "bookedAtTime" < timestamp '2026-11-09 00:00:00'
  GROUP BY day ORDER BY day
)
SELECT jsonb_build_object(
  'dataKind', 'HISTORICAL',
  'sourceDatabase', current_database(), 'sourceRole', current_user,
  'readOnly', current_setting('transaction_read_only'),
  'snapshotAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'coverageStatus', 'CURRENT_SNAPSHOT_NOT_POINT_IN_TIME_AUDITED',
  'poolSize', (SELECT count(*) FROM pool),
  'sourceRows', (SELECT rows FROM bounded),
  'dailyActivity', coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM daily_activity d), '[]'::jsonb),
  'historyAvailableFrom', '2018-08-10T00:00:00Z',
  'evaluationStart', '2026-10-26T00:00:00Z',
  'observedThrough', '2026-11-09T00:00:00Z',
  'checkpointHours', 24,
  'customers', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'key', key, 'bookedAt', actions, 'availableAt', availability,
    'identityHistory', identity_history
  ) ORDER BY key) FROM profiles), '[]'::jsonb)
);
ROLLBACK;
