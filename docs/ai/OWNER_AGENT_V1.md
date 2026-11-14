# TaxiCRM company owner agent — first implementation

Extension: company-owned Claude/OpenAI/Ollama settings and the separate Lyth analysis service are documented in [PROVIDERS_AND_LYTH_SERVICE.md](PROVIDERS_AND_LYTH_SERVICE.md); operational preparation is in [LYTH_OWNER_AGENT_HANDOFF.md](LYTH_OWNER_AGENT_HANDOFF.md). The dedicated-company isolation boundary remains unchanged.

## Delivered scope

A separate `/dashboard/ai/owner-agent` workspace and authenticated `/api/dashboard/ai/owner-agent` API provide an initial dedicated owner assistant. Existing Copilot/OpenClaw integration is unchanged and is not contacted by this implementation.

Supported tools are a fixed allowlist: business overview, demand, completed-job money, current cancellation/rejection/no-fare outcomes, and pickup-area summaries. They use the existing bounded analytics reader in a read-only transaction. Responses contain exact pickup window/payment filter/as-of time, source links, knowledge version and a deterministic evidence hash. The hash identifies the response evidence; it is not a signature or a retained snapshot. Dashboard links using rolling presets are refreshed views, not immutable reproductions of old answers.

The financial contract remains COMPLETED-only: Price = gross receipts, Cost = driver money, difference = margin before rent/commissions/expenses. Negative values remain signed; missing amounts stay unknown. There is no model-generated SQL, tariff substitution, loss estimate, fault attribution or modification of bookings. The model, if configured, chooses only an allowlisted analysis. Numbers and explanations come from deterministic application code, not model prose.

## Isolation boundary

This is **dedicated deployment / dedicated company database mode**, not a completed shared-database multi-tenant SaaS implementation. Each company needs a server-side deployment binding and a database containing only its authorised operator's data. Current dispatch `companyId`, account IDs or a client-supplied tenant ID are not security boundaries. Requests containing tenant selectors or unknown keys are rejected. Tenant identity is resolved from administrator-controlled runtime configuration.

The agent uses its own database connection and role. Configuration requires the same database endpoint/database/schema as that company's app, but a different role. Before every analysis the role/database are verified; superuser/role-creation/database-creation/replication/RLS-bypass capability, writable application tables or public-schema creation rights cause refusal. The analytical transaction is also explicitly READ ONLY. The pooled connection cannot switch database binding within the process lifetime. Data is aggregated server-side; driver details, raw payloads, customer identities and routes are not included in the agent response or model context. Zone names and counts are business aggregates, not passenger diagnoses.

The administrator must verify actual company exclusivity of the dedicated database before activation. The flags attest that deployment design; they cannot detect a mistakenly co-mingled database. No company discovery or automatic tenant onboarding was added. A central app serving multiple customer companies still requires membership/authentication isolation, tenant-scoped storage and enforced database isolation/RLS, tenant-specific retrieval and audit. That schema design requires separate owner approval before implementation. Do not enable this agent against a co-mingled database.

## Confirmed memory, not automatic training

Initial remembered values are bounded enums: business priority (balanced, margin, no-fare review, completion) and brief/detailed evidence. They influence presentation; they do not alter financial/KPI definitions, booking allocation, marketing consent or system permissions. There is no arbitrary instruction/document upload, RAG/vector store, weight training, autonomous learning or cross-company reuse of conversations in v1.

Only `intelligence.view` users can open the agent. Analyses additionally require bookings, reports and revenue permissions; v1 requires all three rather than exposing partial financial tools. Preference confirmation additionally requires `configuration.manage` and explicit confirmation. The UI presents a proposal before saving. The server performs an expected-revision comparison, records actor ID/time/preferences, writes atomically and keeps the revision history. A conflicting confirmation is refused. No question or chat transcript is stored; the browser retains at most 20 exchanges in the current tab.

Memory is stored in a configured, administrator-owned filesystem directory outside the repository, with 0600 files, hashed tenant filenames, tenant validation, locking, atomic rename/fsync and 100 KB validation bounds. There are at most 100 confirmations per company; additional writes are refused instead of silently discarding audit history. Filesystem storage avoids a new database schema in this first isolated implementation. It requires a durable volume, appropriate directory ownership/permissions and backups before production use. Container-writable ephemeral paths are not durable storage. Mount a company-scoped memory directory; memory is not written into the canonical Need A Cab Plus database.

