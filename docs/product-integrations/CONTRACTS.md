# Product integrations: initial contracts

These are version-one design and TypeScript contracts, not active integrations or a wire protocol. They do not change current processing, permissions, database ownership or delivery. Runtime validation, authenticated transport and version negotiation are prerequisites to using external input. Existing production remains on its current NeedACab Plus shared-source arrangement.

## Operational sources

- Autocab direct: the Autocab adapter owns its API and webhooks and retains the raw records it needs. NeedACab Plus: the NAC adapter consumes its agreed contract; NAC owns the raw Autocab integration. Current shared-database NAC configuration is an existing arrangement, not proof of a separate-database adapter.
- Both publish a normalized record with source kind, connection ID, external ID and observation time. An event has an ID scoped to the connection and distinct occurrence/receipt times. Retries must be idempotent; later corrections must not erase evidence. Identity mapping and duplicate resolution are domain services, not an assumption that external IDs are globally unique.
- Initial types cover booking, driver, vehicle, shift and tracking. Null means unknown, not zero. Financial minor units require currency, a documented conversion rule and a defined status/occurrence timestamp; do not calculate money until those are validated. Tracking points must be quality checked and classified before producing mileage; no claims of complete coverage or exact road distance.
- Capability declarations describe what an adapter can supply, not whether a particular connection is healthy or a record is complete. Configure one authoritative writer per entity and source scope, with explicit cutover, a historical-data policy and no automatic replay.

## Communications and marketing

- Integrations own provider connections, credential management and health. Marketing owns audiences, content, approvals, campaigns, permissions and campaign history. Shared transport and receipts must continue to serve operational notifications even if Marketing is disabled.
- WhatsApp: existing Meta connection and WhatsApp templates. Meta template approval and a valid recipient permission are separate from module activation. Inbox/replies are handled by NeedACab Plus in the agreed deployment; historical marketing activity can remain visible in TaxiCRM.
- SMS: provider-neutral adapter and recipient permissions; existing SMS functionality must be assessed before choosing an adapter. Delivery and opt-out handling need implementation and provider verification.
- Email: add provider-neutral sending and event receipts, then a SendGrid adapter with verified sender/domain, test connection, verified provider webhooks, bounces, complaints, suppression and unsubscribe synchronization. Configuration/credentials must not appear in browser payloads or logs. No SendGrid integration is implemented by these types.
- Email templates: Marketing owns creation, editing, preview, test and version history. Rendering and variable substitution need escaping, allowed-variable validation and a plain-text alternative. Template editing requires authorization; sending requires separate permissions, eligible recipients and provider policy. Do not expose unimplemented buttons as functional.
- All channels: independent marketing permission per channel and purpose, source and evidence; a permission value alone is not a complete authorization to send. Enforce suppression/opt-out, audience rules, rate limits and idempotency before actual delivery. Distinguish provider acceptance, delivery, read (where supported), failure and unknown. Uncertain outcomes must not trigger blind retries. Handle time zones, unsubscribe, bounced addresses, provider outage and disabled modules explicitly.

## Integration directory

Autocab, NeedACab Plus and existing local data remain available as before. WhatsApp's existing connection can be opened from Integrations when the user has the permissions required by that page. Status describes the existence of settings, not actual provider health. Email/SendGrid and other SMS provider setup remain future work; no fake connection is listed.

## Next implementation gates

1. Make normalized source contract executable with schema validation, bounded inputs, version compatibility and synthetic adapter contract tests.
2. Build and verify Autocab direct in isolation, without touching the current live writer.
3. Agree and implement an authenticated, versioned NeedACab Plus data interface and initial synchronization.
4. Add communication connection records and provider-specific adapters with channel-specific permission, template and receipt controls. Start SendGrid with a synthetic/fake transport and verify provider requirements before a real send.
5. Connect domain modules to the normalized data ports and test disabled module / permission / partial-data behavior.
