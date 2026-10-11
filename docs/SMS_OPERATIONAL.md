# SMS gateway and freephone notifications

Implemented on `codex/taxicrm` after explicit approval of the four new tables and their production migration on 11 October 2026. Earlier proposal documents describe the previous preview-only version.

## Configuration

Open Configuration → SMS Gateway. Save the signed Orion URL (first save only), sender and field names. Secrets are AES-256-GCM encrypted using the existing integration key; the public API returns only the base URL and credential-presence flag. Saving sends no SMS. Gateway defaults disabled. To send a real test, save and enable the gateway, enter an explicit destination/message and press Send real test SMS. Tests are persisted and processed by the worker, with a stable request ID preventing accidental resubmission.

Use **Add** for each freephone. Enter its display name, a manually entered general SMS recipient, the exact Autocab source field/value and event rules. Each event can override the recipient and has its own text; threshold is explicit. Source candidates are BookingSource, BookedBy and OurReference. No customer number is interpreted as the freephone. Preview current count reads the booking aggregate without sending. Verify the field/value actually identifies the freephone before enabling; values not observed in stored bookings cannot be enabled. If the actual source is another payload field, a verified mapping adapter is still needed; do not choose an unrelated field.

First check is 24 hours after creation. Subsequent checks retain a fixed 24-hour cadence, not a fixed London wall-clock time. Times are displayed Europe/London; DST does not alter the 24-hour duration. After downtime, one catch-up check covers the latest rolling 24 hours; missed periods are not replayed as old SMS alerts. The window is `(now-24h, now]`, using the provider's bookedAtTime. Future bookings are excluded. Missing source/date data suppresses zero/threshold alerts; daily reports carry an incomplete-data warning. Each matching event creates its own message. Disabling a workflow cancels pending/retry messages; a request already in flight cannot be recalled.

## Worker and delivery history

The authenticated internal worker endpoint runs each minute through the existing CRON_SECRET scheduler, planning at most five workflows and processing at most ten messages per tick. Job rows and delivery rows are claimed with transaction row locks and SKIP LOCKED, across replicas. Counts, logical run identity, messages and next schedule are saved atomically. Unique run and event/destination constraints prevent duplicates. This does not guarantee exactly-once physical delivery by a provider without idempotency support.

ACCEPTED means HTTP/provider acceptance, not confirmed handset delivery. HTTP 429 retries have a bounded delay and five-attempt cap. Other rejections fail. HTTP 5xx, interrupted calls, oversized acknowledgements and expired sending leases become UNCERTAIN and are not blindly resent. The administrator can inspect history and reconcile with Orion; no automatic resend of uncertain messages is implemented. Provider response bodies, signed URLs and credential values are not logged or exposed as errors.

The gateway and workflows can be disabled independently. A disabled gateway performs no new planning or delivery. Disabling and re-enabling the gateway retains the queue; review pending messages before re-enabling. Booking reads are SQL aggregates, without loading whole payload histories into Node. Counts have a 10-second statement timeout. Latest 30 checks and up to 100 workflows are displayed.

## Approved deployment migration

`20261011190000_sms_notifications` is additive: only SmsGatewayConfiguration, NotificationJob, NotificationJobRun, NotificationDelivery, their indexes/relations and its Prisma migration-history entry. It does not modify Booking, financial rules or existing records.

For this approved rollout, ENABLE_SMS_SCHEMA_MIGRATION=true makes startup execute only this migration inside one transaction and an advisory lock. It checks the checksum of any completed migration and fails closed on conflicting/incomplete history. It does not invoke the full historical migration chain. ORION_SMS_BOOTSTRAP_ENCRYPTED can initialize an absent gateway with the signed parameters encrypted for the production integration key; the gateway remains disabled and no jobs/recipients are created. Existing gateway settings are never overwritten by bootstrap. These bootstrap variables should be removed from saved runtime configuration after successful rollout; repeated execution is idempotent.

Verification uses only an isolated database, synthetic recipients and mocked Orion requests. No real SMS is sent during development verification. Production schema changes are authorized; real sending is activated only by the administrator's configured workflows or explicit test button.

Verified freephone line numbers can explicitly use TelephoneNumber as their source. UK national, +44 and 0044 formats are normalised. The read-only lookup accepts at most 25 supplied lines and returns aggregate counts plus three booking examples per line; it does not create workflows or send SMS. Missing booking dates and future dates are reported separately. The monitored line is separate from the SMS recipient.
