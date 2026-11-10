# Initial historical pilot — result and limitations

Owner-supplied aggregate report from the reviewed, read-only pilot at commit
`b10e9b1698c8b8bda5fde24200917662f30c116e`. Source: database `postgres`, role
`cabby_ro`, read-only `true`, snapshot **10 November 2026, 07:49:39.116 UTC**.
Evaluation period: **26 October–9 November 2026**. The assistant did not execute
a direct DB connection. No model deployment or activation occurred.

## Observed results

The stable pool had 2,000 profiles. The SQL selected 100 with at least five
pre-period booking actions; the identity filter evaluated 94 and excluded six
shared points. No profiles lacked the pilot's identity evidence. It read 3,163
timestamped bookings, removed 16 duplicate action timestamps and counted 443
actions imported over 24 hours after their booking time among evaluated profiles.
Those imports were not used as training before their database creation time.
They are not necessarily imports that occurred during this evaluation period.

| Horizon | Eligible snapshots | Positive snapshots | Model top-fifth precision | Frequency baseline precision |
| --- | ---: | ---: | ---: | ---: |
| 6h | 1,316 | 0 | 0% | 0% |
| 12h | 1,316 | 4 | 1.52% | 1.52% |
| 24h | 1,316 | 5 | 1.90% | 1.90% |
| 48h | 1,222 | 8 | 3.27% | 3.27% |

There were zero matched windows outside the horizon in all four cases. The
48-hour horizon excluded 94 snapshots for incomplete follow-up. All 14 calendar
days had canonical source activity (933–1,826 bookings/day); that is diagnostic
support, not proof that every event was captured or correctly linked.

**V2 did not show incremental precision over the frequency baseline in this
sample.** Its reported recall of 100% at 12/24/48 hours and lift of five reflect
very few positive snapshots and the definition of a top-fifth selection. The
frequency baseline achieved the same figures. This is not evidence of a 5×
retention improvement, reliable individual probabilities or perfect prediction.
The initial report did not count distinct returning profiles: five positive
24-hour snapshots need not represent five different customers or bookings.

## Limitation in the initial evaluation design

The assistant's first pilot used checkpoints 24 hours apart, beginning at midnight.
Thus the six-hour horizon tested only midnight to 06:00 London time. Zero positives
there cannot establish daytime performance. The random historical cohort could
include long-inactive profiles; its recency distribution was not reported, so the
low positive rate cannot simply be attributed to dormant clients as a verified fact.

The initial result is retained here rather than replaced by a more favorable
sample. No score weights, thresholds or model code are changed in response to it.

## Prespecified revised diagnostic design

- Keep the same source pool seed and the same historical period. Score at 00:00,
  06:00, 12:00 and 18:00 UTC/London, which are equivalent in this period. Evaluate
  only windows with full follow-up.
- Form fixed strata from the latest booking time **known before 26 October**:
  up to 60 days, over 60 through 180 days, and over 180 days. Sixty days matches
  the existing maintenance job's default activity window; it is not a new live tag.
- Within each stratum, retain stable hash ordering and pre-period five-action
  eligibility. Quotas are at most **50 recent, 30 idle and 20 dormant** profiles.
  Do not refill missing quota from another group based on subsequent outcomes.
- Preserve dormant negatives. A later return must not reclassify a customer's
  starting stratum. Recalculate and verify the SQL-supplied stratum inside the
  calculator from booking and first-availability timestamps.
- Report overall and within-stratum results, plus counts of distinct evaluated
  and positive profiles per horizon. Score each customer/checkpoint once; compute
  separate top-fifth rankings for the groups from those same scored snapshots.
- Keep the source, identity, privacy, row, time and memory bounds. At most 5,600
  customer/checkpoint forecasts fit within the revised 6,000-forecast calculator
  guard. No model weights, APIs, production rules or databases are changed.

This is a **revised diagnostic**, designed after inspecting the first result,
not an untouched confirmation set. Its quotas do not mirror population shares;
overall precision must not be presented as whole-population accuracy. Independent
calibration, customer-clustered uncertainty and prospective/untouched validation
remain separate work. If evidence remains sparse or the baseline remains equal
or better, report that result; do not keep changing seeds, quotas or model weights
on the same period until a favorable result appears.

Thirty-four relevant unit tests and the exact SQL/standalone calculator integration
test on synthetic PostgreSQL fixtures cover the revised mechanics. No revised
historical result has yet been collected at the time of this note.
