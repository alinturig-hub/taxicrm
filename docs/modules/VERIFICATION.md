# Module foundation verification

Baseline: `c4fea3f85089e2d04afb34473ee0c73b9e52890b` (current production branch when checked on 10 November 2026).

This release only extracts existing workspace calculations into module providers and records responsibility boundaries. It does not implement runtime module activation.

Passed locally:

- 8 unit tests: route/worker ownership, provider metric coverage, existing workspace permissions and London date boundaries.
- Existing workspace PostgreSQL suite: 7 reported passing tests, including its parent suite.
- Golden PostgreSQL comparison against the baseline implementation: identical summaries across TODAY, YESTERDAY, LAST7 and LAST30 with all permissions and booking-only permission. Includes positive profile, prediction and failed-event fixtures.
- TypeScript (`tsc --noEmit`), Next production build and ESLint.
- Authenticated browser regression with real local NextAuth sessions: owner defaults, preserved legacy redirect, keyboard customization/reordering, period selection, account persistence across desktop/mobile, other-user isolation, optimistic save conflict recovery, origin/guest/unauthorized-card rejection.
- Mobile viewport 390 × 844: no horizontal overflow.
- Booking row fingerprint unchanged after browser tests.

PostgreSQL tests used a separate loopback-only container (`taxicrm-module-qa`), synthetic users/bookings and guarded local credentials. The app ran using `next start`, without the production worker coordinator, and external fetch was blocked by a local network guard.

Not performed: production authenticated interaction, production database queries/mutations, deployment, migrations, transport sends or changes to production flags. Existing production schema and source-ingestion ownership are unchanged.

Still required in a later change: administrator module settings, server-side route/service/job enforcement, per-module contributions to customer profiles, source exclusivity and disable/re-enable tests. Ownership metadata alone is not an effective disable control.
