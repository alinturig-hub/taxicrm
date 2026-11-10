# Frequency reference production integration

## Result and limits

Replace the active HAZARD_SLOT_V1 ranking with FREQUENCY_REFERENCE_V1 in the
customer profile, persisted forecasts, prediction dashboard, Copilot accuracy,
insights and system-health summaries. Keep prior model rows intact and available
under Earlier model history; current-model accuracy cannot include legacy hits.

The reference ranks already-known booking actions using distinct actions in the
last 28 days: `100 * (1 - exp(-count28 * horizonHours / exposureHours))`.
Exposure is capped at 28 days against source coverage starting 10 August 2018.
Import timestamps must be available at calculation time. Missing timestamps,
future actions and future imports cannot supply evidence. At least five known
actions are required; shared/non-individual profiles remain disabled. Counts
include booking actions regardless of eventual outcome. Completed-trip retention,
cancellations and no-fare profiling remain separate and unchanged.

Seven/fourteen-day activity and recency are descriptive, without newly fitted
weights. Scores are uncalibrated ranking indices, not individual probabilities,
exact booking times or evidence of retention uplift. This integration does not
promote HAZARD_SLOT_V2 or claim an independent holdout passed. The bounded pilot
favoured the frequency comparator but had only seven returning profiles.

No slot estimate is invented. Absence of a slot does not create a missed-slot
evidence event. Existing workers gradually issue the new version during normal
processing; there is no bulk backfill, extra scheduler or automatic campaign.

## Required owner installation before app deployment

The old `observedRate` field is NOT NULL. The reference has no calibrated
benchmark, so persisting zero or copying the old benchmark would misrepresent it.
The only schema change is dropping NOT NULL on this existing numeric(6,2) column.
All existing values and ACLs are preserved. No new tables, grants or data writes.

Run `install-nullable-benchmark.sql` from the reviewed immutable release commit,
using the existing prediction-table owner through the owner's authorized SSH.
It checks database `postgres`, canonical Booking and target table, owner and
column type; applies the change transactionally with a two-second lock timeout;
and prints `observed_rate_nullable = true` followed by COMMIT. Do not run the
whole shared Prisma migration chain. The matching Prisma migration is included
for schema history, not authorization to run unrelated migrations.

Do not deploy this application until the owner installation has committed.
After installation, merge the tested application tree and verify Coolify's exact
deployed commit, healthy state, public routes and unauthenticated API rejection.
No messaging flag, ingestion writer or database connection change is required.

## Verification completed in isolation

- 19 unit tests: frequency calculator, live adapter, profiler regressions and
  legacy display bounds. Includes missing availability, shared-profile exclusion,
  null calibration and no invented slot.
- PostgreSQL integration: five service scenarios plus the suite parent and one
  migration test (seven reported tests). Covers version coexistence, idempotent
  issuance, separated accuracy, booking outcome resolution, expiration, no false
  slot miss; exact SQL preserves old rows and ACLs, accepts null, is idempotent
  and rejects the read-only role.
- Production Next.js build, TypeScript and targeted ESLint passed.
- Authenticated local Chromium against the production build and isolated
  PostgreSQL: real NextAuth login; predictions API returns current-only 50% from
  two synthetic outcomes and null benchmark; profile retains two legacy records;
  dashboard opens the profile, shows recent activity and Not calibrated, and
  expands the legacy history. No `null%` or invented zero benchmark.

All fixtures were synthetic. External fetches were blocked in the local app;
real customer data, Meta calls and production writes were not used for testing.
Authenticated production interaction remains to be checked after deployment;
local browser coverage does not claim a live authenticated test.

## Rollback

Previous application: a8bfb8e64d49a526462779fdafe412e79c1b62d8. If necessary,
restore that image through the normal deployment flow. Leave observedRate
nullable: old V1 rows retain their numeric values, and new reference rows may
legitimately contain null. Do not restore NOT NULL, fabricate benchmarks, delete
new rows or combine model statistics. No sending flags need enabling or rollback.
