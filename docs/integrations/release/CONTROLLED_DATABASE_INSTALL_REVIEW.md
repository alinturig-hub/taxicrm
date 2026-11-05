# Controlled Notifications database installation v2 — review only

Owner-provided live evidence confirms database postgres, analysis role cabby_ro/read_only=on, prerequisite tables present, five planned tables absent and no controlled triggers. The application roles are not superusers/role creators/database creators/RLS bypass roles. Booking, BookingLocation, WhatsAppOutboundMessage and the Prisma ledger belong to postgres; public belongs to pg_database_owner. The 15 displayed historical migrations are finished; the bundle independently checks the full ledger for unresolved migrations before any DDL.

## Exact scope requiring separate owner approval

`controlled-booking-confirmed-install.sql` installs exactly the reviewed foundation (three empty rule/decision tables), the bound event/fence table and CRM dispatch table, their sequence/indexes/constraints, a postgres-owned SECURITY DEFINER fence function with pinned search_path, and six row triggers on Booking, BookingLocation, notification_rules, customer_accounts, web_booking_attempts and WhatsAppRecipientGrant. The trigger function is bound to the single reviewed synthetic booking.

The exact reviewed grants are additive. They grant no DELETE, new Booking/customer data writes, role creation or ability to reset prior operations. Existing TaxiCRM DELETE privileges on the old outbox are not modified. The installation changes schema and attaches triggers to existing tables; it is not merely a code deployment.

One explicit transaction covers all changes, with 3-second lock and 30-second statement timeouts. The bundle rejects a different database/migration owner, missing/unexpected objects or role properties, existing controlled functions/triggers, unresolved historical Prisma migrations and unexpected DELETE ACLs on the new tables. A failure aborts the transaction. Never repeat it by editing the guards; inspect the failure instead. Concurrent migration attempts are rejected by a transaction advisory lock.

The original foundation's inner BEGIN/COMMIT wrappers were removed only to put the four reviewed SQL sources into this single transaction. The remaining source SQL is preserved; source checksums and the final bundle checksum are recorded beside the file. The historical Prisma ledger is read, not modified, and `prisma migrate deploy` is not invoked. This is a separately reviewed manual installation for the externally managed schema, not replay of historical migrations.

No deployment, valid test-event creation, permission grant to an actual recipient, notification flag activation, approval-packet generation or provider send is included. New tables remain empty. The expired live test event is not refreshed.

## Verification

Five scenarios passed in an isolated network-disabled PostgreSQL 17 container: successful atomic installation, repeated installation rejection, unresolved migration rejection, existing-object rejection and full rollback when default ACLs unexpectedly grant DELETE. A sentinel booking row and the synthetic Prisma history remained unchanged. The bundle has not been run in production.

Only after separate approval of the exact SHA-256 should an authorized administrator run the file against the confirmed shared database as postgres with psql -X and ON_ERROR_STOP=1. Do not prepend SET ROLE cabby_ro when executing approved DDL; the bundle intentionally requires the migration owner. This does not grant this agent privileged database access.

## v2: owner-confirmed live default ACL correction

The owner attempted the separately approved v1 hash `37cc74f3765048d900d693150cc150adc2c7d12804be210e544d67cf7cecc9d9`. Its postcondition rejected the default DELETE permission and the connection rolled back. A subsequent owner-run read-only query confirmed all five new tables absent. No v1 COMMIT occurred. The owner output establishes direct postgres defaults in public: tables grant SELECT/INSERT/UPDATE/DELETE to taxicrm_shared_app and SELECT to cabby_ro; sequences grant SELECT/USAGE to taxicrm_shared_app. The CRM role has no inherited role memberships.

V2 does not change `ALTER DEFAULT PRIVILEGES`, memberships or any pre-existing relation ACL. After creating the five guarded-absent tables and new decision sequence, but before the original reviewed grants, it issues `REVOKE ALL PRIVILEGES` on ONLY those new objects for the two app roles and PUBLIC. Then it applies the original narrow grants unchanged. The direct default SELECT for cabby_ro is preserved. This also prevents unintended CRM editing of NAC rules, not merely DELETE. Newly introduced effective-ACL assertions protect immutable intent and audit data. Unexpected inherited group privileges still fail closed; the script never broadens scope to fix them automatically.

Eight isolated scenarios passed, including reproducing the exact observed table/sequence defaults, preserving old outbox DELETE privileges/default ACL definitions/cabby SELECT, verifying bounded column privileges, preserving sentinel booking/history rows, leaving unrelated future default behavior unchanged, and full rollback for unexpected inherited group DELETE. These are synthetic tests only.

V2 is a different exact SQL file/hash and requires separate owner approval before any production retry. It remains a single transaction and does not authorize deployment, sending, event TTL changes or general flag activation. Source hashes remain in the adjacent manifest; the manifest describes the additional v2 ACL normalization explicitly.
