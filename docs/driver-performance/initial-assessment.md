# Driver Performance: initial source assessment

Reviewed against TaxiCRM production baseline `9ef1cc8ed767689e3df040ed967bf8f0f3164ed3`.

The existing `DriverShift` model records driver, start, end and duration; individual shifts can cross a London midnight and must be clipped to the selected London calendar day before aggregating. Multiple shifts in one day must be combined without counting overlaps twice. A gap between shifts is not proof of a break.

`Booking` records driver identifiers, status, timestamps, payment fields, price/cost and several distance fields. Completed jobs, no-fare and cancellations must use confirmed status/timestamp definitions and their own denominators. Payment categories and distance units require verification against actual source payloads before values are reported. Accepted-to-completed distance cannot be assumed to equal the trip or meter distance.

`VehicleSnapshot` records driver/vehicle, position, status and timestamp. Distance accumulated from snapshots is an estimate with source coverage, gaps, timestamp alignment and GPS quality checks; do not interpret gaps as stationary time or invent complete mileage. Report total, on-job and empty miles only when the evidence supports the relevant interval; disclose unavailable or partial results. London days use [midnight, next midnight), including daylight-saving changes.

`BookingTimelineEvent` contains rejection and dispatch evidence. Existing `src/lib/refusals/refusal-map.ts` correlates a rejection with a preceding dispatch and a nearby recorded position; this is an inference and does not establish motive, actual road distance, or the amount offered to a driver. Distinguish a driver rejecting an offer from a booking cancellation; later acceptance and duplicate events need handling. Correlate cancellation only with reliable event ordering and present it as correlation, not causation. Do not infer psychological traits or claim distance/price caused a refusal. Only show observed associations with sample sizes and uncertainty.

Build read-only drilldowns with role permissions and per-driver source coverage before adding scoring or automated decisions. Preserve NeedACab Plus as the canonical booking/event writer. The first implementation must verify available source status events, timestamps, driver identity mappings, units, payment category semantics, actual price at offer time, position sampling and data coverage using authorized, bounded read-only aggregate checks. No external processing or automated driver action is authorized by this assessment.

## Live aggregate evidence, 12 November 2026, 06:09:55 UTC

Read-only query reported `postgres`, `cabby_ro`, read-only on; 2,760,312 canonical bookings, latest update 06:09:51 UTC. Recent 30-day pickup cohort: 42,186 bookings; 38,392 have driver ID, 35,180 acceptance timestamp, 36,311 completion timestamp, 42,177 have non-null meter metres, 42,186 non-null distance, payment type and price. Non-null includes zero and does not verify unit, measurement method, correct driver mapping, or that a price was offered at rejection.

Payment type distribution: Cash 33,072, Account 7,476, Card 1,638. These are booking rows by pickup date, not exclusively completed bookings or revenue totals. Shifts started in the last 30 days: 7,790, of which 7,765 have an end timestamp; 208 distinct drivers. This cohort does not include older shifts overlapping the period and missing end timestamps need explicit handling.

Seven-day position cohort: 697,278 snapshots; 696,736 have a driver ID and 367,680 have a booking ID. This is row-level presence, not journey coverage or reliable total mileage; timestamps span 5 November 06:09:56 to 12 November 06:09:51 UTC.

Thirty-day timeline counts: 44,663 dispatch, 35,777 accepted, 6,808 rejected, 3,465 cancelled, 1,317 no-fare, 36,323 completed events. Event counts are not distinct bookings/drivers and must not be divided into booking counts as rates.

Source review: Autocab maps `MeterDistanceAsMetres` into `meterDistanceMetres`, but the position and route semantics need validation. Existing refusal distance is straight-line from the pickup to the nearest driver snapshot, using a window that can extend to 60 minutes before or after refusal. It is not driven-road mileage or proof of the reason. The rejection classifier excludes duplicates and accounts for later acceptance by the same driver; seven synthetic timeline scenarios passed. The session interval test also passed for a 23-hour London DST day and overlapping sessions.

Next evidence needed: proportions of meter values positive/zero/null for completed jobs, dispatch-to-accept-to-complete timing completeness by status, driver identity match rate, distribution of GPS gaps within shifts and whether a tracking point can be linked reliably to an accepted job. Evaluate price at the time of offer from event/snapshot evidence, rather than using the booking's later price. Aggregate-only, read-only queries; avoid exporting coordinates, identifiers or individual profiles.
