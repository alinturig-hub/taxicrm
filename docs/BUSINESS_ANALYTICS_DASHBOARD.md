# Business analytics dashboard

Route: `/dashboard/analytics`; data: GET `/api/dashboard/analytics`. Performance navigation links to the page. No schema changes, production writes, new scheduled jobs or external data-source ingestion are required. This feature is implemented and verified locally, not deployed.

## Period and payment filters

Today and This week are London day/week-to-date (Monday start) up to the request instant. Last hour, 6 hours and 12 hours are rolling elapsed hours. Custom dates include the entire final London calendar day, with an exclusive next-midnight bound; limit 366 calendar dates. DST days can have 23 or 25 hours. Ranges are parameterized and validated before report execution.

This report selects **pickup time**, not creation or completion time. Bookings without pickupDueTime are excluded; the page says so. Financial amounts refer to COMPLETED jobs in this pickup cohort. Consequently its Today revenue can differ from a report that recognizes revenue by completedAt. Source timestamps are interpreted as recorded UTC instants; historical source-time discrepancies are not silently corrected.

Cash, Account and Card use the recorded paymentType label; Card includes credit/debit labels. Mixed labels that identify multiple methods, missing values and other labels remain OTHER. ALL includes these rows and shows their counts/income separately. No guessed allocation of a split tender or account association is performed.

## Cards, graphs and map

Cards can be selected, hidden and reordered. Preferences are saved in browser localStorage per user ID, with validation of stored card IDs and a reset action; there is no new preferences table or cross-device sync. Cards cover total/completed/cancelled/no-fare/rejected/recovered bookings, recorded income by payment, driver money, company margin, estimated rent/full-rent drivers and leading areas for volume, margin, payment, pre-booking and adverse/recovered outcomes.

Graphs show 24-hour pickup patterns, zero-filled daily demand, weekday comparisons when at least seven London dates are selected, and recorded Price/Cost trends. Hover details and expandable data tables expose exact values. Repeated DST hours are combined in the hour-of-day pattern. Counts are raw activity, not exposure-adjusted rates or forecasts.

The demand map uses saved **Zone centres**, sized/colored by booking volume. It does not display live cars, individual customer addresses or invented zone polygons. Valid centres fit the map without a lingering zoom animation when filters unmount it. OpenStreetMap provides public map tiles; no Geoapify lookup/API credit is used. Browser verification blocked external tile requests, so point rendering, fitting and interaction were tested without downloading a basemap.

Area association is the recorded PICKUP BookingLocation.zoneId matched to Zone on provider + externalId. This avoids multiplying counts across providers. Unverified/missing zones remain UNKNOWN in totals and coverage; they do not receive a guessed label or participate in best-area rankings. Inactive catalogued zones remain available for historical analysis. Most profitable area compares areas with at least one completed job and complete Price/Cost values, preserving losses.

Recovered counts are distinct selected bookings with a PROCESSED BookingRecovered/AUTOCAB_BOOKING_RECOVERED webhook. They describe history, not a separate final status, and may overlap completed/cancelled outcomes. Driver rejected/recovered rankings require an explicit event Driver.Id matched inside the same provider; no later assignment is used to guess the driver who rejected. No fare rankings use the saved assigned driver (validated internal ID, then provider-scoped external ID). Missing attribution is counted separately. These counts do not establish driver fault.

Pre-booking uses the existing Advance Booker threshold: at least six hours from bookedAtTime to pickupDueTime, with both timestamps present. It is not an invented new lead-time rule.

## Financial semantics

Only current COMPLETED status contributes money. Price is gross receipts / total income / revenue; Cost is driver money. Margin is Price minus Cost before rent, commissions and other expenses, not net profit. Signed values, zero and negative margins are retained. Missing Price/Cost is not replaced with fare, estimates, another amount or a loyalty value. Known-income subtotals omit missing amounts with explicit coverage counts; total margin becomes unavailable if any completed record lacks either amount.

Rent reads the existing GLOBAL DriverRentConfiguration without creating defaults. The saved percentage is applied to selected completed driver earnings by London week, capped per driver-week. Drivers reaching the cap in multiple weeks count once in Full rent drivers. Missing configuration, incomplete Cost/driver identity or unsupported cap values make the estimate unavailable. Partial periods/payment filters produce a partial estimate; it is not a rent receipt or billing statement. Actual company income requires actual rent receipts; no ledger for those receipts was found/introduced by this task, so that card explicitly requires data rather than adding estimated rent to actual income. No commission rate or discount funding rule is invented.

## Access and bounded reads

Page and API require bookings.view, reports.view and revenue.view. Driver rankings additionally require drivers.view. Anonymous requests get 401; insufficient permissions get 403; invalid filters get 400. Query errors/limits return a visible retry/shorter-range message with 503, not stale metrics or a truncated success.

