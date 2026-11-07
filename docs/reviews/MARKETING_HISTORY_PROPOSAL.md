# Marketing history and conversation ownership

NeedACab Plus is the operator/agent conversation workspace. TaxiCRM owns marketing campaign planning and reporting. This change removes the inbox entry and tab from CRM navigation, retains the existing route and shared data, and links to the NeedACab Plus inbox. That inbox is currently read-only: replies, agent and operator takeover are not yet available there.

Marketing campaign planning currently produces an unsaved local preview. A campaign-specific history view and verified reply-to-campaign association are not implemented. Existing shared messages can include operational content; showing the entire conversation in a customer marketing panel would misclassify booking messages.

## Proposed next implementation — not yet approved

1. Inventory existing records and identify an authoritative marketing purpose, verified customer association and campaign/message identifier. Unknown provenance remains unknown. No phone-number-only merge without a verified relationship.
2. Add a scoped, permission-checked read API for verified marketing message history in campaign and customer views, ordered by time, with explicit unavailable/empty states. Establish retention, source and consent semantics from actual data. API and any schema/business changes require explicit owner authorization before implementation.
3. Associate a reply with a marketing message only when there is reliable provider or application correlation. Otherwise show it in the NeedACab Plus conversation without claiming campaign attribution. Avoid assuming that the most recent marketing campaign caused a reply.
4. Build NeedACab Plus agent/operator response capability before removing the legacy CRM route or decommissioning any of its controls. Preserve history, webhook and unique sender. No messages or schema changes are part of this navigation-only change.

Validation: navigation tests verify the inbox is no longer offered and campaigns remain available. An isolated real-component browser check verifies the NeedACab Plus link, the explicit unavailable-history notice and existing preview controls with no HTTP mutation. No live session, production data or provider message was used.
