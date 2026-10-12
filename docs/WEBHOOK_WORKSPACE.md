# Webhook configuration workspace

The Configuration > Webhooks UI adapts the source sidebar, source facts and compact event cards from `alinturig-hub/needacabplus-booking`, `app/admin/configuration/webhook-providers.tsx`. It uses TaxiCRM's own receiver URLs, authentication header, Prisma models and processing pipeline; no Need A Cab Plus credentials or backend are copied.

All sources currently use the Autocab payload format. Search, copy URL, refresh, add event URL, edit name/description/enabled state and confirmed deletion are available. Event type and slug remain unchanged when editing. Deletion retains received events and raw payloads through the existing SetNull relation. Active conditions remain unchanged when editing. Provider creation, editing, enabled state and protected deletion are available through the approved provider model.

Configuration APIs require active-user configuration.view for reads and configuration.manage for writes. Received counts are recorded event counts, not successful-processing counts or proof of a healthy connection. Timestamps use Europe/London. Integration > Webhook and Configuration > Webhooks remain separate routes.

Validation uses the loopback synthetic database only. `tests/smoke/webhook-browser.mjs` checks search, URL copying, refresh, editing, delete cancellation, event retention, unauthenticated mutation denial and mobile overflow. Existing `tests/integration/hackney-webhooks.test.ts` checks duplicate, retry and out-of-order processing independently.

## Provider schema extension (isolated environment only)

Migration `20261012100000_webhook_providers` creates WebhookProvider and links existing configurations to the protected default `autocab` source. It changes neither received events nor original payloads. New sources require a 16–512 character key encrypted with the existing AES-GCM integration encryption key and start disabled. Blank keys on edit preserve the existing key. The default source retains environment authentication until a database key is explicitly saved. Provider deletion is restricted while configurations reference it; the default source is protected from deletion.

The receiver resolves a configured event URL's source, rejects disabled sources, verifies its configured header/key and excludes that header from stored metadata. It fails closed if decryption fails. Existing Autocab authentication remains the fallback for legacy default events. Event type and endpoint slug remain globally unique, so sources cannot register duplicate event types or slugs. Providers currently describe Autocab-compatible sources; other payload formats require dedicated adapters. A custom base URL must be routed by the operator to TaxiCRM's existing receiver; saving a URL does not configure DNS/proxies or contact external services.

This code requires the migration before deployment. It has approval for synthetic local migration only, not a production migration or release. Do not deploy this commit to an unmigrated real database.

Validated locally: production build, 2 provider unit tests, 15 existing webhook integration tests, 1 migration preservation test and the Chromium browser workflow including encrypted key storage, blank-key preservation, disabled-source rejection, authentication, header redaction and restricted provider deletion. No real database migration or deployment executed.

## Direct event editor

The Integration Webhook Manager previously linked Edit to `/dashboard/integrations/autocab/webhooks/[id]` without an implemented page. The direct route now loads only that configuration's selected fields, ordered conditions and provider base URL, without fetching event history or payloads. The webhook route segment includes a loading boundary. Missing IDs resolve to the not-found UI (streamed responses can have HTTP 200); readers without configuration.manage receive a disabled editor and API mutations remain forbidden.

The synthetic Chromium workflow validates direct navigation, saving, permission restrictions and missing-ID handling before exercising the provider workspace. Local warm direct-page loading was approximately 250–270 ms; this does not measure or establish production latency. Production timing diagnosis would require authenticated browser network timing or request/query duration logs for the reported URL. This route has not been deployed: the pending provider migration remains authorized only for the isolated database.
