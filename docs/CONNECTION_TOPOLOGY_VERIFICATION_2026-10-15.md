# Verified current integration topology

Verified read-only via Coolify deployment settings and the authenticated GET diagnostic on 15 October 2026 at approximately 07:20 Europe/London. No environment writes, provider requests, queue draining, SQL writes or deployments were performed by this audit.

## Sources and versions

- TaxiCRM branch codex/taxicrm, deployed commit dac9a661a946c2e73c39dfdceb038ea93a6c1479.
- NeedACabPlus main, repository commit 03ac36820b065845d26610414992766e1504e4bc. A deployment of that commit was in progress during observation; a prior deployment of the same commit was finished. No code was pushed to main.
- Both applications reported running:healthy.

## Confirmed configuration

The two DATABASE_URL bindings resolve to the same configured host, port, database path and schema. Comparison was performed in memory; URLs, database credentials and tokens were neither printed nor saved. This verifies configured endpoint equality, not a direct PostgreSQL server identity query.

TaxiCRM: BOOKING_WEBHOOK_WRITER=NAC, AUTOCAB_WEBHOOKS_PAUSED=true, DATABASE_SCHEMA_MANAGED_EXTERNALLY=true. Direct legacy Autocab callbacks are acknowledged and ignored; this is deliberate cutover behavior.

NeedACabPlus: CANONICAL_BOOKING_WRITER_ENABLED=true, AUTOCAB_OPERATIONAL_WEBHOOK_WRITER_ENABLED=true, AUTOCAB_REGISTRY_WRITER_ENABLED=true. The canonical worker handles bookings, operational handlers process vehicle tracks and driver shifts, and registry synchronization covers drivers, vehicles, accounts, zones and generic API records.

NeedACabPlus also has its TaxiCRM booking/live/dispatch/customer reads enabled, no-booking-copy enabled, and legacy TaxiCRM webhook ingest disabled. The existing shared-reader URL did not match the main TaxiCRM configured database identity; this secondary reader path needs separate non-secret topology clarification before assuming every read uses the same endpoint. No reader binding was changed.

The post-commit callback targets TaxiCRM's /api/internal/booking-post-commit and the two shared-secret bindings match. Their values were compared only in memory.

## CRM worker observations during the parallel rollout

CANONICAL_BOOKING_EFFECTS_ENABLED=false in NeedACabPlus; CRM_POST_COMMIT_WORKER_ENABLED was not set in TaxiCRM and its authenticated GET diagnostic returned enabled=false. TaxiCRM had SELECT/UPDATE rights on BookingPostCommitEffect.

Two snapshots around 46 seconds apart showed DONE increasing from 4,819 to 4,822. The first had no pending rows; the second had 1 pending/due row and no processing rows. Therefore the two disabled scheduled-effect settings alone do NOT explain the observed completions. This is not enough evidence to declare either a stalled pipeline or an active TaxiCRM worker. An independent/manual consumer, rolling deployment or effective process configuration may explain it. These observations were taken while another deployment was active. No worker flag or queue state was changed by this task.

Follow-up at 07:24:41 Europe/London: the NeedACabPlus deployment had finished, the authenticated TaxiCRM diagnostic returned enabled=true, and the queue reported 4,856 DONE, 1 PENDING/due and 0 PROCESSING. NeedACabPlus still had CANONICAL_BOOKING_EFFECTS_ENABLED=false. This supersedes the earlier disabled-worker snapshot and is consistent with the intended split: NeedACabPlus writes canonical data; TaxiCRM consumes CRM effects. Queue counts are point-in-time observations, not a no-backlog SLA or proof of every historical event. The configuration change happened outside this task; this audit made GET requests only.

## Interpretation

Operational data is currently written through NeedACabPlus into a shared database that TaxiCRM reads. This is not an independent database-to-database import connection. Autocab remains an upstream source; provider=AUTOCAB payloads must retain their provenance even when NeedACabPlus performs the write.

Do not generalize this to every field: TaxiCRM still owns CRM behavior (profiles, tags, prediction/enrichment and reporting), and weather/Places can have other upstream providers. Storage location, upstream source, transport and canonical writer are distinct concepts.

## Safe implementation boundary

The approved isolated connection registry is additive and starts with DRAFT records only. It does not replace existing database URLs, re-enable Autocab ingestion, provision a database, assign an active writer, copy bookings, change external references on existing records, or migrate either production application. NeedACabPlus code is being inspected for compatibility; no production or main-branch changes are made.
