# Central campaign and benefit control: initial findings

Owner specification: pasted request received 2026-11-01. Supersedes the earlier
customer-facing voucher-code approach. Customer webapp receives an assigned
benefit automatically; any Autocab codes are internal.

## Verified repository evidence

- TaxiCRM src/lib/autocab/booking-mappers.ts preserves PromotionCodeDiscount and loyalty fields.
- Existing src/lib/marketing/eligibility.ts and WhatsApp adapters enforce draft/setup boundaries; no live sender exists.
- Need A Cab Plus reference lib/quote-policy.ts defines promotion, membership and loyalty policies, including manual approval and stacking settings.
- Need A Cab Plus reference lib/quotes.ts and lib/smart-fare.ts use service capabilities to request discounted quotes. This is not proof of support for arbitrary promotion creation or updating existing operator-entered bookings.
- The available reference checkout has no verified partner benefit-grant API. Its version is not proof of current deployed capabilities.

No current vendor contract for promotion creation, booking discount mutation,
refunds or reversals was found in the supplied documentation (which covers
WhatsApp). Autocab telephone application must stay assisted/unconfirmed until
an actual API response or operator confirmation provides evidence. Notes are not
an application mechanism. No booking ingestion changes are proposed.

## Stage 1 implemented

Pure activation-event reducer plus messaging gate reuse the existing marketing
boundary. Tenant/customer/campaign/benefit identity, authenticated-event boundary,
ordered versions, duplicate events and reconciliation gaps are checked. Pending,
refused, revoked and expired benefits cannot pass the marketing gate. Explicit
verified identity and manual approval are required. The authenticated flag must
only be set by a future verified-signature receiver, never accepted from user JSON.
This reducer is not a durable ledger or database concurrency guarantee.

## Next stages and approvals

Prepare a reviewed persistent schema for campaign drafts/approvals, benefit grants,
shared cross-channel reservations, audit/outbox/inbox and operation idempotency.
Need A Cab Plus remains commercial validator/ledger owner; reuse existing policies.
Percentage, fixed discount and fixed final price must remain distinct until the
owner resolves the latest specification's wording (fixed amount versus final fare).
Define budgets, minimum fare, caps, stacking, cancellation, modification and refund
rules before execution. Use integer GBP pence and explicit UTC validity instants
with Europe/London business display. Do not label gross margin as net profit.

Only after schema approval: isolated durable integration tests for simultaneous
cross-channel redemption, retries, expiration, booking modification/cancellation,
activation and send failure, lost events and unverified/shared-phone identity.
Then provider transport and authenticated event receiver; no raw tokens in chat.
This stage does not deliver those later tests or claim an operational integration.
No live deployment, real message, production migration or automated AI grant is authorized.
