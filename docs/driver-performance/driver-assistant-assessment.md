# Driver profile and assistant: source assessment

The current profile shows recorded shift hours, jobs, completed/no-fare/cancelled counts, revenue as calculated by the existing service, accepted/rejected events, and metered distance coverage. The DriverSessions component shows recorded London-day sessions. These are existing definitions, not a validation of total driven miles, break time, offer price or motivation. The profile summary is a deterministic presentation of these values, not a language model or driver score. Categories may overlap.

The existing Copilot route has bounded aggregate answers and optional OpenClaw refinement with deterministic fallback. It does not establish a dedicated, context-aware assistant for an individual driver. `codex/owner-agent-release-review` contains a separate historical candidate, not an enabled production assistant; it requires integration and verification against the current release and deployment-specific data isolation/provider configuration. Do not replace the current branch or infer that the old candidate is live.

## Access issue to resolve before individual-driver AI

`GET /api/dashboard/drivers/[id]` authenticates the session and checks `drivers.view` for metered-distance output, but other driver details and metrics are returned to authenticated sessions regardless of that permission. The sessions endpoint has a separate permission check. This is a code finding, not a verified exploit in a particular deployment. A complete authorization review must check page, API and any assistant consistently, including disabled modules, test approved roles, and avoid disclosing the existence of individual drivers to unauthorized sessions. Driver self-access is not provided by this assessment and requires a secure identity-to-driver mapping.

## Proposed assistant boundary

Use a separately authorized, driver-scoped, read-only evidence provider. Give the model only the minimum facts needed for the question and display the period, definitions, source/coverage and data limitations beside its answer; validate generated statements and support an unavailable/fallback state. Do not send names, contact details, raw GPS positions or unnecessary booking payloads to a model provider. Never infer a refusal reason, psychological trait or worker performance judgment from correlation alone. No automated actions, employment decisions or external messages. Compare calculated results with synthetic cases before any production activation.

Before total/on-job/empty mileage, verify GPS sampling gaps, timestamp ordering, driver/vehicle assignment, London-midnight clipping, accepted-to-completed status intervals and provider identity. Report partial or unavailable rather than zero where coverage is inadequate. Treat breaks as unverified without explicit status evidence. The related aggregate-only source inspection is documented in `initial-assessment.md`.
