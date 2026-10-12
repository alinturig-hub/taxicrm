# Booking data repair

The owner explicitly requested production backfill for customer tags/profiles,
Fare and Places on 12 October 2026. This does not authorize unrelated imports,
financial-rule changes, messages, database migrations or excluded integrations.

The internal POST /api/internal/booking-fare-backfill is cron-secret protected,
uses a timing-safe comparison, validates bounded batches (1–1000) and defaults to
dry-run. Cursor state belongs to the operator and can resume without offsets.

- action fare: scans only AUTOCAB records with missing fare, extracting original
  Pricing.Fare or Pricing.fare with the same canonical-key precedence as mapping.
  It fills only provider-supplied finite values fitting Decimal(12,2). Explicit
  zero is valid. Missing/invalid source values remain missing; price/cost are never
  substituted. Existing fare, provider payloads and financial rules are untouched.
  Updates check the original updatedAt and missing fare to avoid racing webhooks.
- action places-cache: links unlinked pickup/destination rows with coordinates to
  existing READY/NOT_FOUND coordinate-key cache records. The canonical JS key
  function is reused. Conditional writes check coordinates and missing linkage.
  There are no external calls or credit reservations. No coordinates are guessed.

Results contain counts and a cursor, no passenger data. Fare scan results separate
missing source, invalid values and concurrent changes. Such conflicts remain for
explicit retry; scanning to the end is not evidence that every missing fare can
be recovered. Cached NOT_FOUND is not an identified place.

External Places enrichment continues to obey provider configuration and existing
quotas. Historical tag rules retain 14-day evidence; profile snapshots retain
existing eligibility. New all-time tags, made-up fares, and reconstructed missing
locations are not introduced. No schema change is required.

Synthetic integration validation covers zero and numeric-string fare, missing or
invalid originals, canonical null precedence, existing-fare and LOCAL isolation,
idempotency, payload/price preservation and credit-free NOT_FOUND cache linkage.
