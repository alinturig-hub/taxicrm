# Installation module controls — first isolated capabilities

Current extension: [Predictions control](PREDICTIONS_ACTIVATION.md) adds the fourth guarded capability and version-2 compatibility. The three-capability implementation below describes PR29.

## Scope

Configuration → Product modules (`/dashboard/configuration/modules`) now offers real installation-wide controls for three existing capabilities:

- AI: current Copilot page/API, including My workspace and header entrypoints.
- Reports: contribution, Hackney performance and refusal-detail pages/APIs.
- Automation: existing rule review and manual simulations, including the Copilot automation tool.

The other existing responsibilities are displayed without enable/disable controls until their shared jobs, profile sections and dependent capabilities are isolated. Core and My workspace remain required. This is not a claim that Marketing, Predictions, Finance or source adapters can already be independently switched.

The shared driver-company overview belongs to Business overview and remains available when Reports is disabled. Shared financial query helpers are not a report entitlement: disabling detailed Reports does not disable Financial/Analytics or hide their existing figures.

## Persistence and authorization

The existing `AdministrationAuditEvent` table provides an append-only event-sourced state authority. No new table, schema, migration, database connection, role or grant is introduced. Before any change event exists, all three capabilities retain their existing enabled behavior.

Reserved event identity:

- action: `INSTALLATION_MODULES_UPDATED`
- targetType: `TaxiCRMInstallationModules`
- targetId: `current`
- ID: `installation-modules:` followed by the 16-digit revision
- evidence: changed capability, prior value/revision, new value and the complete strictly validated version-1 configuration

**Retain these configuration events permanently. Never treat them as disposable telemetry or include them in future audit purges.** Each cloned installation uses its own current database and journal; this adds no multi-tenant data model. Copying a database also copies its installation settings.

Only the existing `configuration.manage` permission (including the existing super-admin mechanism) authorizes inspection and changes through the settings API. Page access uses the same check. Changes require the same-origin request header, a strictly bounded and validated body, one of the three supported IDs and the expected revision. Enabling never grants user permissions. Unknown module IDs, extra fields and non-boolean states are rejected.

The application role already uses the administration journal for audited settings. If the journal is absent/unreadable/unwritable, settings report unavailable rather than pretending the save succeeded. Runtime guards fail closed with 503 for unavailable/corrupt state. No application bootstrap creates or repairs schema.

## Concurrent changes and runtime behavior

An installation advisory transaction lock serializes changes across application instances, followed by an expected-revision check. Revision-keyed immutable IDs define event order; transaction start timestamps do not. A concurrent stale change gets 409 and the UI requires a reload. A failed audit insertion rolls back the configuration change. An unchanged desired state creates no new event.

All owned public pages and APIs check current server state before their domain work. API checks follow existing authentication/authorization. Navigation, search, home shortcuts and AI entrypoints use the server-provided policy. Server rendering uses only React request-local caching; there is no multi-second policy TTL or client-only authorization. Copilot cannot read Automation through its tool while Automation is disabled.

A change blocks new requests; an already-running read or simulation can finish. Previously rendered content in another open tab may remain visible until refreshed. No database records are deleted, user workspace preferences are overwritten or historical data replayed. No existing message-sending flag is changed.

None of these three capabilities owns a scheduler entrypoint. Existing operational, prediction, CRM effects and WhatsApp jobs keep their own controls and remain unaffected. In particular, the Automation control governs manual simulations, not the unrelated background domain jobs or NeedACab Plus notifications. This limitation is displayed before confirmation.

## Validation and rollout

Use synthetic PostgreSQL and authenticated local browser sessions for disable/enable, direct URL/API rejection, Copilot tool bypass, authorization/origin/body rejection, concurrent changes, application restart, failure-closed behavior, preserved booking data, unchanged workspace metrics and mobile layout.

Deploy with the existing schema and settings. Do not toggle any live capability as a deployment health check. Verify public health/assets and anonymous API denial; authenticated production switches require a genuine administrator session. The settings screen should initially show all three enabled unless an administrator has already saved configuration. Older application versions do not enforce this journal, so reverting to a version before these controls would restore its previous feature availability; rollback planning must account for that.
