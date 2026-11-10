# Booking prediction validation — local work, 10 November 2026

This package evaluates the booking-window model offline. It now includes a local
slot-boundary correction, identified in reports as
`BOUNDED_LONDON_SLOTS_2026_11_10`. The live implementation remains unchanged.
No calibration, route contract, tag persistence, database, messaging or campaign
activation was changed. No dependencies were added.

## Verified findings

1. The existing backtest stops each customer's evaluation at their final observed
   booking. It omits later no-return periods, and it uses that final booking as an
   observation boundary instead of requiring a common, independently verified end
   of coverage. This can bias results and makes the existing figures insufficient
   evidence for current performance.
2. The production weekly-slot search rounds the candidate up to the next hour and
   iterates through the horizon inclusively, then creates a three-hour slot. A
   slot can therefore extend beyond the nominal horizon. The new diagnostic test
   reproduces a six-hour forecast at 08:30 whose matching slot starts at 15:00.
   The initial package reported this condition. The local correction now searches
   only `[now, horizonEnd)`, includes the remaining portion of the current London
   slot, and clips each contiguous matching slot at its actual end and horizon end.
   A slot with no historical matches is returned as absent rather than an invented
   recommendation. The London autumn midnight slot can span four elapsed hours;
   the spring equivalent can span two. The UI therefore no longer calls every
   suggested interval a three-hour window.
3. Calibration values are constants in the model. Some upper bands have only a
   handful of observations (the 48-hour upper band has four). Their applicability
   to the current customer population has not been established in this work.

## Reproduce

From the repository root:

```bash
node_modules/.bin/tsx --test src/lib/customers/customer-booking-window.test.ts src/lib/customers/booking-window-validation.test.ts src/lib/customers/customer-profiler.test.ts
node_modules/.bin/tsx scripts/validate-booking-windows.ts docs/prediction-validation/synthetic-input.json
node_modules/.bin/tsc --noEmit --pretty false
node_modules/.bin/next lint --file src/lib/customers/customer-booking-window.ts --file src/lib/customers/customer-booking-window.test.ts --file src/lib/customers/booking-window-validation.ts --file src/lib/customers/booking-window-validation.test.ts --file scripts/validate-booking-windows.ts --file src/components/customers/CustomerProfileDrawer.tsx
```

25 model/evaluator/profiler tests, TypeScript, targeted lint and the production
Next.js build passed. The separate editable-tag prototype has three additional
passing tests; it is not part of this release. A CLI invalid-file check also
passed: exit 1, fixed error message, no partial JSON or input disclosure.
These checks cover the offline evaluator, corrected model and existing local tag
rules. A Chromium/Playwright check also loaded the actual profile drawer against
synthetic fetch responses, switched to Prediction and verified score labels,
historical benchmark caveats, the renamed time-window heading and unchanged
retention/outcome interactions. This is isolated component interaction testing,
not an authenticated live browser test or a real customer accuracy measurement.

An additional authenticated test used a real NextAuth login and the built Next.js
app connected only to isolated PostgreSQL. The predictions API returned V2-only
outcomes (one hit and one miss, 50%) despite an additional V1 hit, and returned
only the V2 pending opportunity. The profile API retained both V1 records while
returning V2-only accuracy and a V2 live calculation. Opening that opportunity in
the browser reached the profile and its expandable earlier-model history. This
test used synthetic users/bookings and an outbound-fetch guard; the production
server and its scheduled workers were not started or contacted.

The synthetic fixture contains 20 explicitly fictional profiles: regular,
weekly, irregular, no-longer-returning and sparse histories, plus an excluded
shared profile. There are seven daily checkpoints. The 24-hour evaluation has
112 eligible customer/checkpoint samples and 21 learning snapshots. For the
48-hour horizon, 19 snapshots are excluded for incomplete follow-up. These are
mechanics checks, not estimates of real-world predictive performance.

