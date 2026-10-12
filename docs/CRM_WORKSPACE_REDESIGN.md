# TaxiCRM workspace review and redesign

Reviewed locally on 12 October 2026, starting from `codex/taxicrm` at `7f1d4e185adbc7f374bef0a58a0a9c184ee5214b`. No live database, customer records or excluded integrations were accessed for design or testing. The existing Coolify application is used only for the authorised release and readiness checks. The current phase changes the application interface and adds entry points over existing CRM capabilities; it does not introduce schema changes.

## Existing system and findings

The repository contains an executive dashboard, live operations, booking workspace (pricing/history/customer/journey), driver profiles, fleet maps and saved zones. Customer profiles already contain booking histories, behaviour tags, predictions, places and historical snapshots. Hackney analysis matches driver badges and uses London business periods. Integrations include Autocab configuration and received webhook inspection, generic API configuration/preview/saved records and Geoapify. Administration includes permissions, users, place reviews, account revenue rules, driver rent, contextual events, intelligence health, SMS delivery and freephone notification jobs.

The old sidebar mixed customer CRM into operations and Autocab configuration into administration, while offering unavailable Performance/Revenue/Reports/Company/System items. Configuration cards linked to nonexistent integration/organisation/audit pages and labelled operational SMS as a preview. Integration overview cards asserted driver/vehicle status using static placeholders. The header's search, AI and bell controls did not perform the actions they suggested; the bell had an unsupported red status dot. Global light surface variables conflicted with the dark dashboard shell. Nested configuration links could activate their parent instead of the relevant settings page.

## Implemented information architecture

| Workspace | Existing capabilities and new entry point |
| --- | --- |
| Workspace home | Role-aware module launcher and original business overview |
| Operations | New hub, live operations, bookings, drivers, fleet, zones |
| Customer CRM | Existing accounts/customer directory and profile drawers |
| Marketing | New hub, recorded behaviour audiences, filtered customer directory, customer prediction opportunities with profile drawers |
| Intelligence & AI | Executive intelligence, Hackney performance, copilot, insights, predictions, automation |
| Integrations | Connection hub, Autocab configuration, received event inspection, saved API data sources |
| Configuration | Dedicated hub, SMS/freephone alerts, financial rules, rent, places, contextual events, webhook configuration, users, roles, health |

Existing business routes and API behaviour remain intact. Integration webhook inspection and Configuration webhook settings remain separately named routes. Module search is an actual permission-filtered destination finder, not a claim to search booking records. The launcher, navigation and hubs use one catalogue of verified routes. Navigation follows database-resolved role grants; existing SMS legacy-role restrictions are also respected. New marketing entry points enforce the corresponding server-side access checks. The customer segment directory uses the existing tag query and defaults to individual customers. Counts are fetched from the existing customer API, with explicit loading/error/empty states and an explanation that tag memberships overlap. Prediction opportunities retain the existing data/evidence and allow opening customer profiles.

The shell now exposes real header actions, a responsive drawer with Escape/focus handling, skip-to-content, active-page identification and dashboard-scoped surface variables. It removes placeholder destinations and invented service status badges. Changes do not reassign financial rules, change prices or booking payloads, recalculate tags, enrich places, schedule imports, enable SMS or send messages.

## Next capabilities requiring separate implementation

1. Campaigns and customer communication journeys: persistent Campaign, campaign audience snapshots, message approval/versioning, per-recipient delivery history and campaign outcomes. Add explicit channel consent, opt-outs and unsubscribe records before marketing sending. Use the operational gateway through a separate campaign service with bounded delivery/retry handling. Existing operational notification tables are not a campaign/consent model. A concrete database schema proposal must be approved before implementation.
2. Customer relationship management: contact activity, assignments, notes/tasks, account relationship ownership and controlled saved audiences. Existing customer predictions are opportunities, not sales deals; do not invent deal stages or rates.
3. Operational case management: driver/service issues, freephone incidents, follow-up tasks and acknowledgement/escalation. Lack of bookings remains a possible line/feed issue, not a diagnosed hardware failure.
4. Reporting: validated operational and financial definitions, saved London business periods, exports and performance comparisons. Continue to associate AccountRevenueRule by provider + accountId and preserve source payloads.
5. Administration hardening: some legacy data endpoints, including the customer directory, currently check session authentication rather than the granular permission mechanism. UI filtering alone is not authorisation. Audit every existing API and resource scope before promising comprehensive RBAC. The redesign secures its new routes and does not claim to have completed that separate security audit.
6. Existing data quality: missing booking timestamps and uncertain webhook/import coverage remain visible limitations for predictions and inactivity notifications. Reconciliation/backfill requires evidence and separate authorisation; no dates are fabricated.

## Verification scope

Use only the isolated PostgreSQL database, synthetic users/customers/tags and local Chromium. Verify module links, role-filtered navigation, actual module search, tag navigation, mobile drawer behaviour, authentication redirects and marketing data rendering. Build/lint/types must pass. Screenshots show synthetic records, not production statistics. Validation passed: 40 unit tests, 28 integration tests, production build (including lint/types), and the Chromium flow above. The browser runner requires the environment-provided Playwright package and Chromium, and the explicitly opted-in loopback database. Release uses the existing codex/taxicrm branch and Coolify application, without schema migrations or data backfills.
