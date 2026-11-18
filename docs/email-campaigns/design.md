# Email campaigns: persistence and dispatch proposal

Status: design only. The current browser draft is not saved and does not schedule or send messages.

## Proposed storage

Create CRM-owned tables through a reviewed migration, with no changes to canonical booking records:

- `email_templates`: id, name, subject, body, created/updated timestamps and actor; template revisions keep copies used by existing campaigns.
- `email_campaigns`: id, name, immutable sender/template snapshots at activation, schedule in UTC plus display timezone, state, timestamps and actor.
- `email_campaign_recipients`: campaign id, normalized address, consent evidence, delivery state, unique campaign/address key, claim and provider identifiers. CSV import is bounded and validates addresses, duplicates and evidence.
- `email_suppressions`: normalized address, scope, source, reason and timestamp, used to stop opted-out, bounced or complained-about addresses.
- `email_campaign_events`: auditable state changes, with provider event identifiers for idempotency.

Restrict reads, imports, edits and activation to appropriate marketing permissions. Record sender verification separately: saving an address does not establish SendGrid verification. Imported addresses are not proof of permission to send. Preview and enforce eligibility, suppression and recipient count immediately before execution.

## Execution

Explicitly activate a campaign after reviewing sender, content, audience and schedule. A durable worker atomically claims each eligible recipient and records each result. Unknown provider outcomes must not be blindly retried. Schedule in UTC and render Europe/London with daylight-saving transitions handled. Add signed provider event ingestion and unsubscribe processing before enabling marketing delivery; distinguish provider acceptance from delivery. The worker must recover after a restart and allow pause/cancel. Changes to live schema and worker deployment require review and approval.

## Verification

Use an isolated synthetic database and mock provider. Cover CSV quotes/duplicates/limits, permissions, consent and suppression, UTC/DST conversion, duplicate concurrent claims, restarts, cancellation, unknown provider outcomes and signed event replay. Test UI using synthetic contacts. No real messages are sent in development.

## Implementation progress (draft only)

The branch includes a confirmed activation flow, pause/cancel, an opt-in worker, signed unsubscribe endpoint and signed SendGrid event ingestion. The sender takes a durable claim, rechecks the campaign and suppression state, and makes one provider attempt without automatic retry. Claims left by crashes become UNKNOWN; this does not establish delivery. The UI displays delivered and unknown counts. CSV consent evidence is recorded by the operator and is not independently verified.

Sending is disabled unless `EMAIL_CAMPAIGNS_ENABLED=true`, a private `EMAIL_WORKER_SECRET` and `EMAIL_UNSUBSCRIBE_SECRET` are provisioned, `SENDGRID_EVENT_PUBLIC_KEY` is valid, and `NEXTAUTH_URL` is HTTPS. SendGrid must be configured to post signed events to `/api/marketing/email/events`; the public key must match the provider configuration. The sender must be verified in SendGrid. Marketing email credentials and recipients must never be put in logs or test fixtures.

Synthetic tests cover CSV validation, event signature and replay, unsubscribe, concurrency and ambiguous outcomes in PostgreSQL, and the desktop/mobile interface with mocked responses. Release remains blocked on production database identity and ACL verification, a reviewed installation, runtime configuration, a real provider webhook verification, and a controlled end-to-end test. Marketing is not yet independently switchable in the current module registry; the separate send flag must remain off until activation is deliberately authorized. Provider acceptance is not delivery.
