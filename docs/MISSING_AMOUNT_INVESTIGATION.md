# Missing Cost/Price investigation

The secret-authenticated financial audit supports `GET ?missing=1&afterId=...` for read-only, cursor-based evidence collection. It inspects at most 1,000 bookings per batch where both canonical amounts are null, returning counts by stored status and Europe/London year. It never returns customer identities or raw payloads, rewrites source fields, calls providers, sends notifications, or changes schema.

Evidence distinguishes numeric source `Pricing.Price/Cost`, alternate lowercase/root paths, stored Fare (including explicit zero), and existing payment allocations. These are separate evidence categories; counts can overlap and are not a recoverable-value promise. Decimal range, currency, exact booking identity, provenance and chronology must be validated before any future repair. Payment allocations and Fare are never silently substituted for Cost/Price.

When the existing Need A Cab Plus `public.bookings` table has the expected columns, the batch also checks matching Autocab external references for recorded numeric Cost/Price in pricing data or known raw paths. It does not join unrelated providers or aggregate legacy tables as extra revenue.

Optional `history=1` inspects the first 100 bookings in that batch, up to 20 latest matching webhook payloads and snapshots per booking, using indexed reference/booking lookups. It reports coverage and truncation counters. A sampled absence is not evidence that every historical event lacks amounts. The external operator runner samples every 20th batch, labels this limitation, and stores only aggregate receipts outside Git.

Every batch uses a repeatable-read, READ ONLY transaction with a 25-second statement timeout, single query parallelism and 8 MB work memory. Synthetic integration verification checks evidence categories, history, cursor completion and unchanged source bookings. The diagnostic is an investigation tool, not a scheduled recovery job.

`historyOnly=1&history=1` restricts pagination to missing-amount bookings for which an indexed canonical webhook-reference or snapshot lookup exists. It uses 100-booking batches, so every selected booking is inspected rather than sampled. Event processing-state totals and unlinked/mismatched booking relations are aggregate evidence only. This still retains the per-booking 20-event/snapshot cap and reports truncation explicitly.