The same synthetic fixture was compared with the model from live-base commit
`9b6dc77c41158de21c482425d4f691c49efa06f3`. Out-of-horizon matched slots fell from
15 to zero for the six-hour window and from one to zero for the twelve-hour
window. Both versions had zero such violations at 24/48 hours in this fixture.
Top-fifth precision on this particular fixture was unchanged. Correct boundaries
do not, by themselves, establish increased predictive accuracy.

The profile now leads with `score /100`; evidence strength is also a heuristic
index, not a percentage probability. Existing benchmark values remain visible
with an explicit historical/not-revalidated label. Stored predictions are called
recorded rather than verified. No existing historical evidence was erased.

## Evaluation rules

- Require explicit `historyAvailableFrom`, `evaluationStart`, `observedThrough`
  and `dataKind`. Dates must include UTC offsets. The observed-through value must
  come from verified ingestion coverage, never the last customer booking.
- Use the same cohort and checkpoint clock for every horizon and comparator.
  Keep customers who do not return; do not select a cohort based on future activity.
- At each checkpoint, pass only booking timestamps at or before that checkpoint
  to the existing production function. At least five distinct actions are needed.
- Predict a **new booking action**, not pickup time, completed trips, retention,
  customer no-show, motivation or response to a campaign. An eventual cancellation
  is still a booking action. Filtering training rows by a later outcome would
  introduce information unavailable when the prediction was made.
- Positive label: a new action in `(checkpoint, checkpoint + horizon]`. Evaluate
  a horizon only when its entire follow-up is covered. Count learning and censored
  snapshots separately. Require explicit profile safety; unsafe profiles are excluded.
- Compare the production ranking with a simple frequency baseline using booking
  counts in the preceding 28 days, with exposure capped at the available history.
  This baseline is a comparator, not a validated individual probability.
- Rank the top 20% separately at each checkpoint. Fractional weighting of tied
  scores prevents arbitrary record ordering from inflating performance. This is an
  evaluation statistic, not a rule for sending to fractional customers.
- Report coverage, positive rate, precision/recall/lift for that top fifth, empirical
  rates by score band and slots outside the requested horizon. Empty denominators
  are `null`. Reports contain neither customer identifiers nor booking lists.
- Deduplicate action timestamps in the same way as the live scorer. Duplicate
  customer keys, ambiguous times, actions outside coverage and oversized runs fail
  without returning a partial report. Default limit: 100,000 model forecasts.

## Real-data stage — prepared, not executed

`scripts/prediction-validation-preflight.sql` inventories the canonical source in
a bounded read-only transaction and requires `cabby_ro` on database `postgres`.
Use only the documented shared primary `q9fahphg3lydu18inysgmerq`. The SQL returns
counts and dates, no phone numbers, names or addresses. It is not an export and
does not prove ingestion completeness. It has not been executed against live here.

Before historical evaluation:

1. Verify identity of the source, earliest reliable coverage, gaps in ingestion,
   backfills and late corrections. Current `Booking` timestamps and `updatedAt`
   alone cannot establish which records were available at a past checkpoint.
2. Verify customer linkage and shared-contact exclusions using the existing
   profile data-quality logic. A present-day identity merge must not be presented
   as a linkage known in the past. Do not equate every phone with one person.
3. Choose and freeze an evaluation period and a deterministic cohort using only
   information available at the start. Do not select just future repeat bookers.
   Pseudonymize identifiers, export timestamps only inside the authorized secure
   environment, keep the input private and retain only aggregate output for review.
4. Run an initial bounded evaluation, then assess temporal stability and segments
   by history size and inactivity. Add customer-clustered uncertainty intervals
   before making claims of superiority; repeated/overlapping samples are dependent.
5. Preserve a later, untouched temporal holdout for any subsequent model tuning.
   Validation on the same period used to pick rules is not an independent test.

No real-data accuracy, confidence interval, calibration refresh or campaign uplift
has been established. No real extraction or database access occurred in this step.

## Next corrections and acceptance

The slot/horizon correction and profile wording are completed locally. The
corrected search can change weekly scores, particularly where the old search
omitted a current partial slot or included one beyond the forecast. Calibration
constants were deliberately not refitted using synthetic data.

