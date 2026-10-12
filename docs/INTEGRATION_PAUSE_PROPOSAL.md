# Proposed global integration pause

Status: the user selected bulk-disable existing configurations instead of this global-pause schema proposal. The global pause below is not implemented.

## Behavior

Configuration should expose Pause integrations / Resume integrations with explicit confirmation. Pause preserves each provider, webhook, API, SMS and job configuration so resume does not indiscriminately enable previously disabled entries. Dashboard, authentication, configuration and health/internal control endpoints remain available.

The proposed persisted singleton `IntegrationControl` has `id` (global), `isPaused` (default false), `revision` (default 0), `updatedAt` and `updatedBy` (optional actor ID). A migration creates the table and default unpaused row. Updates require configuration.manage and use the revision to reject stale state changes. An audit record captures actor/action and state without credentials.

## Enforcement points identified

- Autocab webhook receiver: return retryable 503 before reading/storing new payloads when paused.
- Webhook worker and processWebhookEvent: defer queued events without changing them to IGNORED or exhausting retries.
- Autocab REST client, zone sync and generic API preview/sync: guard before outbound requests, including manual test actions.
- Geoapify configuration test, place enrichment/category enrichment, weather, bank holidays and routing: guard before each external request.
- SMS worker: defer queued notifications while paused without claiming an attempt or changing acceptance/delivery state.
- Internal scheduler control requests stay available; the operations they invoke enforce pause.

Checks run before new work is started. An already submitted external request cannot be undone. Existing received payloads, caches, individual enabled flags and API credentials remain unchanged.

OpenClaw and the Need A Cab integration/import remain outside the authorized modification scope. Expanding the pause to those paths requires explicit approval naming those integrations. The control must label its supported scope accurately.

## Validation plan

Use synthetic fixtures and a mocked transport that fails if any external request occurs while paused. Verify the receiver's 503, preserved queued events/deliveries, manual and scheduled paths, resume preserving per-integration disabled settings, rejected stale updates and forbidden control writes. Test migration and startup only against the isolated loopback database. A production migration and deploy require a separate approval after the implementation is reviewable.

Alternative without a schema extension: bulk-disable existing isEnabled flags. This changes individual configuration states and does not provide a reliable global resume or cover APIs without an enabled flag; it is not equivalent to the proposed persistent pause.

## Selected implementation: disable existing configurations

Configuration exposes a confirmed Disable all webhooks & configured APIs action. The configuration.manage permission is required. A single transaction disables WebhookProvider, AutocabWebhookConfiguration, ApiEndpointConfiguration, AutocabApiConfiguration (including driverSyncEnabled), GeoapifyApiConfiguration and SmsGatewayConfiguration; an AdministrationAuditEvent records counts and actor in the same transaction. No schema changes are required. Existing records, credentials, processing conditions and notification jobs remain preserved. Re-enable connections individually.

This is a settings operation, not an emergency transport-level pause. It does not cancel in-flight work, disable future configurations or prevent manual test requests. APIs without a stored enabled setting (such as weather, routing and bank-holiday lookups), internal dashboard APIs, OpenClaw and the Need A Cab import are not modified. No production bulk-disable action is run during verification.

Validation: synthetic database coverage checks all six categories, preserved keys and API records, audit counts and transaction rollback on audit failure. Browser coverage checks cancellation sends no request, confirmation sends the required payload, success feedback, access denial and mobile layout. Browser bulk-action success is mocked; database behavior is covered by the integration test.
