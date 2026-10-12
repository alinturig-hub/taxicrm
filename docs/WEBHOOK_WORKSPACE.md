# Webhook configuration workspace

The Configuration > Webhooks UI adapts the source sidebar, source facts and compact event cards from `alinturig-hub/needacabplus-booking`, `app/admin/configuration/webhook-providers.tsx`. It uses TaxiCRM's own receiver URLs, authentication header, Prisma models and processing pipeline; no Need A Cab Plus credentials or backend are copied.

Autocab is the only supported source in the existing schema. Search, copy URL, refresh, add event URL, edit name/description/enabled state and confirmed deletion are available. Event type and slug remain unchanged when editing. Deletion retains received events and raw payloads through the existing SetNull relation. Active conditions remain unchanged when editing. No provider CRUD is presented until a provider model is approved.

Configuration APIs require active-user configuration.view for reads and configuration.manage for writes. Received counts are recorded event counts, not successful-processing counts or proof of a healthy connection. Timestamps use Europe/London. Integration > Webhook and Configuration > Webhooks remain separate routes.

Validation uses the loopback synthetic database only. `tests/smoke/webhook-browser.mjs` checks search, URL copying, refresh, editing, delete cancellation, event retention, unauthenticated mutation denial and mobile overflow. Existing `tests/integration/hackney-webhooks.test.ts` checks duplicate, retry and out-of-order processing independently.
