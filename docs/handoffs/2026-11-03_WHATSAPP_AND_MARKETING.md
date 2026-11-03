# TaxiCRM WhatsApp and Marketing handoff — 3 November 2026

## Current state

Direct Meta integration selected. Com.Bot was investigated but is not the selected
transport. Preserve its existing assets; no migration of a Com.Bot number occurred.
Meta test-number hello_world send and actual inbound user replies work. Owner
screenshots confirm messages and read status in the TaxiCRM inbox. The controlled
send UI is allowlisted, uses fixed hello_world/en_US and requires explicit operator
confirmation. Do not send additional messages merely to resume work.

Live branch: codex/taxicrm. Latest release prepared/pushed in this session:
ea207d864d822e77c699712cac263a869e483d7e. Coolify deploy finished healthy.
Verify current remote/runtime before changing it; other contributors may advance it.
The protected POST test-send route returned 401 without authentication.

## Verified Meta identifiers (not credentials)

App TaxiCrm: 1800340067849051.
Test Phone Number ID: 1313815698492609.
Configured test Messaging account / WABA identifier: 1542824367875768.
Read-only API checks succeeded using Graph v25.0. Webhook dashboard uses v26.0;
these are separate settings, not proof of a required Graph version change.
Real-number Phone Number ID: 1406119395919653. Its display name remains In review
and phone status Pending in the latest owner screenshot. Exact registration blocker
is not established. Read-only Graph query of the real ID returned HTTP 400,
code 100/subcode 33: object inaccessible with current token; not proof of deletion,
rejection or specific permission issue. Do not delete/re-add or switch runtime IDs.
Owner may contact Meta support and grant app/token access to the real account.

Official overview reviewed:
https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform
Documentation distinguishes WhatsApp account (phone/business presence), Messaging
account (templates/billing), and Phone Number ID. Do not assume test/real assets
share the same account identity.

## Infrastructure and approved migrations

Shared primary resource needacabplus-shared-primary-20261014,
Docker host q9fahphg3lydu18inysgmerq, database postgres.
App role taxicrm_shared_app; canonical bookings owned by Need A Cab Plus.
WhatsAppWebhookInbox migration was applied by administrator, with SELECT/INSERT.
WhatsAppOutboundMessage migration from ea207d8 was reported applied atomically by
administrator; 15 columns/4 indexes verified, SELECT/INSERT/UPDATE granted.
Additional effective DELETE privilege was reported as pre-existing/default-derived;
it was not changed. Do not infer general schema privileges or use admin credentials
for routine application queries. No canonical booking writes were introduced.

Secure Coolify settings include Meta credentials, test account IDs, receipt/send
flags and explicit test-recipient allowlist. Never copy credential values to this
file, GitHub, logs or chat. Temporary access tokens expire; check before next test.

## Receipt and outbound behavior

Callback /api/webhooks/whatsapp/meta validates GET verification and raw-body HMAC.
Dedicated durable inbox acknowledges only after insertion; exact-body retry scoped
to connection is deduplicated. Invalid signatures reject; foreign WABA rejects.
Dashboard sample previously generated WABA_MISMATCH; actual test-number conversation
works. Do not relax identity filtering to make dashboard samples appear.

Inbox /dashboard/marketing/whatsapp/inbox derives latest 200 envelopes. Logical
message IDs deduplicate per business phone; success statuses do not regress when
reordered. It is a bounded read projection, not a complete persistent conversation
worker. Sender stores template reference and joins statuses by phone/provider ID;
status-only outbound receipts cannot supply original message text.

Outbox saves immutable request fingerprint, actor and template before provider call;
atomic claim allows one attempt. Unknown outcome is not automatically retried.
UI retry preserves operation key while mounted; reloading creates a new operation,
so do not reload-and-resend an unconfirmed message. Campaign sending, AI replies,
media sends and general arbitrary-template sends are not activated.

## Code branches and validation

Development: codex/benefit-campaign-control (7fedd9e at controlled-send stage).
Release: codex/meta-outbound-release (ea207d8), selectively based on live branch.
Need A Cab Plus: codex/crm-campaign-service (752eda2 at ledger stage).
Development suite: 51 tests + build/lint passed at send-flow stage.
Selective production release: 30 relevant tests + build passed.
Real isolated PostgreSQL tests cover concurrent outbox insertion/single winner,
shared benefit reservation/usage limits, retries and budget controls. These do not
establish complete production campaign behavior.

## Marketing pending work

Campaign/benefit control is incomplete. Need A Cab Plus has an existing
marketing_campaigns table and commercial/loyalty policy code; reuse it. Isolated
benefit-ledger work is not deployed. Benefits attach to verified customer accounts;
customers must not enter codes in webapp. Internal Autocab codes are separate.
Autocab creation/mutation/refund discount APIs remain unverified; no invented
endpoint or note-based application is permitted. One usage ledger across channels.

UTM and control-adjusted measurement helpers exist locally/on development branch;
no complete production attribution collector or campaign execution/reporting exists.
Pareto is segmentation, not automatic discount entitlement. Completed-only Price
minus Cost is contribution before expenses; preserve negatives, avoid double-counting
discounts. AI recommends, operator approves.

Next: resolve real-number Pending/access with Meta; then revalidate assets, scopes,
billing and registration before switching test configuration. Further campaign and
schema releases require review/approval; do not deploy or send automatically.
