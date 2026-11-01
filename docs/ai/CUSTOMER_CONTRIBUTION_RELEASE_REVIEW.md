# Customer contribution release review — 27 October 2026

## Decision-ready package

The standalone package adds customer/account contribution and observed customer activity. It is prepared locally, not pushed or deployed. The full company AI agent, BYOK settings, Lyth service, zone SWOT/Business Review and pickup-service KPI work are excluded from this package. They remain separate development work; none is activated implicitly.

Remote `codex/taxicrm` was checked read-only and returned `0a84e8ae98052078d137d9271bc3dc28a0764e8b`. The isolated candidate branch is `codex/customer-contribution-release`, based directly on that ref. Runtime code commits are `c86a92a` (contribution/profile observations), `a370616` (provider evidence in the profile route and conservative reference handling), and `c691bd5` (direct recorded Price in profile totals). The final documentation/test commit can be obtained with `git rev-parse HEAD` in the candidate worktree. The running Coolify image was not re-verified this turn; remote branch identity is not evidence of the currently running image.

Source implementation lives on `codex/taxicrm`: `79801f7`, `5480f4e`, `50f7ff6`. The source branch also contains unrelated unreleased work and must not be pushed wholesale as this release.

## Included behavior

- Business Analytics links to Customer & account contribution.
- Completed frequency, recorded gross receipts and signed margin have separate account and non-account contact rankings. All eligible contributors enter percentages; only top 20 rows display.
- Names come from existing CRM displayName or a recorded accountName. Provider/reference remain visible; name changes never create or merge identities. Where several recorded account labels exist, the selected label is descriptive, not a verified billing identity.
- Account identity is provider + accountId and takes precedence over the booking contact; unattributed bookings and missing financial evidence are counted.
- Missing evidence and signed negative contributions withhold financial Pareto rather than inventing percentages. Known receipts subtotals are labelled. Price £17.10 / Cost £19 remains receipts £17.10 and margin −£1.90.
- Profile observations show completed-pickup recency, positive median interval and trailing 30/previous 30 elapsed-day counts. London weekday/hour slots remain descriptive. No source namespace means no deduplication across unknown sources. Existing shared-contact warnings remain.
- Page and API require bookings.view, reports.view, revenue.view and customers.view. On-demand report queries run in bounded read-only transactions. Limits: 31 London calendar dates, 50,000 grouped identities, 12s statement/20s transaction, four concurrent analyses per process, same-user cooldown.

## Validation

- Source regression: 42 unit/rendering tests passed.
- Selected candidate: 23 unit/component tests and one real isolated PostgreSQL integration test passed.
- Selected candidate production build passed, including compilation, lint and type validation.
- Selected candidate Chromium desktop/mobile checks passed: custom and payment filters, names, signed/missing money, empty selection, invalid range, HTTP 401/403/429, forbidden-page redirect, stale-result clearing and no horizontal page overflow.
- Real contribution API calls used only local synthetic PostgreSQL. Customer-profile UI used the real pure calculator output through a browser route fixture to avoid the pre-existing profile endpoint's weather/snapshot side effects; this is not an end-to-end validation of that endpoint.
- Canonical synthetic Booking rows compared exactly before/after browser reporting. No paid model calls or production data.
- Preview screenshots: `/workspace/taxicrm-local/contribution-desktop.png`, `contribution-mobile.png`, `contribution-profile-mobile.png`. Logs use `contribution-selected-*` in the same local artifact directory. These contain synthetic data only.

## Activation and rollback plan

1. Obtain approval for this standalone scope. No migrations, backfill, schema/bootstrap jobs or source-data rewrites are included.
2. Immediately before publishing, read the deployment resource's branch/image/health and recheck the remote ref. If it moved from the reviewed baseline, stop and reconcile rather than overwriting another release.
3. Publish only the reviewed candidate to the deployment branch using a normal fast-forward update. Do not push main, use force, or add an extra deploy trigger if the configured automatic deployment already starts one.
4. Watch one build/deployment through healthy state and confirm the resulting image commit equals the reviewed candidate. Preserve the existing shared database connection, ingestion pauses, worker settings and externally managed schema configuration.
5. Perform bounded read-only application checks for the new route, permissions, a short pickup window and missing/negative financial handling. This validates current production access/performance; synthetic results do not prove performance over 2.7 million real bookings.
6. If unsuccessful, redeploy the last verified healthy application image. No database rollback is planned because this package has no migration/backfill. The existing customer-profile endpoint can still perform its pre-existing snapshots/weather work; no claim of eliminating those side effects is made.

Human contribution reporting uses the existing TaxiCRM application database connection; it does not require activating cabby_ro, AI memory, model API keys or a Lyth token. AI activation remains a separate review.

## Remaining limits

No calibrated booking probability, churn claim, marketing send, campaign uplift experiment, historical full-database sweep or autonomous business action is included. Replica-wide throttling, production query behavior and actual live application checks remain deployment-stage validation.
