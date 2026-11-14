# Manager decision support: initial code assessment

This assessment describes the source tree, not a new validation of live data or predictive quality.

- Next booking: `FREQUENCY_REFERENCE_V1` ranks individuals by known booking actions in the past 28 days for 6, 12, 24 and 48 hours. The index is uncalibrated and provides no exact booking time. The bounded historical pilot had only seven returning profiles; it does not establish production accuracy or marketing uplift. Shared profiles are excluded from personalisation.
- Demand: the existing 24-hour forecast estimates booking requests in three-hour time slots; its dashboard shows historical and live evaluation evidence separately. No zone-level forecast has been established by this assessment.
- Customer inactivity: the existing profiler uses elapsed time against fixed minimums and a multiple of the observed median booking interval. It is a heuristic, not a validated churn probability. Its existing lifecycle thresholds differ from the agreed completed-journey and 5-in-14-days milestones, which must not be conflated.
- Business health: My workspace has existing cards for bookings, completed journeys, cancellations, no-fare, recorded revenue, margin before other costs and other activity. A single health score is not established and should not be presented as a verified assessment of profit or company solvency. Coverage, comparison period and missing amounts must remain visible.

## Proposed implementation sequence

1. Measure data freshness, identity quality and coverage by period and source; retain missing, late-imported and shared-profile exclusions. Evaluate independently by chronological holdout with a frequency baseline, segment sizes, uncertainty and drift. No automated outreach from a score.
2. Present individual activity and inactivity evidence with clear observation windows, counts and limitations. Evaluate predictions against simple baselines before displaying calibrated probabilities or a specific time.
3. Develop demand-by-zone forecasts only after validating zone assignments, missingness, source coverage, DST and low-volume thresholds. Compare with same-hour/weekday historical baselines on held-out periods; show unavailable for insufficient data.
4. For business health, derive existing metrics and equivalent-period comparisons with explicit denominators, source timestamps and London time. Completed-job price minus cost is margin before other expenses, not net profit. Cancellation/no-fare are separate outcomes; do not infer cause or individual intent. Surface explanations and drill-downs, not a fabricated combined score.
5. Trial recommendations in observation mode with human review, consent controls and measured outcomes before any campaign or automated action. Independent access permissions and module switches continue to apply.
