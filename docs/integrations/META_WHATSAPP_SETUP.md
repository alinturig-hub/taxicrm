# Meta WhatsApp setup

This package prepares direct Meta template administration while preserving the existing Com.Bot messaging connection. It introduces no database schema, migration, webhook change, phone-number registration, template submission or message sending.

## Server configuration

Configure these values as encrypted runtime secrets/settings in the TaxiCRM deployment. Never place the access token in source control, chat, screenshots, browser storage or build arguments.

- `META_WHATSAPP_APP_ID`: numeric Meta application ID.
- `META_WHATSAPP_WABA_ID`: numeric WhatsApp Business Account ID. This is not the phone number ID.
- `META_WHATSAPP_GRAPH_VERSION`: an explicit supported Graph API version such as the version shown in the Meta application dashboard. TaxiCRM deliberately has no guessed default.
- `META_WHATSAPP_ACCESS_TOKEN`: an authorized token with `whatsapp_business_management`, assigned to the existing WABA.
- `META_WHATSAPP_ENABLED`: `true` only after the asset assignment and permission scope have been reviewed.

The token is used only server-side and never returned by the configuration API. Do not rotate `INTEGRATION_ENCRYPTION_KEY`; this feature does not use or modify that key.

## Current behavior

The Configuration → WhatsApp templates page reports setup readiness, lists at most 25 existing templates on explicit administrator request and validates a body-only template draft locally. Drafts remain in the browser tab. Preview does not persist or call Meta. Template listing uses a fixed `https://graph.facebook.com/<version>/<waba>/message_templates` destination, an eight-second timeout, no redirects and a bounded response.

The page and API require configuration and integration view permissions. Listing and preview additionally require integration management permission. Requests are same-origin, body-limited, rate-limited in-process and return generic errors without provider bodies or credentials.

Template submission, deletion, editing, authentication templates, buttons/media, pagination, message sending, inboxes and webhooks are intentionally unavailable. Meta can reclassify or reject a submitted category; submission will require an explicit review-and-confirm workflow in a later package.

## Activation checks

1. Create the Meta Business application and associate the Business Portfolio that owns the existing WABA.
2. Assign the application/system user to that WABA with `whatsapp_business_management`.
3. Confirm in Meta that shared access does not require moving or re-registering the Com.Bot-managed phone number.
4. Configure the five runtime values above securely and restart TaxiCRM.
5. Open Configuration → WhatsApp templates. Confirm the displayed App ID, WABA ID and API version, then explicitly list templates.
6. Compare a few returned names and statuses with Meta Business Manager. Do not change Com.Bot webhooks or credentials.

For production template submission, add an audit record, expected revision, explicit confirmation, idempotency, bounded retries and the exact Meta payload/response status without storing bearer tokens. This is a separate schema and operational decision.

## Validation

Unit tests use a synthetic token and mocked Meta responses. Browser tests use synthetic users and a local isolated database. They verify redaction, permissions, local preview, malformed variables and mobile layout. No real Meta, Com.Bot or production database calls are part of development validation.

## Communication foundation (isolated development)

The 20261028000000 migration is generated, not applied to any database. It adds
workspace-scoped communication, consent, suppression, campaign and workflow records.
Credentials are referenced, never stored in message payloads. Booking ingestion stays
owned by Need A Cab Plus. Do not expose these models through application routes until
workspace authorization and relational ownership checks are implemented. IDs currently
use scalar references; repository services must validate same-workspace ownership.

The send eligibility policy is tested with synthetic data: marketing requires explicit
consent and an approved template; suppression overrides eligibility; free-form service
replies require an inbound message less than 24 hours old. Recheck before dispatch.

Still pending: isolated migration execution, relational integrity enforcement, provider
transport selection (Com.Bot versus direct Meta for the existing number), authenticated
webhook receiver and replay handling, queue worker, campaign UI, workflow editor and AI
inbox. No actual sender is activated by this foundation. Do not deploy as a complete
campaign feature. Workflow revisions and audience snapshots must be immutable through
application permissions before execution is enabled.

## Dual-provider adapter

`providers.ts` defines META and COMBOT with explicit capabilities. The authenticated
configuration GET reports both. Meta retains its bounded read-only template API;
Com.Bot is blocked pending its documented API contract. Neither adapter sends messages.
There is no automatic provider fallback: switching transport after an ambiguous timeout
could duplicate a message. Assign one transport to each phone connection before enabling
workers. Campaigns and workflows must call the adapter, not provider-specific URLs.

Com.Bot activation requires vendor documentation for authentication, template listing,
send requests, inbound/status webhooks, signature validation, provider message IDs,
rate limits and retry/idempotency behavior. No Com.Bot URL or credentials are guessed.
