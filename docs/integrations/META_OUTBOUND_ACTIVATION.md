# Direct Meta outbound activation prerequisites

Read-only Graph v25.0 checks confirmed app TaxiCrm ID 1800340067849051 and
Phone Number ID 1313815698492609 in configured WABA. These are the Meta test
assets, not the pending real number. Values saved securely in Coolify; no send or
deploy performed. Temporary token validity is time-limited and must be rechecked.

meta-send.ts is an internal, disabled-by-default transport. No HTTP send route
exposes it. Successful provider acceptance is not delivery. Timeout/malformed 2xx
becomes UNKNOWN and must not be automatically retried. No server-side idempotency
is assumed at Meta. Database transaction must claim operation before calling it.

Next persistent requirement: reviewed outbound record with connection/WABA scope,
unique operation key + request hash, actor, recipient, approved template snapshot,
QUEUED/SENDING/ACCEPTED/UNKNOWN/REJECTED states, provider message ID and attempt
timestamps. Atomic claim prevents two workers sending one operation; ambiguous
outcomes need reconciliation/manual review. Match webhook statuses by business
phone + provider message ID. Record per-recipient consent/purpose and suppression
checks. Client phone/IDs are not assumed to map to a verified CRM customer.

A production migration is not approved by saving credentials. Prepare and test the
persistent schema in isolation, then present migration and release for approval.
No real message or production test was sent during this transport implementation.

## Isolated durable outbox schema — 2026-11-03

Migration 20261103000000 introduces WhatsAppOutboundMessage, not applied live.
An immutable template snapshot, actor, recipient, purpose and eligibility evidence
are stored before network dispatch. Connection/operation uniqueness plus stable
request hash detects key reuse with changed content. Atomic QUEUED -> SENDING
claim permits one attempt; recovery marks stale SENDING operations UNKNOWN instead
of retransmitting. This prevents automatic duplication but cannot establish exactly
once delivery at Meta. UNKNOWN requires provider reconciliation/manual review.

Real networkless PostgreSQL 17 tests: eight concurrent inserts -> one row; eight
competing claims -> one winner; accepted outcome requires provider ID; UNKNOWN
and ACCEPTED cannot be claimed again. Separate unit test checks request fingerprint
stability and mismatched retry rejection. Temporary database/container removed.

Still pending: protected operator send API/UI, server-side eligibility recheck,
transactional outcome persistence and webhook correlation, template verification,
retention controls, and authenticated cross-tenant scope resolution. The outbox
functions are internal primitives, not an activated sender. Approval for isolated
schema testing does not authorize live migration or real test sends. No startup
migration, new live privileges or network messaging enabled by this commit.

## Controlled test-send operator flow

Protected POST /api/dashboard/marketing/whatsapp/send-test requires existing
configuration.view, integrations.view and integrations.manage, same-origin POST,
confirmSend=true and an operation key. Requires both META_WHATSAPP_SENDING_ENABLED
and META_WHATSAPP_TEST_SEND_ENABLED; recipient must match server-controlled
META_WHATSAPP_TEST_RECIPIENTS (comma-separated E.164). Only hello_world/en_US is
supported. This is an operator test, NOT a marketing-consent mechanism or campaign
sender. Never enable it for arbitrary recipients or expose general client payloads.

Outbox enqueue/claim commits BEFORE network dispatch. Accepted ID/outcome is then
persisted. If saving acceptance fails, SENDING remains and cannot be reclaimed.
Timeout -> UNKNOWN; provider rejection -> REJECTED. No automatic resend. An operator
must reconcile ambiguous operations; UI retry retains the same key while mounted.
Reloading creates a new operation, so UI warns against reload-and-resend. A future
persistent operation history/recovery screen is still needed for usability.

Inbox optionally joins outbound records to webhook read model by configured business
phone and Meta message ID. Displays the stored template reference, not fabricated
rendered body. Preserves received READ status and existing provider participant
identity. The query remains bounded to 200 records; no claims of complete history.
No schema migration, deploy, send activation or real send performed in this stage.
Production requires reviewed outbox migration, SELECT/INSERT/UPDATE on that table,
secure flags/allowlist, then approval for the first actual test message.
