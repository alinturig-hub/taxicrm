# Approved controlled Meta outbound release

Based on live e421629. Contains only the controlled test sender, outbox and inbox
correlation, not other pending Marketing/benefit changes. Build and 30 relevant
unit tests pass. Live read-only check found WhatsAppOutboundMessage absent.

Admin operation required on verified q9fahphg3lydu18inysgmerq / postgres:
apply prisma/migrations/20261103000000_whatsapp_outbound/migration.sql in a transaction;
grant SELECT, INSERT, UPDATE on public."WhatsAppOutboundMessage" to taxicrm_shared_app.
Do not grant CREATE/schema privileges, change canonical bookings or existing tables.
Verify table/unique constraints and role privileges before committing. If already
present, inspect structure rather than reapply. Use secure administrator credentials.

After confirmation: deploy this release; configure META_WHATSAPP_ENABLED=true,
META_WHATSAPP_TEST_SEND_ENABLED=true, META_WHATSAPP_SENDING_ENABLED=true and an
explicit approved test-recipient allowlist. These flags activate only the protected
fixed hello_world/en_US test endpoint, not campaigns. Recheck temporary Meta token.
No message is sent by deployment; operator must explicitly confirm and click send.
No startup migration, background send job or automatic retry is added.
