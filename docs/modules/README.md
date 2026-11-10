# TaxiCRM module boundaries — existing product first

Current follow-up: [installation activation controls](ACTIVATION.md) and [Predictions control](PREDICTIONS_ACTIVATION.md) add guarded controls for AI, Reports, Automation simulations and Predictions. The foundation description below records the preceding extraction; the other modules still require isolation before switching.

## Agreed product model

TaxiCRM remains one product with functional modules. A later company clone/installation can enable only the required modules. This is not a Docker/service rewrite, a new multi-tenant database design, or a replacement of existing features. User permissions and personal workspace preferences remain separate from installation-wide module activation.

This first change maps the existing implementation and extracts the data providers already used by My workspace. It does **not** yet expose functional enable/disable controls. There is no fake switch that merely hides a menu. Existing source ownership, jobs, roles, routes, schemas, data, messaging gates and production settings remain unchanged.

## What is actually separated in code

- `src/modules/core/registry.ts`: named responsibilities and workspace-card ownership.
- `src/modules/core/ownership.ts`: explicit route owners and shared-coordinator consumers.
- `src/modules/core/worker-ownership.ts`: existing worker entrypoints and their existing controls.
- `src/modules/core/contracts/workspace.ts`: the small module-to-workspace contract.
- `src/modules/operations/booking-workspace.ts`: existing booking/action/event counts.
- `src/modules/financial/workspace-provider.ts`: existing completed Price/Cost calculations.
- `src/modules/customers/*-workspace.ts`: existing returning/new contact-profile counts.
- `src/modules/predictions/workspace-provider.ts`: existing pending reference-model signals.
- `src/modules/integrations/event-workspace.ts`: existing shared-journal failure count.
- `src/modules/my-workspace/*`: provider composition and result aggregation, without domain SQL.
- `src/modules/shared/workspace-query.ts`: the unchanged bounded read-only transaction helper, not financial/booking business logic.

The old `src/lib/workspace/home/summary.ts` is a compatibility export. Existing API/page/component imports and response shapes remain valid. Queries, count definitions, partial/null/negative/zero amounts, permissions and failure isolation are preserved. A provider creates no task for unrequested cards. Action-only retention/campaign cards remain links, with no invented metrics.

The registry verifies that each metric has one provider and the expected owner. This descriptive ownership map is not runtime enforcement and does not establish that all legacy code is already isolated. Most existing UI/services stay at their original paths until their boundaries are migrated; do not interpret a directory/descriptor as a completed independent module.

## Inventory and ownership

Run `node_modules/.bin/tsx scripts/modules/inventory.ts` from the project root. `inventory.json` records 174 current app pages/routes (109 APIs, 65 pages) after the activation settings page/API, plus shared coordinators and 11 existing worker entrypoints, against baseline f259b3a1a6c986f6b82fe22c795e7d44d7a97970. An unmapped route fails rather than silently becoming Core. Longest explicit prefix wins; existing URLs can remain compatibility adapters after migration.

| Responsibility | Existing implementation to reuse | Boundary to finish |
| --- | --- | --- |
| Core | Auth, administration users/roles/audit, health | Installation module state and lifecycle coordination; no new permission assignments here. |
| My workspace | Current home, preference/summary APIs, existing card renderer | Extracted provider aggregation; later intersect active modules with permissions and saved cards. |
| NeedACab Plus integration | Current shared database connection and internal fleet adapter | Active-source read interface; preserve NAC as canonical writer. |
| Autocab direct | Existing connection/API-endpoint settings, webhook definitions, registry/direct ingestion adapters | Keep all direct-source configuration inside this boundary; reuse old routes through adapters. |
| Integration registry/journal | Existing connection registry and shared WebhookEvent monitor | Source selection/common diagnostics; journal visibility is not a second ingestion stream. |
| Customers | Directory, identity, history, profile facade, business accounts | Profile currently composes other domains; optional sections need capability-specific guards. |
| Operations | Existing bookings, drivers, fleet, zones and live views | Read selected source's normalized records, without owning another booking ingestion copy. |
| Retention | Existing completed-trip progress, behavior tags and saved time rules | Separate calculations/persistence from optional prediction fields. |
| Predictions | Existing customer reference ranking, demand forecast/evaluation and jobs | Guard issuing, evaluation and display independently of general customer history. |
| Marketing | Existing campaigns, segments, vouchers, marketing history | Consume customer/transport contracts; do not own operational WhatsApp transport. |
| Communications | Existing WhatsApp gateway/receipts/shared templates and SMS/freephone infrastructure | Shared by marketing and NeedACab Plus operational notifications; keep separate from campaign entitlement. |
| Financial | Existing revenue helpers, Price/Cost rules, account revenue configuration, driver rent | Workspace provider extracted; other legacy consumers remain mapped for reconciliation. |
| Analytics | Existing analytics explorer and query services | Expose bounded reusable analytical reads; preserve definitions. |
| Reports | Existing contribution, Hackney and refusal reports | Some queries currently shared with Analytics; don't pretend this coupling is removed. |
| Business overview | Existing executive dashboards and business summaries | Consume published domain results; preserve current deep-report routes. |
| Insights | Existing recorded signal views/API | Gate each underlying capability rather than borrowing unauthorized metrics. |
| AI | Existing TaxiCRM Agent/Copilot and governed tools | Tool availability must follow active modules and role rights. PR25 owner-agent activation remains separate. |
| Places | Existing Geoapify, enrichment and review | Gate enrichment effects/jobs without breaking customer records. |
| Automation | Existing rule/simulation engine | Delegate actions to enabled domain capabilities, not duplicate their business logic. |
| Context | Existing city/calendar/bank-holiday configuration | Optional context source, not an operational booking writer. |