The business query uses a repeatable-read read-only transaction. SQL computes aggregates; individual Booking payloads, contact data and addresses are not exported to the browser. Total and area metrics share a GROUPING SETS aggregation. Time/rent/driver queries skip the unused zone/recovery joins. Output is bounded (1,000 areas, 10,000 driver-weeks), with 12-second statement and 55-second transaction limits, 8MB work_mem, JIT off and no parallel gather workers for these interactive requests. No automatic polling is added; users refresh explicitly. These bounds fail the whole report visibly if exceeded. A full live-history benchmark/index review has not been performed.

Requests abort stale client fetches and discard out-of-order responses. Loading clears prior data, so an error or new filter never displays old cards under a new period. Filter state is shareable in the URL.

## Validation

- 19 relevant tests passed, including real PostgreSQL integration checks for signed amounts, zero/unknown values, source preservation, provider isolation, event deduplication, strict driver attribution, payment filters/mixed labels, date boundaries and rent caps. Existing London and revenue regressions are included.
- A 100,000-booking synthetic volume test passed, returning bounded aggregates in about 3.8 seconds on the final run (512MiB PostgreSQL container, two CPUs). This is not a performance promise for the live database with millions of bookings/webhooks.
- The first repeated volume run used an in-memory PostgreSQL data directory and hit its 512MiB container limit (oom_kill=1). The synthetic container was recreated with disposable disk storage, bounded WAL/shared buffers, and the same memory limit. All tests passed afterward with oom/oom_kill=0. No production database/container was affected.
- Production Next.js build passed, including full repository TypeScript and lint checks. Existing test fixtures received explicit nullable types/mocked-return types/assertion narrowing and an equivalent array loop to fix pre-existing build blockers; assertions were preserved. The legacy optional revenue-rule argument is explicitly retained without changing financial behavior.
- Playwright passed against **next start**, not only the development server: 401/403/400 gates, real synthetic aggregate responses, payment/time/custom filters, seven-day chart, card persistence/order, dark/light/mobile screenshots, no horizontal overflow, empty/error states, no stale cards and no browser exceptions. An auto-fit animation/unmount issue found in this test was fixed and reverified. Source booking rows remained unchanged.
- Evidence: `/workspace/taxicrm-local/analytics-tests.log`, `analytics-build.log`, `analytics-browser.log`, `analytics-desktop.png`, `analytics-dark.png`, `analytics-mobile.png`.

All validation used only the hardcoded loopback `analytics_synthetic` database and disposable users/bookings. No live schema migration, backfill, deploy, push or merge was performed.

## Executive overview and area scorecard

The dashboard includes booking-volume and recorded-income changes against the immediately preceding pickup window of equal elapsed duration, using the same payment filter and the same read-only transaction snapshot. Exact comparison timestamps are visible in Europe/London. This is not a matched weekday or local-clock comparison: DST can change local hours. Both windows use current booking statuses, not reconstructed historical statuses. Gross-income percentage comparisons are withheld if either window has missing completed-booking Price; a zero prior denominator is shown as new/no activity rather than an invented percentage.

Completion share uses all selected bookings as the denominator, including ongoing jobs. Unfulfilled outcomes group current cancellations, no fares and rejections without estimating lost income or attributing fault. The confidence panel reports Price/Cost coverage among completed jobs, zone coverage among all selected jobs, and mixed/missing/other payment classifications. It measures coverage, not source accuracy or bookings excluded by missing pickup time.

The area scorecard ranks up to ten known pickup zones by bookings, no-fare volume, cancellation volume or recorded margin, with counts and rates side by side. Margin ranking excludes zones without completed jobs and places incomplete margins last. Negative margins remain signed and prompt a review of discount/loyalty funding; they are not automatically labelled operational losses. No new alert thresholds, financial rules, schema changes, scheduled jobs or external calls were introduced.

Validation: eight model tests plus real synthetic-PostgreSQL correctness and 100,000-booking bounded-output tests (10 total) passed. Synthetic 100,000-booking aggregate runtime was approximately 3.9 seconds in the isolated test environment; this is not a production performance guarantee.

Production build, TypeScript and ESLint checks passed. Browser checks against the local production build passed for the executive overview, confidence panel and scorecard sorting, along with the existing filter, access, preference, error/empty and mobile checks. Light/dark/mobile screenshots use synthetic data; external map tiles were blocked during testing. No production access or deployment was performed.

## Explicit selection and coverage counts

The coverage panel now displays selected booking and completed-booking counts, payment filter, exact London pickup window, and numerator/denominator for each field. Price and Cost use completed bookings; zone coverage uses all selected bookings. Empty selections and zero completed jobs do not imply 100% financial coverage. The panel explicitly distinguishes selected-period coverage from the full historical database and source-accuracy auditing. This is a presentation change: no global count, database copy, altered query scope or live data write was introduced. Three synthetic component-render tests, TypeScript and lint passed. This clarification has not been deployed.
