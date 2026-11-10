# My workspace: unified personal home

## User-visible result

`/dashboard/workspace` becomes the single My workspace page and navigation entry. `/dashboard/command-center` redirects there, retaining recognized period parameters. Login keeps its existing workspace destination. The separate executive reports and other module routes are retained; no business module is removed.

Users choose a starting focus (business owner, marketing, operations or technical), add/hide permitted cards, reorder with keyboard-accessible buttons, and choose Today, Yesterday, Last 7 or Last 30 London calendar days. Focus changes presentation, never roles or privileges. Business defaults exclude webhook/processing failures even for an administrator with full technical access. Technical data is queried only when an authorized user selects its card. Quick access follows the focus and existing navigation rights; the existing TaxiCRM Agent chat stays available.

Layouts and periods are saved per authenticated User, not in localStorage. New sessions/devices load the same account row; another user has a separate default/layout. Explicit empty layouts are supported. Prior Today browser layouts can optionally be imported into the editor and then explicitly saved. They never silently replace account preferences. Existing roles/permission keys are unchanged: financial reporting cards require revenue.view and reports.view; returning-profile aggregates require customers.view and bookings.view; other cards use their existing domain rights. Server checks apply to reads and saves, not just checkboxes.

Writes require same origin, bounded strict JSON and an expected revision. Concurrent saves return 409 instead of overwriting a newer layout. A reload action recovers from that conflict. Errors, empty selections, loading, unavailable and partial figures are visible. The mobile layout has no horizontal overflow at 390px. Account preference changes do not modify other users, canonical bookings or access assignments.

## Figures and limits

Booking/action, completion, cancellation and no-fare cards use recorded event timestamps in the selected window. Scheduled pickups use the full selected London dates (including later today). Comparisons use the prior equivalent window, retaining London wall time across DST. NO_FARE and NOFARE aliases are recognized for recorded no-fare events. Missing event times are excluded rather than fabricated.

Gross receipts = recorded Price for current COMPLETED journeys completed in the window. Missing prices produce an explicit partial amount; all missing prices are unavailable. Margin = COMPLETED Price minus Cost, withheld if either is missing. Genuine zero/negative values remain signed. This is not net profit. Other financial/report definitions are not rewritten. Financial related links preserve selected London dates; the existing report groups by pickup dates, which is explicitly stated because its totals can differ from event-time home cards.

Returning booking profiles count linked profiles completing a repeat journey in the period, including repeats within that period. Shared contact points can be included, so this is not a verified individual loyalty/retention rate. New contact profiles count CRM creation, not first passenger rides. Prediction signals are the current pending FREQUENCY_REFERENCE_V1 snapshot, explicitly independent of the period; no calibrated probability or marketing eligibility is inferred. Retention/campaign review cards link to existing workflows without fabricating population retention, conversion, delivery or campaign-attribution figures. Processing failures are not described as verified customer impact or overall system health.

The prior Today component/library is retained for historical references but no longer renders the home route. The new home does not reuse its unsupported profit placeholder or account no-fare financial formula. Other screens are unchanged.

## Combined installation and deployment gate

This release includes the already prepared saved time-tag rules and source-event pickup/boarding profile observations from PR26. Their behavior/tests are described in `../time-tag-rules/RELEASE.md`. The advanced owner-agent/provider/memory candidate PR25 remains separate and unactivated until its real analytical/company/storage bindings are verified.

Run only `docs/my-workspace/install.sql` from the immutable reviewed release head using the owner's existing SSH/psql connection to the shared primary q9fahphg3lydu18inysgmerq / postgres. It is a write: installs UserWorkspacePreference and, if absent, CustomerTimeTagConfiguration plus its two defaults. It checks the database, existing owners, expected column types, primary/FK constraints and effective privileges. Existing tag edits and personal layouts are preserved, including when the earlier tag-only installer has already been run. It removes DELETE/default ACL exposure only on these two configuration tables, grants scoped app SELECT/INSERT/UPDATE and cabby_ro SELECT, and does not change Booking/User rows or existing table grants.

The matching Prisma migrations record the schemas. Do not run the whole historical shared migration chain. SQL is transactional with a two-second lock timeout. Require successful COMMIT before merge/deploy: the home reads account preferences at render. No production owner connection is available in the isolated cloud workspace, so owner SSH execution remains necessary. Do not claim account sync/live deployment from synthetic tests alone.

After owner COMMIT, revalidate the actual GitHub main SHA and candidate, merge normally, verify the deployed commit/tree, Coolify health, public pages/assets, anonymous API denial and unchanged production sending flags. Authenticated production interaction still requires an authorized real session; do not fabricate one or change passwords to test it.

Rollback: restore prior b2f5f04e8e5e2c7f8f7d431468fa6fd5fd4e8c7d application and leave the additive configuration tables/layouts in place. No destructive schema rollback is needed. The prior tag worker has fixed time rules, so review cached audience tags before using any restored worker for campaigns. Sending stays disabled.

## Completed isolated verification

- 38 unit tests passed across workspace config/DST/permission/order handling, the included tag/KPI/profile regressions and existing chat follow-up parser.
- Seven reported PostgreSQL service tests (parent plus six scenarios): explicit partial/unknown finances; preserved negative/zero amounts; both return timing cases; permission filtering; per-account isolation/order; concurrent revision conflict. No source Booking changes.
- Exact combined install tested against the prior tag-only installation, edited rules and an existing personal layout; rerun preserved all values. Fresh installation also passed. Production-style default DELETE ACL was removed, scoped grants verified, read-only role refused and Booking unchanged.
- TypeScript, targeted lint and production Next.js build passed.
- Authenticated Chromium against production build and isolated PostgreSQL: legacy route redirect; one home nav entry; default owner hides failures; optional legacy import/cancel; keyboard customization, reordering and period persistence; second browser context/mobile loads the same account layout; other account unaffected; no horizontal overflow; concurrent-save UI recovery; origin/guest/unauthorized-card/user-selector rejection. Desktop/mobile screenshots inspected.
- SHA256 comparison of all synthetic Booking rows before/after browser tests matched. External requests were blocked; the production worker entrypoint was not started in QA. No real messages or production DB writes were performed by tests.