Version separation is now implemented locally as `HAZARD_SLOT_V2`. A shared
constant is used by the scorer, prediction writer, validation report, predictions
dashboard API, AI insights, Copilot accuracy reader and system-health reader.
Active keys and input fingerprints include that version. Existing V1 rows are
not renamed, deleted or recalculated.

Per-customer history reads a bounded set of records independently for each
version (default 30 per version, maximum 100 per version); only V2 contributes
to its current accuracy. The profile prefers the current record and offers
earlier records in a separate expandable history. With only V1 history, the
profile says that the current model has no recorded predictions rather than
presenting legacy hits as V2 performance. Outcome resolution and scheduled
expiry continue to close pending records under their original version, with
evidence linked to each original prediction ID.

Five scenarios passed against isolated PostgreSQL using the real Prisma client
and prediction service: coexistence without overwriting V1, idempotent V2 issuance,
version-specific accuracy with both histories preserved, resolution on a new
booking, and scheduled expiry of both versions. No live migration is needed
because the existing version, active-key and fingerprint fields support this.

The committed integration test is opt-in via `PREDICTION_QA_DATABASE_URL`; before
importing the application client it rejects non-loopback targets, any database
other than `prediction_qa`, or any user other than `qa_prediction`. A normal unit
run skips this DB test when the isolated URL is absent. Never point tests at the
shared primary. The temporary local QA container is stopped after verification.

Pending-opportunity ordering now uses the score rather than an unvalidated legacy
benchmark. Copilot, evidence and profile labels describe time windows without
assuming every London slot spans exactly three elapsed hours. Historical
benchmark columns remain available with their limitations stated. V2 calibration
has not been learned from synthetic fixtures or invented.

Then run the agreed real-data evaluation and show measured results, including
cases where the baseline is better or evidence is sparse. Live accuracy, confidence
intervals and production rollout remain pending.

### Release sequence

1. Complete the read-only source inventory and historical coverage review from
   the documented shared primary; choose the bounded evaluation cohort without
   selecting on future returns. This is still blocked by analytical access.
2. Run the chronological historical evaluation and review coverage, baseline
   comparison and uncertainty. Retain the synthetic checks as mechanics evidence.
3. Review and publish a commit from this development branch, then deploy that
   exact commit to the existing TaxiCRM application. The main server owns the
   scheduled prediction-maintenance endpoint; no second ingestion writer or new
   production worker is introduced. Refresh scheduling and batch sizes remain
   unchanged; do not run an unapproved mass refresh to populate V2 instantly.
4. Confirm the deployment image and health, authorized profile access, V2 writes
   on normal processing, and V1 history visibility. Empty V2 accuracy initially
   means learning, not an error or inherited V1 accuracy. Sending flags remain
   unchanged. Inspect other preview deployments separately; do not assume their
   versions match production.
5. If application rollback is needed, roll back the image; preserve both versions'
   rows and evidence. V1 and V2 active keys are separate. A rollback must not
   rewrite V2 rows as V1 or combine their performance statistics.

Production application `gbwo4xfa46m5n1klnqxr8afl` was observed healthy via Coolify;
its monitored branch `codex/taxicrm` still pointed to the live-base commit
`9b6dc77c41158de21c482425d4f691c49efa06f3` at review time. No deploy was triggered.

### Current access limit

The configured SSH endpoint was probed with batch authentication, a bounded
connection timeout and strict host verification; no connection was established.
This executor has no SSH agent/key directory, no analytical DB connection binding
and no configured VPN. No live SQL or historical export ran. A configured endpoint
alone is not authenticated database access; no application/superuser credential
was substituted. The read-only preflight SQL is ready for execution from the
owner's existing authorized server session, or after analytical access is bound
securely to this environment. Do not paste credentials into chat.

Editable Morning/Night tags remain a separate local prototype. Persisting their
rules requires the schema/API change previously proposed to the owner. A tag or
prediction never constitutes marketing permission. Campaign approval, suppression
and frequency controls remain separate from this evaluation.
