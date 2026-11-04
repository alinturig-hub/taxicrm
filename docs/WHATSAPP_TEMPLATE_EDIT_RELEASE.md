# Existing Meta template editing

Official sources read:
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api

Meta permits editing APPROVED, REJECTED and PAUSED templates. Editing components replaces the entire components array. Approved templates are limited to one edit in 24 hours / ten in 30 days; Meta enforces its rolling limits. Its guide states that approved/paused edits are automatically re-approved unless review fails; the UI does not assume approval and requests a status refresh.

Implemented Edit template on cards and full supported-component hydration. Unsupported component shapes disable the local action with a WhatsApp Manager link rather than silently dropping them. Missing review samples are entered by the operator. Media handles are retained when returned; otherwise a new sample is required.

The editor locks name, language, category and parameter format for existing templates. Server verification fetches the configured account's template list filtered by name and requires exact ID/language/category/format and an editable status before POST /TEMPLATE_ID. The update payload includes only components. All routes retain integration-management and same-origin checks. Template submission must be enabled. Ambiguous mutation results are never automatically retried.

A visible warning explains that editing an existing template affects shared NeedACab Plus notifications; changing variables does not automatically change sender mappings. An explicit edit-specific confirmation is required. No database migration.

Verification: 21 targeted synthetic tests passed, including full draft hydration, refusing unsupported components, foreign IDs/status/immutable changes, full-component replacement and ambiguous responses. Lint, TypeScript and production build passed. Chromium using a temporary local fixture with intercepted APIs verified card action, hydration, immutable identity, confirmation gate and correct edit request. No actual Meta update, upload or message was performed.
