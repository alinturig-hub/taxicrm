# Predictions installation control

This extends the AI/Reports/simulation controls from PR29. Predictions can now be disabled independently of customer history, completed-trip retention, configurable time tags, places and CRM booking effects. Forecast Insights and customer opportunities depend on Predictions and become unavailable with it. Marketing campaigns and shared communications transport are not controlled by this switch.

## State and compatibility

The existing administration journal remains the only installation authority. Version 2 adds `enabled.predictions` and nullable `predictionEpoch`. Strict version-1 configurations are normalized in memory: every existing AI/Reports/Automation choice and revision is retained, Predictions defaults enabled, and no stored event is rewritten. No new schema, database connection, role, grant, source writer or messaging flag is introduced.

An administrator's disable/enable uses the existing exclusive installation advisory lock and compare-and-swap revision. A real transition from disabled to enabled records the database clock as the new activation boundary. Saving an already-enabled state does not reset the boundary. New events use version 2; older application binaries cannot safely interpret them. Roll forward with compatible enforcement rather than blindly reverting to an older parser after settings changes.

## Prediction units and shared work

Customer refresh/outcome evaluation/history, demand forecast creation/evaluation, forecast alerts, manual prediction evidence/backtest maintenance and prediction simulations use a reentrant transaction-scoped unit. The unit acquires the shared installation advisory lock and reads current state before prediction work. The delegate routes all service persistence and existing nested transaction callbacks to the SAME Prisma transaction; a timeout cannot release the lock and leave a callback writing through an independent global connection.

Units use a 3-second lock timeout, a 90-second SQL statement timeout and a 120-second transaction bound. The customer maintenance batch acquires per customer/evaluation unit, not around its whole batch. A disable waits for accepted persistence units; if they remain busy past the administrator lock timeout, the change fails without committing a disabled state and the UI asks to reload. Explicit maintenance/backfills are also bounded and may need smaller batches for large work. No automatic retry is added.

Scheduled prediction and demand endpoints keep cron authentication first. When disabled they return an expected `SKIPPED/MODULE_DISABLED` success with no work or new job-run record. A mid-batch disable stops further customer units. A race after a job-run record starts is completed as paused rather than recorded as a prediction failure.

The shared CRM event worker catches the intentional disabled result and continues places/company metrics. Customer snapshot generation skips next-booking and need calculations but still saves ordinary profile observations. Snapshot persistence participates in the state lock: when off, new snapshots have a null need score and DISABLED level; updates retain existing stored prediction fields instead of erasing them. Returned profile history masks those fields while off. Tag refresh is unchanged.

## No replay on reactivation

Existing prediction/forecast/alert rows and evidence are retained. Current prediction/forecast reads and automatic outcome evaluation are bounded by the new activation timestamp. New active keys, forecast keys and alert identities include the activation boundary so a still-pending old key cannot silently become active again. Old pending rows are not re-evaluated as misses and old open alerts are not revived/resolved as fresh observations. Recorded lifetime/historical counters may still describe retained records; they are not resumed work.

Customer maintenance treats a calculation from before the activation boundary as needing a new calculation even when its old next-refresh time is still in the future. New calculations use the existing model on current canonical history; no old notification/event is replayed. The existing FREQUENCY_REFERENCE_V1 model, score definitions, null calibration and previous model separation remain unchanged.

## API and UI composition

- Predictions page/API, customer opportunities and forecast Insights are guarded after existing access checks.
- Copilot demand, warning and accuracy tools cannot bypass the switch. Historical booking questions remain available; its health tool returns independent diagnostics when off.
- Manual forecast simulations also require the module. Other simulations/jobs keep their own controls.
- Customer profile requests still return history, retention, outcomes, tags and other observations, with explicit prediction availability. Off/unavailable requests omit next-booking, booking-window, need-propensity and stored-prediction outputs. The prediction tab is hidden. Customer mind receives no next-need signal while off.
- Core health remains available: when off it reads profile/snapshot/place counts and independent job runs without querying prediction/forecast services or presenting paused work as a failed/stale forecast.
- My workspace removes the optional prediction card from available/visible cards and does not run its provider. Account storage retains hidden cards, including their slot when users edit the visible order; re-enabling restores the choice. User permissions continue to apply independently.

Existing accepted read responses/open tabs may contain data loaded before a change until refreshed. Persisted prediction work is serialized with disable as described above. Errors reading policy fail closed for prediction work; unrelated customer views are not replaced with a forecast page.

## Verification and release

Synthetic PostgreSQL verifies legacy-state compatibility, preserved settings and source bookings, disabled services, independent tags/snapshots/CRM effects, preserved stored scores with masked output, fresh activation keys, old-pending exclusion, concurrent disable ordering and rejected late writes after a transaction timeout. Existing model-version/evidence and workspace/parity suites remain regression checks. Authenticated browser checks cover URLs/APIs, skipped cron endpoints, Copilot, profile/tab composition, saved layout restoration, core health, mobile and restart persistence.

Production deployment must retain the current module state/defaults and source/send flags. No real module is toggled to test the deployment. Public health/assets/authentication checks do not establish authenticated production toggle behavior; that requires a genuine administrator session.

Verification results for this candidate: 19 unit/contract checks, the prediction lifecycle integration, prior activation integration, 6 reported model-version regression tests, 7 reported workspace tests and golden summary parity passed. The authenticated desktop/mobile browser flow passed, including profile composition, Core health, explicit cron skips and layout retention; application restart and restored card order were also verified. TypeScript, lint and production build passed. All database/browser work used an isolated synthetic PostgreSQL container. Authenticated production interaction is not claimed without a real administrator session.
