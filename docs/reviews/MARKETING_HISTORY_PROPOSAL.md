# Marketing history and conversation ownership

NeedACab Plus is the operator/agent conversation workspace. TaxiCRM owns marketing campaign planning and reporting. This branch removes the inbox entry and tab from CRM navigation, retains the existing route and shared data, and links to the NeedACab Plus inbox. That inbox is currently read-only: replies, agent and operator takeover are not yet available there.

The campaign page now has a separately loaded, read-only **marketing message history**. A new authenticated API reads only `WhatsAppOutboundMessage` rows whose configured connection scope matches and whose purpose is explicitly `MARKETING`. It joins delivery status and rendered text only to an outbound message with the same scope and provider message ID. Results use a bounded, microsecond-accurate keyset cursor; status labels distinguish queued, accepted, delivered, read and other outcomes. The UI does not label queued records as sent.

## Explicit limits

Campaign planning is currently an unsaved local preview. There is no trusted campaign ID or verified customer association for every historical record. Accordingly, the history does not claim a campaign or attach a record to a customer profile, and it does not guess which inbound reply belongs to a campaign. It covers only explicitly marked records in the configured shared Meta scope; other-provider or legacy records may be missing. A customer-specific history requires a verified identity and campaign attribution contract, and may require changes to schema or business logic; those are not included or approved here. NeedACab Plus inbox remains read-only until a separately authorized response and handoff implementation exists.

## Security and rollout

The endpoint uses the existing WhatsApp access checks (`configuration.view` and `integrations.view`), scoped database configuration and private/no-store responses. No permission policy, database schema, webhook, notification rule or sender is changed. This feature only reads existing records. Do not enable sending or remove the preserved legacy route when rolling out the navigation change.

Validation: PGlite tests verify marketing-only and scope isolation, status association, microsecond cursor boundaries and malformed cursor rejection. Navigation tests verify the inbox is no longer offered while campaigns remain available. An isolated browser check exercises the actual marketing component with synthetic intercepted GET responses, history pagination, the NeedACab Plus link and campaign preview controls. No real provider calls, production data, live session or messages were used. Live DB role and authorized-session checks remain deployment verification.
