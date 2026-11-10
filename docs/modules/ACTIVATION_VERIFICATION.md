# Activation verification — 10 November 2026

Baseline: production `4a6f7b06c44d6fbb26122aefa71d9e09455c7fb5`.

Passed before release:

- 17 unit/contract tests: existing workspace navigation and London date rules, module ownership/provider coverage, strict configuration, unchanged defaults, optional-module navigation filtering and guard coverage for every switchable page/API. None of the switchable modules owns a scheduled worker.
- PostgreSQL activation integration: concurrent changes yield one committed version and one conflict; failed audit insertion rolls back; no-op changes add no event; another connection reads durable state; corrupt/missing state fails closed.
- Existing PostgreSQL workspace suite: 7 reported tests passed, including its parent, covering financial semantics, permissions and preference conflicts.
- Authenticated synthetic browser: keyboard confirmation/cancel; installation-wide state observed by another user; no-access/origin/body rejection; direct page/API rejection for disabled modules; Copilot Automation tool cannot bypass its module; Business overview API still returns successfully; stale editor conflict/reload; unchanged workspace metrics; 390px mobile has no horizontal overflow.
- Full Next application restart: disabled AI remains disabled; controls restored afterward in synthetic QA.
- Booking row fingerprint unchanged after all authenticated browser checks.
- TypeScript, ESLint and production build passed.

The local app used a loopback-only PostgreSQL container, synthetic accounts/bookings and a network guard. It ran with `next start`, without the production coordinator or scheduled jobs. No real messages, source events, production data changes or live module toggles were used for testing.

No schema migration or new grant is needed. The existing application administration journal is used as durable configuration history. Existing live sending/source flags are preserved. Production post-deployment checks cover health, DB connectivity, assets and anonymous API denial; no genuine live administrator session is available for automated interaction, so live authenticated toggle execution is not claimed.

Important limits: these controls apply to AI Copilot, detailed Reports and manual Automation simulations only. Other capabilities still need boundary work. In-flight accepted reads/simulations can finish. Old tabs may retain prior content until refresh. Do not purge installation module configuration events. Rolling back to code from before these controls would remove enforcement and must not be done blindly after a live module has been disabled.
