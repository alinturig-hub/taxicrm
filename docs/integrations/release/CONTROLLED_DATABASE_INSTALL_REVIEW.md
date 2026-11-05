# Controlled Notifications database installation — review only

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
