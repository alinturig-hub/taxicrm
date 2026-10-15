# CRM booking effects worker

Need A Cab Plus writes canonical bookings and a `BookingPostCommitEffect` row in the shared PostgreSQL database. TaxiCRM owns the customer prediction, location enrichment, account reconciliation, and daily revenue metrics triggered by those rows.

TaxiCRM starts `scripts/crm-effects-worker.mjs` as a separate process when `CRM_POST_COMMIT_WORKER_ENABLED=true`. It claims due rows with `FOR UPDATE SKIP LOCKED`, runs the CRM effects, and marks each row `DONE`. Failures return to `PENDING` with exponential retry; expired leases can be reclaimed after a process crash. The process restarts automatically if it exits unexpectedly.

The shared database role used by TaxiCRM needs `SELECT, UPDATE` on `public."BookingPostCommitEffect"`. `GET /api/internal/crm-post-commit-worker` reports access and queue counts when called with `x-cron-secret: <CRON_SECRET>`.

Cutover order: deploy this code with the flag off; grant table permissions and verify the diagnostic; set `CANONICAL_BOOKING_EFFECTS_ENABLED=false` on Need A Cab Plus; then set `CRM_POST_COMMIT_WORKER_ENABLED=true` on TaxiCRM. Pending rows remain in the database throughout. For rollback, disable the TaxiCRM worker first, wait for in-flight leases to expire, then re-enable Need A Cab Plus effects.
