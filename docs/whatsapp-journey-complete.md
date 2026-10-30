# Journey-complete WhatsApp messages

This integration uses Meta WhatsApp Cloud API. It is disabled until an administrator saves credentials, an approved template and enables it under **Integrations → WhatsApp**. It sends no marketing or reward messages.

## Setup

1. Apply `prisma/migrations/20261030090000_whatsapp_journey_complete/migration.sql` through the database owner's migration process. The production shared database is managed externally: do not run a blanket `prisma migrate deploy` against it. This migration only creates three CRM-owned tables.
2. Generate the Prisma client during the normal build. Configure the existing `INTEGRATION_ENCRYPTION_KEY` securely in the hosting environment. Do not store keys or tokens in Git.
3. In Meta, connect the business sender and approve a template with exactly two body text parameters: first name and booking reference. Example: `Hi {{1}}, your journey with Need A Cab Plus is complete. Booking reference: {{2}}. Thank you for travelling with us.` Save the exact approved name and locale, phone number **ID** (not its telephone number), supported Graph API version and access token in the CRM. The token is encrypted at rest and is never returned to the browser.
4. Record the customer's WhatsApp opt-in and its evidence using their telephone number. Booking telephone numbers alone do not establish consent. Revocation is available in the same page. This first version does not collect consent from the booking app or ingest incoming STOP messages automatically; maintain consent there before activation for customers.
5. Enable only when ready. Complete a newly created test journey for an opted-in test recipient. Check the delivery log and the receiving phone. No real messages are sent by the automated test suite.

## Trigger and delivery semantics

TaxiCRM handles both its own completion webhook and Need A Cab Plus's authenticated `/api/internal/booking-post-commit` callback. The event must be processed, type `BookingComplete`, and linked to a booking whose current status is `COMPLETED`. Both receipt and completion must be within 15 minutes and after activation. Historical imports and replays before activation are ignored. The canonical booking is read only.

A unique claim on booking ID is committed before the HTTP request, preventing concurrent or duplicate webhook sends. No attempt is automatically retried, including timeouts: the provider might have accepted it. `ACCEPTED` means API acceptance, not delivery; `REJECTED` is an HTTP 4xx, `UNKNOWN` is a network/5xx/invalid response. A process interruption can leave `SENDING`; investigate the provider before any manual action. Delivery receipts, automatic retry and incoming WhatsApp messages are outside this change.

Messaging errors do not roll back bookings. Administrators with `integrations.manage` can configure the sender, manage consent and inspect the last 30 attempts. Request logs do not include tokens or message bodies. Disabling does not delete audit records.

## Verification

`npx tsx --test src/lib/integrations/whatsapp.test.ts`

Tests cover activation boundaries, stale events, cancelled journeys, invalid numbers, parameter mapping, opt-in gating, concurrent duplicate suppression and ambiguous-send suppression. The provider and database are mocked; no production data is changed.
