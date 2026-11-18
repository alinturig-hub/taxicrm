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

The branch contains signed unsubscribe tokens and an unsubscribe endpoint; GET is read-only and POST records suppression. A signed SendGrid event endpoint validates ECDSA signatures and timestamps, deduplicates event IDs, and records delivery, bounce and suppression events for correlated synthetic recipients. `EMAIL_UNSUBSCRIBE_SECRET` (at least 32 bytes) and `SENDGRID_EVENT_PUBLIC_KEY` must be provisioned privately before these endpoints are used; neither is configured by this branch. The claim primitive only claims due, consent-evidenced, non-suppressed recipients using a durable transaction; it does not send messages.

Do not enable scheduling yet. Still required: an authenticated activation and pause/cancel flow, a sender that appends unsubscribe links and uses recipient correlation IDs, integration with the existing worker, suppression checks immediately before sending, safe recovery of ambiguous outcomes, real PostgreSQL concurrency/restart tests, SendGrid event integration tests, access/grant and migration review, and browser end-to-end verification. Provider acceptance is not delivery. No production migration or send is performed by these changes.