A crash may leave a `.lock` file; inspect the writer/process and recover manually while stopped, never automatically steal a live lock. Horizontal replicas need shared locking/storage, central audit and ingress quotas before rollout. Current concurrency/quota is process-local (four analyses total, one active question per user, three-second minimum interval, bounded tracking map). Replicas would multiply those limits. There is no automatic production activation or migration.

## Optional model service

Set an administrator-controlled OpenAI-compatible base URL and model ID for a locally hosted vLLM/Ollama-compatible service. URL configuration is server-only; credentials in URL/query, redirects and public plaintext HTTP are rejected. HTTPS is required except for explicit loopback HTTP. Model calls are bounded to six seconds, 80 output tokens and 16 KB responses. Only exactly one allowlisted tool key is accepted; malformed responses, unknown tools, outages and extra SQL/instruction fields fall back to the deterministic planner.

The configured model may receive the user's question and confirmed presentation enums. It receives no database payloads or individual customer/driver records. User-written questions can themselves contain personal information: do not promise that user text is anonymous, and configure retention/access controls on the model service. The application does not store it. No live model service was contacted or installed during implementation; classification transport was tested with mocks. Without a model the workspace remains an explicit verified-report assistant, labelled “AI model not connected”. English output templates are currently used; this is not a general conversational model or a validated bilingual assistant.

The current single-turn planner does not resolve pronouns or dates from previous chat turns. UI-selected periods define answers, including when a question mentions a different date; the UI states this explicitly. Maximum agent query window is 31 London calendar dates. Forecast questions and unsupported actions return help, not fabricated predictions. Requests for writes, credentials or other companies are refused. The model has no executable tools, shell, source-code editor, database schema tools, messaging tools or access to integrations.

## Runtime configuration (not applied to production)

| Variable | Meaning |
| --- | --- |
| `TAXICRM_OWNER_AGENT_ENABLED` | Explicit `true` to activate; absent means disabled |
| `TAXICRM_AGENT_TENANT_ID` | Server-owned lowercase slug, unique per company deployment |
| `TAXICRM_AGENT_COMPANY_NAME` | Company display name |
| `TAXICRM_AGENT_ISOLATION` | Must be `DEDICATED_COMPANY_DATABASE` |
| `TAXICRM_AGENT_DATABASE_URL` | Secure read-only connection binding, distinct role, same authorised app database |
| `TAXICRM_AGENT_MEMORY_DIR` | Absolute durable company memory volume outside repository; absent disables persistence |
| `TAXICRM_AGENT_MODEL_BASE_URL` | Optional HTTPS model-service URL, or loopback HTTP during development |
| `TAXICRM_AGENT_MODEL` | Optional served model ID |
| `TAXICRM_AGENT_MODEL_TOKEN` | Optional secure model-service bearer binding; never place in files/chat/logs |

Keep the existing app database/auth configuration. No role creation/grants or production configuration edits were performed. Provision/verify the least-privilege reader through the authorised operations process. The existing `cabby_ro` role is a candidate only after its actual grants/company scope are checked; do not substitute the TaxiCRM writer or postgres owner. No OpenClaw instance/files were inspected or changed.

## Validation and next stage

Synthetic tests cover dedicated binding rejection, preference allowlists, tenant-separated memory files, concurrent/stale confirmations, corrupt/foreign/symlink memory, model tool injection/malformed/oversized output, signed/unknown money and source evidence. A real isolated PostgreSQL test checks a SELECT-only role, refuses a role with UPDATE on another application table and compares Booking rows before/after. Browser/API checks exercise RBAC, CSRF, client-tenant refusal, explicit preference confirmation/reload, signed calculations, quota, mobile overflow, external-network blocking and unchanged source bookings. Model transport tests use mocks, not a claimed real inference benchmark.

Next work: validate company/database bindings and reader grants for an authorised rollout; connect and benchmark the actual local model; choose database-backed tenant/memory/audit schema with approval; add consented document ingestion and tenant-scoped retrieval; add evaluated forecasting tools and proposed actions with previews/audit. These are future stages, not capabilities claimed by this first implementation. No deploy, real-data backfill or real-schema migration is included.

Validated locally: 24 agent/analytics component, model and real synthetic-PostgreSQL tests passed, including the 100,000-booking bounded-output regression. Production build, full TypeScript and lint passed. The final production-build browser run passed authentication/RBAC, same-origin enforcement, tenant-field refusal, 4 KB request limit, 31-day range guard, explicit confirmation and preference reload, source-row preservation, signed money, quota, mobile overflow and blocked external network. Screenshots are synthetic. The local model itself remains unconnected; no production deployment was performed.
