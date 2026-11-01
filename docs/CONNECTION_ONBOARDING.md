# Connection onboarding: audit and staged implementation

Inspected branch: codex/taxicrm, baseline dac9a661a946c2e73c39dfdceb038ea93a6c1479.
The initial code audit was extended by read-only deployment inspection, documented in CONNECTION_TOPOLOGY_VERIFICATION_2026-10-15.md. No direct production database connection or provider API was used.

## Verified code evidence

- `src/lib/prisma.ts` uses one deployment-wide DATABASE_URL. No company-scoped database router exists.
- `booking-writer-ownership.ts` delegates canonical booking writes when BOOKING_WEBHOOK_WRITER=NAC. This is an ownership policy, not transport or database-isolation proof.
- `POST /api/internal/booking-post-commit` authenticates with BOOKING_EFFECTS_SHARED_SECRET and processes an existing webhookEventId. This supports post-commit cooperation with another writer; it does not import a booking payload itself.
- With AUTOCAB_WEBHOOKS_PAUSED=true the legacy receiver acknowledges and ignores callbacks. Do not re-enable it as part of connection planning.
- DATABASE_SCHEMA_MANAGED_EXTERNALLY suppresses startup schema bootstrap. Preserve its configured value.
- `/api/internal/needacabplus/fleet` is a GET export FROM TaxiCRM, not evidence of inbound NeedACabPlus booking ingestion.
- Booking, Driver, Vehicle and Zone have provider/externalId uniqueness. AutocabApiConfiguration has globally unique provider, ApiEndpointConfiguration has globally unique URL, and NormalCustomer has globally unique normalizedTelephone. These cannot safely represent unrelated companies in one shared schema without changes.
- Autocab's companyId is source metadata, not verified tenant authorization.

## Implemented first slice

`/dashboard/integrations/setup`, accessible only with integrations.manage (or super-admin), shows non-secret deployment ownership flags and a draft wizard: company/source, storage, review and JSON download. The hub provides a link for eligible users. It collects no credentials and makes no connection, ingestion or activation requests. A draft can be downloaded or saved in the isolated connection registry. Retrying the same request ID is idempotent; a conflicting plan returns a conflict. The protected registry API only accepts draft fields and exposes no credential columns. The source choices are planning choices, not advertised adapter readiness. Runtime policy is explicitly not connection health.

Existing integration handlers, schedules, financial rules and credentials remain unchanged. The approved additive migration 20261015080000_connection_registry creates IntegrationConnection and ConnectionExternalReference; it has been applied only to the loopback synthetic database. No activation button is offered before isolation, transport and cutover requirements are satisfied.

## Isolation strategy and approved registry foundation

Choose the deployment isolation strategy before a migration:

1. Dedicated TaxiCRM instance/database per customer: keep current per-instance uniqueness; add a connection model for multiple providers in that instance. Provisioning and a controlled copy/reconciliation are required if separating an existing shared database.
2. Shared multi-company instance: introduce Company/Tenant, memberships, IntegrationConnection and tenant-scoped queries/foreign keys/uniqueness throughout the application. Updating only ingestion tables is insufficient; customer phone uniqueness, financial rules, jobs, authorization and exports must also be scoped.

Within either option, the proposed IntegrationConnection stores provider identity, company ownership, encrypted credential reference, enabled state, configured capabilities and data-authority policy. External references must include connection identity; verified cross-provider links prevent double-counting the same booking. Preserve original Autocab payloads and existing provider + accountId revenue semantics inside the chosen company boundary. Do not automatically rewrite existing IDs or reassign financial rules.

For the proposed dedicated-instance first release, the initial connection registry would have: id, providerCode, displayName, companyLabel (descriptive only), status (DRAFT/VALIDATED/ACTIVE/DISABLED), credentialCiphertext, capabilities, ownershipPolicy, createdAt and updatedAt. Add a separate external-reference mapping keyed by connectionId + entityType + externalId, linking to validated canonical entities. This registry alone does not introduce shared-instance tenancy or switch any writer. Existing configurations remain authoritative until a reviewed adapter/cutover explicitly uses the registry. The user approved these tables for isolated development; they are now implemented locally. canonicalId remains an opaque reference: no automatic mapping or public mapping-write API is implemented. A future adapter must validate canonical existence and ownership before creating references.

Prefer a dedicated instance/database per customer for the first commercial release unless a shared-instance requirement is confirmed. This is a proposal, not provisioned isolation.

## Evidence still needed before a real cutover

- Configured shared database/schema endpoint equality is verified in the dated topology report. Table-by-table migration ownership and the secondary shared-reader binding still require clarification before any split. Do not supply connection strings or passwords in chat.
- Runtime ownership flags have now been verified through authorized deployment inspection; see the dated topology report. Reverify them at any future cutover.
- NeedACabPlus ingestion API/webhook contract: authentication method, event IDs/version/time, pagination/history, retry semantics and synthetic payloads.
- Stable NeedACabPlus-to-Autocab booking references and authority for fare/status/customer/driver fields.
- Backup/rollback evidence, bounded comparison counts and checksums, plus post-commit effect retry/reconciliation tests before any writer switch.

The user approved cross-project verification and isolated registry implementation. The wizard saves DRAFT records only and does not alter NeedACabPlus, switch writers, migrate production, backfill or deploy. Production schema ownership/cutover remains a separately coordinated action because both applications use the same configured database.

## Validation

- Four synthetic unit tests passed: provider choices, preservation of the existing connection, storage/cutover requirements, invalid input, exact runtime ownership flags.
- Production build, lint and TypeScript checks passed after regenerating the existing Prisma client.
- Synthetic browser smoke passed: hub navigation, required company validation, Autocab/separate-database review, downloaded JSON content, restricted operator redirect, plus existing workspace checks. The test blocks external HTTP and sends no SMS.
- Existing SMS/provider migrations were applied only to the loopback synthetic database to restore the local test environment during the first slice. The subsequently approved connection registry migration was also applied only there.
- The synthetic registry integration test passed: concurrent idempotency, conflicting request rejection, secret-free public DTOs, preserved ownership, connection-scoped uniqueness, orphan rejection and restricted deletion.
- Browser coverage additionally verifies persistence across reload and denies registry GET/POST to an operator. No external calls or real SMS are made.
