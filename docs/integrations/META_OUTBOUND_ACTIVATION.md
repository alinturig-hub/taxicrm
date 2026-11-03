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
