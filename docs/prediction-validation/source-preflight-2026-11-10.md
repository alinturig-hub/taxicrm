# Shared-source preflight — owner-executed, 10 November 2026

Evidence supplied by the owner from the pinned preflight at commit
`a8b59c56b20e99847bc0b6845df356769e044aa0`, run in the documented shared-primary
container. The assistant did not establish a direct SSH/DB session.

- Verified SQL identity: database `postgres`, role `cabby_ro`, read-only `on`.
- Checked at **2026-11-10 07:28:29.011652 UTC** (also London time on this date).
- Canonical bookings: **2,757,545**.
- Latest update: **2026-11-10 07:28:24.469 UTC**.
- Earliest recorded booking action: **2018-08-10 13:54:27.67 UTC**.
- Latest recorded booking action: **2026-11-10 07:28:05.051 UTC**.
- Missing booking timestamps: **18,831**; future booking timestamps: **0**.
- Unlinked bookings: **451,708**. This does not prove that the linked portion has
  perfect identity resolution; historical merges and first-availability still matter.
- V1 rows: **34,383 HIT**, **164,487 MISSED**, **3,270 PENDING**. No V2 rows appeared.
- Transaction ended with `ROLLBACK`; no data or permissions were changed.

The hit ratio of this accumulated V1 table is not an independent evaluation,
calibration guarantee, retention rate or measured campaign uplift. Cohort,
overlapping predictions, capture coverage and selection matter.

## Outcome-data finding to address separately

The source has **3,235 `NO_FARE`** and **1,378 `NOFARE`** bookings. The existing
profile/outcome helpers explicitly recognize `NO_FARE` but do not alias `NOFARE`.
That discrepancy needs a separate reviewed normalization change and regression
test before claiming complete no-fare profiling coverage. This pilot predicts
booking actions without filtering by final status, so it does not silently
normalize or mutate these statuses or treat them as proof of a customer no-show.

## Bounded historical pilot

The prepared query freezes evaluation to **26 October–9 November 2026**, with
daily checkpoints and 6/12/24/48-hour horizons. It hashes identities in a stable
pool of at most 2,000 profiles already present at evaluation start, then takes at
most 100 profiles with five distinct, already-imported booking actions before
that start. It does not require a later return. It retains all stored timestamped
actions from 10 August 2018 for those profiles, with a hard limit of 20,000 rows;
it fails rather than truncating a history.

Database `createdAt` is used as the first-availability bound at every checkpoint.
This protects against using late-imported rows prematurely. It cannot reconstruct
subsequent edits to booking timestamps, profile links or addresses. The snapshot
therefore remains a bounded diagnostic pilot, not fully audited point-in-time
evidence or automatic deployment authorization.

Shared-point screening uses only identity evidence known before evaluation start.
Location strings are normalized and tokenized inside SQL; no names, phone numbers,
booking references or readable addresses leave the database query. Contacts with
fewer than five identity-history records or less than 80% pickup/destination
evidence are excluded conservatively for this pilot. This additional filter does
not change the production profiler or its rules.

The SQL runs with `cabby_ro` in a read-only transaction, a 45-second statement
timeout, disabled query parallelism and bounded working memory. Its JSON travels
directly to a reviewed standalone Node process, which emits only aggregates.
The calculator has no database client, app bootstrap, environment-secret reads,
HTTP calls, filesystem writes or sending code. Its computation worker has a
45-second limit and a 128 MB old-generation heap limit; the parent heap is capped
at 256 MB by the wrapper.

Only the calculator code and SQL are placed temporarily in `/tmp`; no customer
stream is saved. Checksums are checked before execution. The wrapper uses the
existing TaxiCRM container only as a Node runtime and removes the temporary code
afterwards. It does not restart/deploy the app or change flags, jobs or bookings.

## Reproducibility and tests

`node scripts/build-prediction-pilot.mjs` builds the standalone CommonJS artifact
and checksum manifest. It rejects any bundle dependency other than Node's
`worker_threads`. Source SQL, runner and wrapper are included in this PR.

Unit tests cover availability, deduplication, cohort guards, conservative identity
screening and non-disclosure in reports. An isolated PostgreSQL integration test
runs the exact source SQL as `cabby_ro`, then pipes the envelope through the actual
standalone bundle. It checks no-return clients, shared/unknown exclusions,
late imports, sparse/new-identity exclusion, no readable addresses/IDs in the
stream, bounded windows and failure without partial output for malformed input.
These are synthetic mechanics checks, not a historical performance result.
