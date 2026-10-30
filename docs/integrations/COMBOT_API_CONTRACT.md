# Com.Bot documented contract review

Source: https://documenter.getpostman.com/view/14215086/2sA3e2hAeY
Reviewed: 2026-10-29. Public Postman collection 3b03fb9b-a16e-43fc-9c9c-39d4785193a2.

Confirmed request contracts:
- WhatsApp messages: POST {{domain}}/api/meta/{{version}}/{{phone_number_id}}/messages, Bearer token.
- Templates: GET {{domain}}/api/meta/{{version}}/{{waba_id}}/message_templates?limit=10&offset=0.
- Template creation: POST to the same message_templates resource. Examples contain legacy ALERT_UPDATE category; do not use it as current policy.
- Campaign creation: POST {{crmapi_domain}}/crm/campaign, API-KEY header. The example uses action=trigger; never replay it during setup.
- Webhook management: {{base-url}}/v2/webhook, Bearer token. Supports incoming, sent, delivered, read, failed and other events.

The collection leaves domain, crmapi_domain and base-url unresolved. They are not
proven to be the login host. Do not infer them from v3.com.bot/login. Credentials
for WhatsApp and CRM APIs may differ. Obtain each from secure account settings.
No live requests, registrations or messages were made during this review.

Remaining evidence before activation: actual account API origins and supported
version, response examples, webhook signing/verification and payloads, rate limits,
idempotency support and reconciliation after ambiguous send timeouts. Request plans
in combot-contract.ts are pure and tested; they do not activate the adapter or worker.

## Account setup guide

Source: https://helpdocumentation.gitbook.io/user/messaging-channels/whatsapp-api/managing-your-whatsapp-api/send-messages-via-api-for-your-official-whatsapp-number-postman

The guide locates API URL, API Version, Phone Number ID and Bearer token at
Channels > three dots > Access Token. Approved template JSON is available at
Channels > Template Manager > approved template > JSON icon. Template variables
must not contain line breaks. Header media needs the appropriate URL.

The guide expresses the endpoint as API_URL/API_VERSION/PHONE_NUMBER_ID/messages.
API_URL may already contain /api/meta: reconcile the actual account value before
constructing an absolute URL, to avoid duplicating that prefix.

The synchronous response supplies a Queue ID. Store this separately from the final
provider message ID. Treat it only as queued/accepted, never delivered. Correlate
subsequent success/error webhook updates; exact response keys, correlation fields
and webhook authentication still need verified examples. Do not retry an ambiguous
accepted request automatically. Existing response/message-ID handling must support
this two-stage acknowledgement before real sending is enabled.
