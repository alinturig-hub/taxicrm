# Prediction presentation release

Base: `9b6dc77`, confirmed by GitHub and the latest Coolify production deployment.
The local cached branch reference was older and was not used for this release.
This branch is
separate from PR20 and contains no V2 scorer, persistence/version change, API
change, calibration update, database migration, permission change or worker change.

The profile and opportunity list label legacy benchmark percentages as historical
and unvalidated, show ranking/evidence indices as indices rather than individual
probabilities, and call a stored prediction recorded rather than verified.
Existing benchmark values and outcome evidence remain available.

Displayed suggested intervals are intersected with their forecast bounds. Empty
intersections are shown as no matching window. This is a presentation correction:
it does not repair, recalculate or overwrite the live V1 model's scores, raw stored
intervals, hit/miss evidence or historical statistics. The pending opportunity list
uses the existing API horizon (24 hours) and end time to derive the display bounds.

The newer baseline-first prediction work is a separate offline candidate. The
negative historical findings in PR20 are not a reason to imply that this UI release
improves predictive performance.

Validation: four focused boundary/DST tests, TypeScript, targeted lint, and a
Chromium test of the actual profile and predictions dashboard with synthetic fetch
responses passed. Browser checks cover navigation to Prediction, benchmark/evidence
labels, clipping a stored suggestion beyond the forecast, and hiding a suggestion
with no overlap. They do not constitute a fresh authenticated live test.

The production build uses an intentionally unreachable loopback synthetic DB URL
to avoid accessing any real database. Publishing/merging this branch changes only
presentation; operational and marketing sending flags remain untouched. Review the
exact branch diff and deployed image separately from PR20 before any rollout.