These are ownership responsibilities discovered in the existing product, not twenty newly finished modules or a fixed commercial package list. Financial, Analytics, Reports and Business overview remain distinct even where they currently share implementation; the migration must reuse that implementation and identify real dependencies.

## Data and source contract

Current configured mode is Autocab → NeedACab Plus → shared canonical Booking/WebhookEvent → TaxiCRM CRM effects/read models → domain providers → My workspace. Direct TaxiCRM Autocab intake, processing and REST ingestion were verified paused/disabled in the preceding read-only audit; they are not enabled by this refactor. A standalone installation may later select the existing Autocab direct adapter explicitly instead.

Preserve one canonical writer per source. Keeping normalized records in the current shared database does not mix module responsibilities or require a second copy of bookings. Source adapters own their credentials/configuration/ingestion; consuming domains own their calculations. Future source interfaces expose bounded booking/driver/zone/account reads without exposing credentials or webhook controls. This phase does not claim that such a port has already replaced every legacy direct query.

Disabling the TaxiCRM NeedACab Plus integration must not disable the external NeedACab Plus application. Switching source must not silently activate Autocab or replay/import historical events. Historical records remain available according to the approved read policy, with freshness shown. No source mode, database routing, callback or runtime flag is changed here.

## Known shared boundaries to resolve before enabling switches

1. Customer profile API currently computes retention, predictions, places and operational observations together. Keep Customers available when optional capabilities are off; guard optional work before calculation, not only before rendering a tab.
2. CRM post-commit, customer-intelligence and snapshot coordinators serve multiple consumers. A single coarse switch would stop unrelated work. Split dispatch/guards per effect and stop new claims before draining in-flight work.
3. Disabling Marketing must not stop the shared WhatsApp transport, receipt status processing or NAC booking notifications.
4. AI/Insights need a capability catalog: an enabled AI module cannot access a disabled Financial/Predictions module just because its user has a permission.
5. Legacy configuration paths are scattered. Move implementation behind module entrypoints while preserving URLs/API consumers; regroup UI after the adapter boundary is covered, not by breaking existing endpoints.

## Next implementation slice

Build one installation-scoped module-state authority (separate from UserWorkspacePreference), versioned audited admin changes, dependency planning and source exclusivity. Keep current effective behavior as the initial installation profile. Wire server routes, jobs/effects, provider/card discovery and navigation together before offering enable/disable controls. Module disabled + user authorized still means no module access; module enabled never grants additional user permissions.

Apply lifecycle transitions atomically with a review of affected capabilities. Preserve data. A disable must stop new work and account for existing leases/retries, including shared jobs, without shutting down unrelated consumers. Reactivation must not silently send queued marketing or replay old operational actions. Schema/production changes, if needed for that next step, require their own concrete reviewed implementation; none are bundled here.

## Verification of this slice

- Registry checks cover every current page/API, card owner and existing scheduled worker entrypoint.
- Provider contract test proves metric coverage/uniqueness and no task creation for unrequested domains.
- Existing PostgreSQL workspace tests cover missing/partial/signed finances, both returning-contact timing cases, permissions, preference isolation and concurrent saves.
- Golden comparison executes the deployed c4fea3f summary/config and the extracted implementation on the same isolated PostgreSQL fixtures for all four periods, all cards and a restricted role. Positive profile, forecast-signal and failed-event cases are included. Source Booking rows must match before/after.
- Production build, TypeScript, lint and authenticated synthetic browser checks passed; see [verification](VERIFICATION.md). No authenticated production behavior is claimed from local tests.

No new dependency, database schema, business-rule change, message send, production deployment or runtime activation is part of this foundation PR.
