# Company AI providers and Lyth orchestration

This extends the local owner-agent implementation. It has not been deployed or activated in production. Existing company/database isolation requirements from OWNER_AGENT_V1.md still apply: one authorised company dataset per deployment, a separate SELECT-only role, and server-side tenant identity. This is not shared-database multi-tenant SaaS isolation.

## Roles

- Company owner: uses the agent and, with configuration.manage, configures the company's model provider/key and confirmed presentation preferences.
- Dedicated TaxiCRM owner agent: performs a small allowlist of read-only business analyses using canonical records and deterministic financial calculations.
- Lyth: an optional operator/orchestrator calling a separate service interface. Its initial permission is ANALYSE, not arbitrary execution, booking writes, API-key retrieval, provider configuration, schema changes or source-code editing.
- Model provider: classifies an untrusted question into a fixed permitted analysis. It cannot generate SQL or execute tools. It receives the question/presentation enums, not raw Booking rows, customer identities, driver coordinates or report facts.

Lyth's existing infrastructure administration is separate from this API contract. Service permissions do not become customer permissions. Conversely, a bearer service token cannot authenticate as a human/company administrator. The API is not a security boundary against an infrastructure administrator who already controls files and server encryption keys. Commercial operator access needs explicit company provisioning and revocation, not a universal hidden customer backdoor.

## Providers and company-owned keys

The UI supports OpenAI, Claude (Anthropic), Ollama and No model. Owners specify a model ID available in their account; no model is silently installed or selected. OpenAI uses its fixed HTTPS Chat Completions endpoint and bearer authentication; Anthropic uses its fixed HTTPS Messages endpoint, x-api-key and API-version header. Ollama uses its OpenAI-compatible /v1/chat/completions endpoint on an operator-approved origin. Destination credentials/query strings/fragments and arbitrary paths are rejected. Remote services need HTTPS; plaintext is limited to explicit loopback origins. The operator controls the exact Ollama origin allowlist, not the company client.

Keys are encrypted with the existing AES-256-GCM integration encryption key. The encrypted envelope binds tenant, provider, model, destination, enabled state and cloud consent. It is checked on every read/use. Public responses contain hasKey, never key plaintext or ciphertext. A blank key is retained only for the same provider/destination. Provider changes never inherit the old company's/provider's key. An explicit clear removes the current key; historical keys are not copied into the audit history. Key text is cleared from the form after save/error/closing the panel.

Saving requires review and explicit confirmation, uses expected-revision conflict detection, and never calls a model. Enabling OpenAI or Anthropic requires explicit consent to sending user-written questions to that cloud provider. User questions may contain information the user types; do not claim they are anonymised. Providers bill the configured account. The separate Test saved model button makes one bounded synthetic help request, which may incur API usage; it sends no company report or booking records. There are no automatic tests on save, silent provider fallbacks or platform spending-limit guarantees. Models must support the selected provider's wire API and small classification budget; incompatible models/outages fall back to deterministic reports rather than invented answers.

Where no company provider record exists, the previously configured deployment model binding remains a visible deployment default. Saving No model creates an explicit override that disables that fallback. Failures on a chosen provider never send the request/key to a different provider. The UI indicates whether a deployment default is active.

Provider settings use a separate tenant-hashed file in the existing mandatory durable company volume. This avoids a new database schema for the current prototype; it is not canonical booking data or a new ingestion writer. Records are locked, atomically renamed/fsynced, mode 0600 and size-limited. Audit history keeps actor/time/provider/model/key-change metadata, not historical secrets. Up to 100 changes are supported, with one final explicit No model/key-removal transition available at revision 101 so exhaustion cannot prevent disabling. Beyond that, administrative storage redesign is required. A missing/wrong encryption key fails closed; never rotate the existing integration encryption key casually, because it protects other integration credentials too.

### HTTP contract

`/api/dashboard/ai/owner-agent/provider` requires authenticated intelligence.view + configuration.manage access.

- GET: redacted saved settings, revision, storage readiness and whether a deployment default is active.
- PUT: `{confirm:true,expectedRevision,settings:{provider,model,baseUrl,enabled,cloudConsent,clearKey,apiKey?}}`. No query/tenant override, unknown fields or arbitrary instructions are accepted. Same-origin required.
- POST: `{confirm:true,expectedRevision}` tests the saved enabled connection only. Same-origin required; quota/concurrency limits apply. Provider errors are not echoed with credentials.

