# Revised historical diagnostic — owner-executed results

Evidence: the owner ran the checksum-verified pilot from commit
`d97c338eb8dcf44a8d55deee4b511ae74d272cbf` and supplied its aggregate report.
Snapshot **10 November 2026, 08:19:43.206 UTC**, database `postgres`, analytical
role `cabby_ro`, read-only `true`. No V2 deployment, calibration change, automatic
campaign activation or message sending is authorized by this report.

## Cohort and coverage

The diagnostic used the same 2,000-profile pool and 26 October–9 November period,
with fixed pre-period recency quotas and six-hour checkpoints. Of 100 selected
profiles, 94 were evaluated and six shared points were excluded. There were no
profiles missing the pilot's required identity evidence. The source contained
4,790 timestamped bookings; 13 duplicate action timestamps were removed and
1,129 actions among eligible profiles were imported over 24h after their event
time. Availability filtering prevents training on those rows before import.
Those counts do not imply that all late imports occurred during the evaluation.

Eligible strata: **45 recent within 60 days**, **29 idle for over 60 through 180
days**, **20 dormant for over 180 days**. Seven distinct recent profiles returned;
none of the selected idle/dormant profiles returned during this observation window.
That is not a claim that inactive customers never return or cannot be reactivated.

All 14 days had source activity (933–1,826 bookings/day), and every evaluated
horizon reported zero suggested slots outside its forecast bounds. Source activity
does not prove complete linkage or capture. Profile links and event timestamp
corrections are reconstructed from a current snapshot, not an immutable historical
identity audit.

## Ranking results

These percentages are **positive-window precision among the highest-ranked fifth
at each checkpoint**, with fractional tie handling. They are not calibrated
individual probabilities, completed-ride rates or campaign conversion rates.

| Horizon | Eligible snapshots | Positive snapshots | Returning profiles | V2 precision | Frequency precision |
| --- | ---: | ---: | ---: | ---: | ---: |
| 6h | 5,264 | 17 | 7 | 0.66% | 1.61% |
| 12h | 5,170 | 33 | 7 | 1.55% | 3.19% |
| 24h | 4,982 | 61 | 7 | 3.29% | 6.12% |
| 48h | 4,606 | 106 | 7 | 6.86% | 11.51% |

Within **recent profiles only**, precision was also lower for V2 at every horizon:

| Horizon | V2 precision | Frequency precision |
| --- | ---: | ---: |
| 6h | 1.59% | 2.78% |
| 12h | 3.43% | 5.45% |
| 24h | 6.92% | 10.13% |
| 48h | 14.17% | 18.67% |

Idle and dormant strata had zero positive profiles, so recall/lift were undefined
and precision was zero for both methods. Do not interpret those null metrics as
a verified model failure/success or a reliable individual no-return probability.
Snapshots overlap and repeat the same people: 61 positive 24-hour snapshots are
not 61 customers or necessarily 61 distinct bookings. No customer-clustered
confidence interval or independent confirmation result has been established.

## Decision

**The diagnostic does not support promoting V2 as a better predictive decision
engine.** The simple frequency comparator did better on all measured horizons,
both overall and within recent profiles. Seven returning profiles and a revised,
post-inspection sampling design are insufficient to establish population-wide
superiority of either model or a new calibrated probability model.

Keep PR20 draft and do not deploy the combined V2 model change on the strength of
these results. Preserve both pilots. Do not change seeds, weights or quotas again
on this period to obtain a favorable result. Do not silently replace the live
model with the baseline: that is a separate business-logic decision requiring
the owner's agreement and its own reviewed implementation.

The independently tested interval-boundary correction and clearer score/benchmark
wording remain useful correctness work. They should be reviewed as such, with
their own version/data-contract consequences, rather than sold as demonstrated
predictive improvement. A UI-only release needs a concrete separated diff; do not
merge the combined model PR while describing it as only a presentation update.

For the next prediction design, propose an explainable frequency/recency baseline.
Treat time-of-day, weekday, recent-gap and decay additions as hypotheses to test
against that baseline on a frozen, untouched temporal holdout. Reserve claims of
incremental value and calibration for that evaluation, and retention uplift for
a separate controlled campaign experiment with valid marketing permission.

No additional server diagnostic is requested merely to improve these reported
numbers. Production, persistent model versions, schema, grants, worker settings
and sending flags have not been changed by this evaluation work.
