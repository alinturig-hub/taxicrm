# Autocab and Local modules

Integrations hub and sidebar expose Autocab integration and Local integration. Autocab contains its existing connection form and links to webhook management, provider configuration and Autocab API records; API configuration is also discoverable under Configuration. The existing webhook receiver/configuration routes remain separate and financial rules and original Autocab payloads remain untouched.

Local supports pasted JSON and JSON files (512 KB maximum, 500 records maximum per import), preview before save and paginated saved-data inspection. A nonblank record key splits arrays into records and requires valid, unique keys; blank stores the complete response. Preview tokens are bound to actor, name, key and payload and expire after 15 minutes. Reusing the same valid preview is idempotent. Save uses a transaction and actor audit, retaining original JSON values. Imports save generic datasets; they do not automatically map into bookings, customers or financial entities.

No schema extension: local datasets use ApiEndpointConfiguration(provider=LOCAL, method=LOCAL_JSON, disabled) and ApiEndpointRecord. Autocab's catalogue filters provider=AUTOCAB and generic sync rejects non-Autocab sources before credentials or network access. All local data reads require integrations.view; imports require integrations.manage.

The user wants both direct imports and a connection to a local system. That connection remains pending its system name, protocol and endpoint; none is invented or contacted. HTTP/JSON, database connections and CSV/Excel need their actual source format to implement the corresponding adapter. Need A Cab import and OpenClaw are unchanged.

Synthetic validation covers original JSON (including absent fare and explicit zero), actor/payload/key-bound preview checks, duplicate keys, size/record caps, idempotent save, provider separation and navigation ownership. Chromium exercises file preview, persistence, inspection, permissions and mobile layout. No real dataset import, endpoint call or backfill is used for verification.

Legacy Autocab API detail/record routes also filter provider=AUTOCAB, including save and delete actions. They cannot bypass Local permissions by using a Local dataset ID. Chromium checks those rejected requests alongside the Local workflow. Final relevant validation: 5 tests passed (navigation, existing API store and Local imports), production build passed and browser workflow passed.
