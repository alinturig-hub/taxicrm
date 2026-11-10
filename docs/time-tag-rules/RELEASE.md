# Saved time rules and pickup/boarding profile observations

Base: deployed TaxiCRM Agent chat b2f5f04e8e5e2c7f8f7d431468fa6fd5fd4e8c7d (candidate a15317fb41682cf0c02dc18959e4d44c0f4c8287). Preserve current retention, frequency ranking, finance, existing roles and messaging flags.

## Product

Customers → Time tag rules: edit the label, enabled state, London start/end times, 1–90-day lookback, minimum count and minimum percentage. Add up to twenty time rules. The two existing Morning/Night IDs are preserved; custom IDs cannot collide with weekend/place/frequency rules. Only completed journeys with recorded pickup times count; missing pickup, future times, cancellations and no-fare are excluded. London DST and midnight crossings are evaluated as local-clock windows. These descriptive tags do not create marketing consent or diagnose passengers.

Rules are shared company configuration, not browser-local preferences. Existing customers.manage controls editing. Same-origin writes, strict validation, optimistic revision conflicts and existing AdministrationAuditEvent records protect edits. No new permission keys. Removing/disabling a rule is saved explicitly. Profiles calculate with saved rules immediately on reload; cached audience tags converge through the existing tag job, without starting a bulk run. Relevant cached IDs are deactivated atomically on edits so stale claims are not treated as current. Worker writes lock/check the rules revision and store the rule revision in their model version. Other tags retain their rules and fourteen-day windows.

The profile Behaviour tab additionally shows source-event pickup/boarding observations: arrival→POB, adjusted boarding after max(arrival, scheduled time), request→arrival and arrival→no-fare. Missing events stay unknown, reversed/future timelines are withheld, conflicting booking references excluded. Driver movement/assignment is never inferred from missing telemetry; no automatic lateness label or passenger fault score is created. No canonical ingestion fields are changed.

## Owner SQL prerequisite

Run only docs/time-tag-rules/install.sql from this immutable candidate commit using the existing owner through authorized SSH against q9fahphg3lydu18inysgmerq / postgres. This is a write: creates one configuration table and its two default rules; grants scoped app read/insert/update and analytical read; explicitly revokes inherited/default DELETE on the new table. Canonical Booking and existing tables/grants are untouched. Script refuses an unexpected DB/owner or pre-existing configuration table. Locks have a two-second timeout and the whole install is transactional.

Do not merge/deploy before COMMIT. Do not run the complete historical shared Prisma migration chain. The paired Prisma migration records the schema only. Application rollback: restore prior b2f5f04 image and leave the additive table/data; do not drop data as an automatic rollback. Restoring an old tag worker also restores its old fixed time rules, so review cached audience eligibility before using it; sending remains disabled throughout this release.

## Verification

- 32 unit tests passed for evaluator/parser, defaults and custom rules, long lookback, DST, midnight boundaries, profiler and source-event KPI logic.
- TypeScript, targeted ESLint and production Next.js build passed.
- Exact install SQL executed in isolated PostgreSQL, including the same app DELETE default ACL observed on production: two defaults installed, app update allowed, DELETE removed, NeedACab writes excluded and Booking rows unchanged.
- Authenticated Chromium against production build + isolated PostgreSQL: saved rule survives reload; profile matches three actual synthetic journeys; source-event medians render; simultaneous saves return 200/409; reserved ID injection rejected; operator edit access denied.
- Final formatted production build verified in authenticated Chromium: disabling a saved rule removes it immediately from the profile while preserving source-event KPI evidence.
- Existing tag worker executed on isolated data: saved rule, evidence and rule revision persisted; no Booking rows changed; two successful edits produced two audit rows.

All data synthetic; external requests blocked. Production authenticated editing and real dataset timing coverage remain unverified until owner installation and deployment. No bulk backfill, real messages, worker activation or schema write was performed remotely by these tests.
