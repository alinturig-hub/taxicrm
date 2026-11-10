# Frequency reference candidate — offline only

`FREQUENCY_REFERENCE_V1` packages the same comparator used in the read-only
diagnostics. It is not a new validated predictor or an automatic replacement for
the existing live V1 model. No route, schema, permission, persistence, job, provider
or messaging integration is included.

## Frozen method

Use distinct booking-action timestamps known at the prediction cutoff. First DB
availability is mandatory; unknown availability is counted and excluded. Future
actions and rows imported later do not enter earlier history. Duplicates use their
earliest known availability. A minimum of five valid known actions is required;
shared/non-individual profiles receive no ranking.

For each 6/12/24/48-hour horizon, use the existing comparator exactly:

`rankingScore = 100 × (1 − exp(− count28 × horizonHours / exposureHours))`

`count28` covers `(now − 28 days, now]`; exposure is capped at 28 days of verified
source coverage, not the customer's time since first booking. Scores only rank
signals: the Poisson transform has not been validated as an individual's booking
probability. The candidate reports 7/14/28-day counts and time since last action as
descriptive evidence. It does not add a tuned recency multiplier, weekday/hour
weight, final-outcome weight, inferred motive or psychological classification.
It does not invent a most-likely hour from frequency alone.

This reproduces the better observed comparator; it does not demonstrate new uplift
merely by packaging it as a function. Counts refer to booking actions irrespective
of later cancellation/completion/no-fare. Completed-trip retention stays separate.

## Untouched evaluation proposal

Freeze this implementation before **11 November 2026, 00:00 Europe/London**. Proposed
issue checkpoints: every six hours from 11 November through 25 November exclusive;
allow event follow-up through 27 November for the final 48-hour horizon. Do not
inspect outcomes and then alter the implementation, seed or eligibility on that
period. No collector or scheduled task has been enabled to implement this plan.

Freeze cohort membership from identity and timestamped history known at issue-start;
retain no-return negatives and report inactive groups separately. Use the same
source snapshot, coverage/identity exclusions, issue times and full follow-up for
each comparator. Capture first availability, missing timestamps, late imports and
linkage limitations; a later snapshot is not a fully audited point-in-time record.

Compare the candidate against the unchanged reference and the existing live scorer
at matched issue times. Report per-horizon coverage, distinct returning people,
top-fifth precision/recall, calibration diagnostics and customer-clustered uncertainty.
Overlapping windows are not independent people. An index is not a calibrated
probability, and improved ranking is not proven campaign retention uplift.

Proceed with live algorithm integration only as a separately reviewed business
decision with versioned writes/readers, preserved historical evidence and a
rollback plan. No integration, production rollout or forecast effectiveness claim
is part of this offline candidate. Marketing permissions remain independent.

## Checks

Seven focused tests verify agreement with the diagnostic comparator, future and
late-import exclusion, deduplication, rolling boundaries, dormant/sparse/shared
profiles, partial coverage and ambiguous timestamp rejection. TypeScript and targeted lint passed. No actual
customer data was loaded or new historical period evaluated by this candidate.
