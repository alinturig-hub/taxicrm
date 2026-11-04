# WhatsApp template wizard

Prepared from the Meta documentation review in WHATSAPP_TEMPLATE_EDITOR_META_REVIEW_2026-11-04.md and the owner's WhatsApp Manager screenshots.

## Implemented

- Three steps: purpose/name/language/parameter format; content and actions; validated review and explicit submission.
- Responsive sticky phone preview updates from local input, with common WhatsApp formatting markers, media samples, footer and button overflow illustration.
- Positional and named body variables, up to ten in this editor; a text header supports one. Synthetic examples are entered per variable.
- Image samples (JPG/PNG up to 5 MB), MP4 and PDF samples (16 MB local cap), text or location headers. Upload session now includes file_name as required by Meta. Location data is a send-time value; no live tracking is implied.
- Up to ten buttons with validated grouping and per-type limits. Static/dynamic HTTPS URL (one suffix parameter plus example), international phone number, quick reply, copy code and an existing published Flow ID. This implementation restricts Flow to a standalone button pending broader combination verification.
- URL parameters cannot change the host. Copy-code example is at most 20 characters; Meta supplies its label. Quick replies are grouped separately from other actions.
- Preview for four-plus buttons shows two buttons plus See all options and notes desktop rendering limitations.
- All preview/submit/upload endpoints retain authenticated integration-management access and same-origin checks. JSON and media reads are bounded. No automatic submission retry on an ambiguous result.

## Explicit boundaries

Authentication/OTP templates, WhatsApp voice calls and contact sharing are not enabled by this general-purpose editor. Flow creation, booking URLs, actual variable values, reply automation and sending remain separate integrations. Account eligibility and final content/category approval belong to Meta. Drafts remain in the current browser tab; no schema change is required. The existing dedicated image API path also accepts validated PDF/MP4 samples for compatibility.

## Verification

- 48 synthetic WhatsApp unit/contract tests passed, including named variables, ten-button limits, dynamic URL host safety, media types, copy code and Flow isolation, submission failures and upload filename/signature handling.
- TypeScript and lint passed.
- Chromium verification using a temporary local harness and intercepted API responses: wizard steps, live sample substitution, dynamic URL field, confirmation gate, 390px viewport without horizontal overflow and no page errors. No real Meta upload/submission was exercised. Temporary route removed after verification.
- Production build checked separately with a synthetic unavailable database address; no live database access used.
