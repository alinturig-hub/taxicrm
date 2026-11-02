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

## Marketing template management

Marketing > WhatsApp templates reuses the existing settings and authorization.
Body-only template submission is implemented via Meta message_templates POST.
Requires META_WHATSAPP_TEMPLATE_SUBMISSION_ENABLED=true in addition to the existing
connection settings, integrations.manage, same-origin request, explicit submit action
and a validated draft. Defaults remain disabled. Credentials are never browser inputs.
No media/buttons/authentication template support or local durable draft storage yet.
The form requires preview before submitting; Meta determines approval/category.
Transport ambiguity must be reconciled through template listing/Meta before retry;
there is no durable cross-process idempotency ledger in this phase. No submission
or messaging is authorized by deployment alone. The number's Com.Bot transport is
unchanged. No database migration is needed for this template module.

## Image and button template drafts

Editor supports optional IMAGE header using an existing Meta resumable-upload
sample handle, body text, and up to three validated static buttons (up to two HTTPS
URLs, one phone number, quick replies). This is a conservative supported subset,
not all Meta template formats. Submission still requires explicit server enablement
and Meta approval. Public image URL is not a header_handle. Direct resumable image
upload is not implemented; UI states that limit. No external upload was performed.
Dynamic URL variables, media sending and provider-side image rendering are pending.

## Webhook handshake preparation

Candidate callback: /api/webhooks/whatsapp/meta. Not deployed by this change.
GET verifies Meta hub.mode, challenge and META_WHATSAPP_VERIFY_TOKEN (32+ chars).
POST validates exact raw-body SHA256 HMAC with META_WHATSAPP_APP_SECRET and bounds
payloads to 256 KiB. Both secrets belong in secure server settings, not chat.

IMPORTANT: durable WhatsApp inbox is not activated. Valid POST requests deliberately
return 503 instead of falsely acknowledging/discarding events. Do not subscribe the
messages field or switch a production number to this endpoint yet. The existing
shared WebhookEvent processor scans non-booking events without a provider filter;
reusing that inbox for WhatsApp would risk accidental dispatch to Autocab handlers.
A separate durable inbox or verified provider isolation is required before enabling
subscriptions, plus real database duplicate/replay tests. This commit prepares the
handshake only and does not claim completed message ingestion.

## Durable receipt stage — isolated validation

Migration 20261102000000 adds WhatsAppWebhookInbox only. Original bytes are kept
as strict UTF-8 raw text, scoped to configured META_WHATSAPP_WABA_ID. Unique
connectionKey/bodyHash collapses byte-identical concurrent retry envelopes.
No canonical booking tables or Autocab processors are modified. Authenticated raw
payloads may contain customer data; access and retention policy must be reviewed
before production operation. No message text or secrets are written to logs.

Enable receipt only after reviewing/applying this migration and application role
privileges: META_WHATSAPP_INBOX_ENABLED=true. It also requires the correct WABA ID
and META_WHATSAPP_APP_SECRET in secure settings. Missing table/privilege or database
failure returns 503, never success. Invalid signature returns 401; wrong WABA 403.
The default remains disabled. GET verification remains independently available.

Actual PostgreSQL 17 test: eight simultaneous inserts of the same delivery yield
one record; raw body is preserved and distinct connections do not collide. Unit
checks verify acknowledgement after sink completion and failure propagation.

This is transport receipt only. No conversation/status reducer, AI response,
message-level semantic deduplication, template status projection or sending worker
is enabled. Different byte envelopes with the same logical event may coexist;
a future worker must deduplicate provider message/status IDs, handle timestamps
without regressing state, and mark inbox rows processed transactionally. Receipt
can be activated separately for capture after production approval, but is not a
claim of an operational inbox UI. Existing earlier handshake-only notes describe
the live release until the durable migration and code are explicitly approved.

## Read-only inbox UI first version

Marketing / WhatsApp / Inbox derives a read model from the latest 200 durable
transport envelopes for the configured WABA. It does not mark them PROCESSED or
run a worker. Identical logical message IDs within the same business phone are
shown once; read status does not regress to delivered/sent/failed when reordered.
Conversations are partitioned by business phone and provider participant ID, not
silently linked to CRM customers. Username IDs may differ from phone identities.
Outbound content is unavailable from status-only receipts. Unsupported media is
labelled, not downloaded. No AI response or send occurs.

API and page require existing configuration.view + integrations.view permissions.
Response is private/no-store; raw envelopes never reach browser. Bounded history is
explicit in the UI; semantic persistence, pagination, retention and full conversation
history remain future work. Statuses outside the loaded window cannot be inferred.

Read-only live sample check found zero rows containing the demonstrated message ID
ABGGFlA5Fpa. Do not equate Meta dashboard success with verified receipt of that exact
sample. Repeat official dashboard test and verify DB receipt before claiming it.
