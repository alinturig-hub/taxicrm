# Enterprise integrations workspace

The isolated UI release builds on codex/taxicrm commit e2ac65aa95913dfd961673bffd496828ddc9b715. No production schema, connection, credential, worker, webhook receiver or API transport is changed.

## Structure

- Integration hub: searchable/filterable source directory for NeedACabPlus, Autocab and Local; deployment policy strip; explanatory data flow; permission-gated Add connection entry to the existing draft wizard.
- Autocab: persistent Overview / Connection / API & Sync / Activity tabs. REST credentials move to /connection. The existing API manager is presented at /api; the existing received-events log is available at /activity. The activity log retains its existing provider filter and shared-log semantics.
- Webhook administration was subsequently retired from TaxiCRM at the user’s request. Former configuration/list/add/edit URLs redirect to the NeedACabPlus integration page, which links to its own webhook administration. Configuration exposes Integration events for read-only monitoring. Shared configuration records and history are preserved.
- NeedACabPlus has an ownership/planning workspace; it does not pretend that a standalone connection adapter or production diagnostic has been implemented.
- Local and setup pages share workspace headings and return navigation. No new connection is activated by navigation or draft creation.

## Visual system

Semantic light/dark colours: neutral surfaces, charcoal typography and petrol accents. Fine borders, compact badges, clear section headings, responsive source cards and visible keyboard focus. Component styles are scoped under integration classes; map markers, business charts and other modules are not recoloured. No external fonts, images or providers are fetched.

Configured writer and paused-intake labels are read from deployment policy; they are explicitly not connection-health claims. The screenshots use only the isolated environment and synthetic fixtures, so its displayed writer can differ from live production.

## Access and validation

Existing configuration API permissions remain authoritative. The Autocab layout permits integrations.view or configuration.view to preserve existing configuration-only users' editor access. Configuration tabs/actions respect configuration.view/manage. Ordinary operators remain denied access to draft registry APIs. Global configuration routes and public receiver URLs are preserved.

Validation: production build with lint/type checks passed; three existing navigation tests passed; synthetic browser smoke passed with search, empty results, category filters, Autocab tabs, provider workspace, draft persistence, permission restrictions, light/dark desktop captures and mobile overflow checks. Final incremental TypeScript validation covers the last permission-link and singular-label adjustments. Browser networking blocks external HTTP and no real SMS is sent.

Captures are in /workspace/taxicrm-local/integrations-enterprise-{light,dark,mobile,webhooks}.png. No push, deployment or production migration was performed. Deployment of the earlier registry schema remains a separate coordinated step.

## Approved UI deployment

The user approved publication of the UI. Draft registry persistence is a separate explicit opt-in (`CONNECTION_REGISTRY_ENABLED=true`), absent in production at release preparation. With it off, the wizard provides download-only plans, makes no registry-list request, and hides the database-save button; authenticated GET returns an empty disabled capability and POST rejects writes with 409 before accessing the new tables. This permits the UI release without applying the isolated registry migration to the shared database. Schema management and the NeedACabPlus writer/TaxiCRM effects-worker configuration are preserved. Later enabling persistence requires a separately reviewed production migration.

## Retired TaxiCRM webhook administration

Autocab webhook list, add and edit pages and Configuration > Webhooks administration redirect to /dashboard/integrations/needacabplus. The Webhooks workspace tab and management card are removed. The event monitor keeps GET-only history access and links to NeedACabPlus instead of configuration. Existing administration API mutations reject requests when BOOKING_WEBHOOK_WRITER=NAC, including from stale browser tabs, through the common webhookAccess gate. Receiver URLs, NeedACabPlus processing, database schema and all shared webhook/provider records remain unchanged. No SQL DELETE, bulk disable or migration is performed.
