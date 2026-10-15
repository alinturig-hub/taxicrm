# Customer profiling review

Baseline: codex/taxicrm, 1f110cb970b00951d3d82990346ddc5a6964ab78. Repository review and synthetic checks only. No production customer data, refresh job, backfill or messaging was invoked.

Existing features: full-history profile, recent 14-day behaviour tags, shared-booking-point identity protection, Europe/London time formatting, data-quality assessment and a versioned 24-hour booking-window prediction with outcome tracking (HAZARD_SLOT_V1).

Confirmed issues in buildCustomerProfile:

1. Future pickup dates participate in lastBookingAt and frequency calculations. The recency helper clamps negative differences to zero. A synthetic profile at 2042-07-10 with records on July 1 and July 20 produced lastBookingAt=July 20 and daysSinceLastBooking=0. Upcoming reservations should be represented separately from observed past behaviour; the date policy must distinguish booking creation from journey time.
2. Missing prices are converted to zero. Two synthetic completed rows, one with null price and one with price 12, produced averageCompletedValue=6. Unknown financial values must be distinguished from confirmed zero, and any spend display must retain the existing financial semantics rather than inventing a fare or substituting another amount.
3. Tag and profile time windows differ by design (14 days versus all history), but the UI must label both clearly. This difference alone is not a defect or justification for changing thresholds.

The existing customer-behaviour-tags assertion suite passed. The synthetic reproduction above completed successfully and demonstrated the two edge cases; it is diagnostic evidence, not a passing regression test for the desired corrected behavior.

Next implementation priorities: define shared historical eligibility without discarding upcoming bookings from the UI; represent missing financial coverage explicitly; verify shared/freephone identity protection and cancellation handling; then test chronological prediction evaluation (including London DST), sample size and score calibration before displaying a score as a measured probability. No new tagging thresholds or financial rules are approved or invented by this audit.

## Isolated corrections completed

- Profile behaviour, lifecycle, recency, known spend and minimum-history readiness now use valid historical records only. Future-dated creation/completion and journey dates are excluded; undated/invalid-date records are counted separately. All source records remain unchanged and the latest-bookings list retains future/undated entries.
- Overview reports recorded/historical/future-dated/undated counts. The client labels Historical bookings explicitly.
- Completed price coverage is explicit. Unknown, blank, invalid, negative and non-finite amounts do not become zero or enter the average denominator. Confirmed zero remains valid. With no known completed prices, sum/average are null; partial sums are labelled Known spend with the known-price count. Fare is not substituted for price, and financial provider/account rules remain untouched.
- Shared-booking-point protection remains conservative over existing source records; no personal predictions are enabled for freephone/shared fixtures.
- Booking-window lead-time samples now exclude future-created bookings while retaining already-observed advance-booking actions. No model coefficients, calibration bands or tag thresholds are changed.

Validation: 9 tests passed across the new profile/prediction edge cases and existing fare/identity checks; the existing behaviour-tag assertion suite passed; production build including TypeScript/lint passed. Re-running the initial synthetic reproduction now reports a past lastBookingAt, 9.1 days since the historical booking, and null spend/average when its price is unknown. No real profile refresh, backfill, snapshot update, production migration, push or deployment was executed.

Remaining: audit other intelligence modules and data-quality coverage semantics for the same eligibility policy; verify calibration provenance and chronological outcome evaluation before making reliability claims about numeric prediction scores. This slice does not certify statistical model accuracy or rewrite historical snapshots.
