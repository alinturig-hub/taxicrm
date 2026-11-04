# WhatsApp template editor: Meta documentation review

Reviewed 4 November 2026 against owner-provided WhatsApp Manager screenshots.

## Official sources read

- Fundamentals: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
- Components: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components
- Resumable uploads: https://developers.facebook.com/docs/graph-api/guides/upload

Pages fetched successfully; the first two render their documentation content from embedded JSON, which was extracted for review. Screenshots illustrate the desired UX; they do not establish API availability for this account.

## Confirmed rules and gaps

- Categories: Marketing, Utility, Authentication. Authentication needs its own specialized editor/payload rather than the general marketing form.
- Headers: text, image, video, document; location for Utility and Marketing. Location coordinates are supplied when sending; live tracking is not a location header. GIF support on the components page is specifically qualified for Marketing Messages API; do not enable it unconditionally for Cloud API.
- Text header maximum 60 characters; body maximum 1,024; footer maximum 60.
- Variables: positional and named. Named examples use `{{first_name}}`; example values are required. Current editor supports positional body variables only.
- Media template samples use Resumable Upload API and `header_handle`, not an arbitrary public URL. Upload guide lists file_name, file_length and file_type as required session parameters. Current upload implementation omits file_name: correct before treating image upload as externally verified.
- Up to 10 buttons in supported combinations. Maximum two URL buttons, one phone button, ten quick replies; quick replies and other actions must form separate groups. Current three-button limit is our own initial restriction, not Meta's overall maximum.
- URL buttons support one variable appended at the end, with a sample. Current editor only accepts static URLs.
- Phone call and WhatsApp voice call are separate button types. WhatsApp voice call eligibility and setup must be checked before enabling.
- More than three buttons render through "See all options"; Meta documents desktop limitations for four-plus buttons or mixed quick reply/other button templates. Preview should explain this rather than showing a misleading identical layout everywhere.
- Template creation/review is distinct from sending. Only approved templates can be sent; account restrictions and messaging rules still apply.
- Current Meta list projects body text only, so it does not yet present the full approved rich template.

## Proposed product model

1. Setup: category and supported message type, name/language and parameter style.
2. Edit: header/media upload, body toolbar and variable insertion, explicit per-variable synthetic examples, footer, ordered action buttons. Sticky responsive phone preview updates while typing, before server validation.
3. Review: summary, category, media and examples, explicit confirmation then one submission. An ambiguous result requires checking Meta status rather than automatic retry.

Keep draft editing and local preview separate from the external image upload and template submission. Use labels to disclose these actions. Authentication, Flows, WhatsApp calls and contact-sharing need dedicated contracts and validation; do not expose nonfunctional controls merely because they appear in a screenshot. Flow/contact-sharing/validity-specific API constraints are not established by the three core sources above.

For the taxi use case, start with Utility booking confirmation/update and Marketing offer templates. Manage Booking/Track Driver links need verified NeedACab Plus URL contracts. A quick-reply label alone does not implement booking automation. STOP/UNSUBSCRIBE processing must be implemented centrally before claiming opt-out automation.

No Meta templates created and no live messages sent during this research. No production changes made by this review.
