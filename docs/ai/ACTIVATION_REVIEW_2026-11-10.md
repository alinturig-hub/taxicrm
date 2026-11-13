# Owner-agent release candidate, 10 November 2026

Reconciled onto actual production b2f5f04e8e5e2c7f8f7d431468fa6fd5fd4e8c7d, preserving the new TaxiCRM Agent chat, retention and FREQUENCY_REFERENCE_V1. This separate candidate adds owner analytics, evidence-led business review, company-confirmed preferences, encrypted provider settings and the existing scoped Lyth task protocol. It does not change financial definitions, canonical ingestion, schemas or permissions, send messages, create bookings or enable execution of proposed actions. The only existing analytics-reader change permits an injected separately verified read-only Prisma client.

## Verified

- TypeScript, targeted lint and production Next.js build passed.
- Nineteen unit tests passed for agent policy, memory, provider settings/planning and service journal behavior.
- Opt-in PostgreSQL integration passed on guarded local prediction_qa: actual separate read-only role produced signed negative completed Price–Cost margin, source rows stayed unchanged, writer role was refused. Integration now refuses non-local or unexpected DB/user and skips unless explicitly configured.
- Authenticated Chromium with production build and isolated database: owner report via separate read-only role; confirmed company preference survives reload; disabled provider saves without returning an API key; operator financial report denied. No external model calls; external fetch blocked.

Tests used local synthetic company bindings and temporary private storage. This does not establish production company exclusivity, live analytical role grants, mount durability or a real model connection.

## Production blockers verified read-only

On 10 November, the main Coolify resource gbwo4xfa46m5n1klnqxr8afl has no configured TAXICRM_OWNER_AGENT_ENABLED, TAXICRM_AGENT_TENANT_ID, TAXICRM_AGENT_COMPANY_NAME, TAXICRM_AGENT_ISOLATION, TAXICRM_AGENT_DATABASE_URL or TAXICRM_AGENT_MEMORY_DIR. INTEGRATION_ENCRYPTION_KEY exists; do not rotate or expose it. No values of database URLs, tokens or encryption keys were printed. Preview values are not production evidence.

Before activation, an authorized operator must reuse the existing cabby_ro secret binding, validate its effective read-only privileges on the canonical shared primary, confirm the actual intended company scope, mount a private durable directory and set the company binding and memory path. Database ingestion is shared between NeedACab Plus and TaxiCRM: this does not itself establish exclusive legal-company scope. Do not infer it from application labels, dispatch IDs or booking references. Do not use taxicrm_shared_app or postgres as the agent reader.

Exact configuration and checks: LYTH_OWNER_AGENT_HANDOFF.md and OWNER_AGENT_V1.md. No remote configuration/role/mount changes were performed for this candidate. Do not merge/activate merely because local tests passed. Current chat remains functional independently. Lyth service token and external provider/model enablement remain separate, explicit scoped setup; no paid model connection test has been run.

Rollback after a future authorized activation: disable the owner-agent flag and restore the prior application; keep private memory/provider history for review. Do not rotate unrelated shared secrets, remove canonical data or enable a writer role to bypass failures.
