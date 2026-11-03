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