`INTEGRATION_ENCRYPTION_KEY` and `TAXICRM_AGENT_MEMORY_DIR` must be configured securely before saving. `TAXICRM_AGENT_OLLAMA_ORIGINS` is an administrator-controlled JSON array of exact approved origins. Do not copy the synthetic encryption key from tests or put real API keys in source, logs or chat.

## Lyth task service

Endpoint: `/api/internal/owner-agent/tasks`. It is disabled by default, independently of human sessions. Activation requires both `TAXICRM_AGENT_SERVICE_ENABLED=true` and a securely injected random `TAXICRM_AGENT_SERVICE_TOKEN` of at least 32 characters. Use a distinct per-company token, not a model API key or database password. The token is never returned to the browser. Rotate/revoke through secure runtime configuration. HTTPS and operator access controls are required before production use.

- Authenticated GET without parameters returns company/principal/capabilities only.
- GET `?requestId=<UUID>` retrieves that company's recorded task; UUID alone grants no access.
- POST accepts exactly `{requestId,operation:"ANALYSE",question,preset?,payment?,from?,to?}`. Scope comes from the deployment, never a caller tenant/company ID. Dates use explicit period parameters, maximum 31 London calendar days. Unrecognised operations and write/credential requests are refused.
- DONE returns HTTP 200 and structured evidence; RUNNING returns 202; FAILED returns 503 with a generic recorded error. Invalid input, auth and idempotency conflicts use 4xx responses.

The UUID is the idempotency key. Request contents are hashed in a canonical order. An identical retry returns the original task/report without another model/data request, even if a rolling period has moved on. A different payload under the same UUID is refused. Concurrent submissions cannot execute the same ID twice. Failed tasks are not silently re-executed; Lyth must explicitly decide to create a new request after reviewing failure. A crash can leave RUNNING/lock records; do not steal locks or replay them automatically.

The journal stores a question hash, fixed LYTH_SERVICE principal, timestamps/state and the aggregated result, not the raw question, bearer token, model key or source rows. Results can contain confidential company financial aggregates; keep the company volume private and backed up. It is a synchronous bounded HTTP task interface, not a provisioned separate machine or a durable background worker/queue. There is no scheduled agent polling or autonomous self-modification.

There are at most 500 journalled tasks per company in this prototype; further new tasks are refused, not silently deleted. Deleting/moving active deduplication records would allow old IDs to execute again, so do not treat file deletion as quota recovery. Production scale needs a durable task/idempotency/audit design with retention and separate schema approval. Process-local request/concurrency limits from owner-agent v1 also apply; multiple replicas need shared limits/locking before rollout.

## Deployment state and next boundary

No production credentials, schemas, data, OpenClaw configuration or API billing were changed. Coolify's available applications/services/server resources did not expose assistant/OpenClaw, so the existing cabby_ro binding has not been retrieved or copied. Lyth can provision that existing secure read-only binding once its host/configuration is available, without sending a password in chat. The service token and provider keys are new, independent bindings, not a reason to grant the agent the app's writer role.

Before resale, complete central tenant/membership isolation, durable database-backed company settings/secrets/audit and task storage, per-company service credentials, billing/usage quotas and retrieval isolation. The current filesystem-backed dedicated deployment is a first own-company pilot. No code or schema change implementing that future shared SaaS design is claimed here.

## Local validation

36 synthetic unit/component/real-PostgreSQL regression tests passed, including tenant-bound encrypted keys, retained-key/provider-switch rules, explicit disable/clear at audit capacity, model wire formats, no cross-provider fallback, service authentication, concurrent task idempotency, generic failure journalling and unchanged canonical Booking rows. The production build, TypeScript and lint checks passed. A production-build browser/API run passed RBAC, redacted key responses, saving without any model call, provider-switch key isolation, the explicit model test, model-routed read-only signed-money analysis, Lyth task execution/retrieval/retry/conflict, customer-auth versus service-token separation and mobile layout.

All keys and company data in tests are synthetic. Claude/OpenAI HTTP formats were tested with mocked transports; the browser used a temporary loopback OpenAI-compatible mock for the Ollama path. No real cloud API key, paid provider request or actual local LLM inference benchmark was used. No production deployment/configuration, database schema/data or OpenClaw files were changed.
