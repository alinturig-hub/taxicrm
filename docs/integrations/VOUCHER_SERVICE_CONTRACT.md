# Voucher service integration — proposed contract

Status: design only, not deployed. No routes below are claimed to exist upstream.
Repository inspection on 2026-10-30 found no voucher API implementation in the
available Need A Cab Plus reference checkout. Obtain the current service source
before implementing its routes or database changes.

## Ownership

Need A Cab Plus owns code generation, eligibility, customer assignments and the
redemption ledger. TaxiCRM owns marketing audiences and distribution. Autocab is
an execution adapter; do not infer discount support from a generic booking API.
No direct shared-table writes from TaxiCRM for voucher operations.

## Proposed versioned server-to-server API

All routes require service authentication with tenant-scoped credentials. Tenant
identity comes from verified credentials, never an unrestricted body parameter.
Secrets remain server-side. Separate read and write scopes; audit the requesting
service and user. Customer identity uses an explicit NAC+ customer ID mapping,
not a name match or an unverified phone match.

- GET /api/partners/v1/vouchers: cursor-paginated catalogue, rules, status and UTC validity instants.
- POST /api/partners/v1/voucher-assignments: assign an existing voucher to a mapped customer.
- POST /api/partners/v1/voucher-reservations: atomically check eligibility and reserve one use for a booking.
- POST /api/partners/v1/voucher-reservations/{id}/commit: confirm use after successful application.
- POST /api/partners/v1/voucher-reservations/{id}/release: release on confirmed application failure.
- GET /api/partners/v1/voucher-operations/{idempotencyKey}: reconcile ambiguous timeouts.

Write requests carry Idempotency-Key, correlation ID, canonical customer ID,
voucher ID and where relevant provider + provider booking reference. The same
key and identical body returns the same result; different body yields a conflict.
Uniqueness and limits must be enforced transactionally by NAC+, not in a CRM cache.
Money uses integer GBP pence in this new contract, explicitly mapped from upstream
units. Percentage and FIXED_FINAL_PRICE are distinct; do not map fixed final fare
to flat discount. Preserve original Price, Cost, discount and funding evidence.
Single use means one redemption per customer; multiple use has an explicit
per-customer maximum. Reservation expiry must not silently release an operation
whose upstream outcome is unknown: reconcile first. Cancellation/reversal policy
and discount funding remain business decisions before execution is enabled.

## Events and recovery

NAC+ emits signed events with stable event ID, schema version, tenant, aggregate
version and UTC occurredAt: voucher.updated, voucher.assigned, voucher.redeemed,
voucher.released and voucher.expired. Verify signatures on raw body, bound replay
age, deduplicate by tenant/event ID and prevent older versions overwriting newer
state. Persist outbox events transactionally upstream, acknowledge only after
local durable receipt. Reconcile through cursor catalogue/operation reads after
missed events. Define signing algorithm/key rotation together with upstream.

## Rollout

1. Confirm actual upstream implementation and partner API ownership.
2. Implement catalogue + customer-ID mapping in isolation with synthetic fixtures.
3. Implement assignment and atomic reservation/commit/release with concurrency,
retry, duplicate event and timeout tests. Obtain approval for any schema changes.
4. Confirm exact Autocab JSON contract and whether final-price/discount application
is supported. Exercise only a sandbox booking.
5. Review before enabling live writes, real distribution or financial effects.

## Isolated campaign planner

`src/lib/marketing/voucher-campaign.ts` builds a preview-only body-template payload
for either transport from a confirmed assignment fixture. Its body-only contract
requires an approved template with exactly two text parameters in order: customer
name, voucher code. Verify that actual template definition before dispatch; this
is not a general-purpose arbitrary template mapper. It checks tenant identity,
explicit customer mapping, assignment state, validity, consent and suppression.
No API call, assignment or redemption happens. Runtime dispatch remains absent.
Tests cover both transports, retry identity, cross-tenant rejection, mismatched
customer mapping, revocation, opt-out, approval, expiry and invalid input.
