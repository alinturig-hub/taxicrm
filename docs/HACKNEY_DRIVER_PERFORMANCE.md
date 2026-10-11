# Hackney Driver Performance

The authenticated dashboard at `/dashboard/intelligence/hackney` reports Autocab
`FlaggedBooking` jobs by pickup date. The two date inputs are inclusive calendar
dates in `Europe/London`; the query uses a half-open UTC interval so the 23-hour
and 25-hour DST days work correctly. The existing executive monthly summary also
uses London months rather than the database session's timezone.

Bookings are associated with registry drivers by `driverBadgeNumber` and
`badgeNumber`, trimming whitespace and ignoring case. Leading zeroes and
punctuation are preserved. External driver IDs, names and callsigns are not
fallback matches. Inactive and archived registry entries remain available for
historical reports. Duplicate registry badges are ambiguous, not attributed to
the first driver found. Jobs with missing or unmatched badges remain visible in
the totals and unattributed rows.

Completion rate is completed jobs divided by all dated jobs in the selected
period. Recorded fares include only completed jobs with a valid nonnegative
fare, including an explicit zero. Missing fares are counted separately and are
not estimated from price or cost. The undated-job warning is an all-time count:
these jobs cannot be assigned to the selected period and are excluded.

## Webhook processing

- A row lock on the stored event prevents concurrent workers from processing
  it twice. Booking updates, timeline, snapshot and `PROCESSED` status commit
  together. A failure rolls back all durable effects and records a failed attempt.
- Transaction-scoped advisory locks serialize updates to the same booking,
  driver or tracked vehicle without new schema fields.
- Newly received JSON is hashed with object keys sorted recursively. Changes in
  whitespace and object key order no longer create duplicates; array order is
  preserved. Identical raw-body retries still recognize legacy keys. Historical
  keys are not rewritten, so reformatted deliveries of legacy events may still
  produce a new stored event. No deduplication backfill was run.
- Duplicate deliveries retry the existing event. The existing protected queue
  also selects failures after a 60-second cooldown, with a five-attempt cap, and
  legacy `PROCESSING` rows older than five minutes. The queue requires its normal
  authenticated scheduler invocation; no scheduler credentials were enabled here.
- Context events before their booking fail retryably rather than being discarded.
  Rejections do not terminally block acceptance/completion and do not assign the
  rejecting driver to a booking. A newer recovery can return a live booking to
  dispatch, while a delayed recovery cannot regress it.
- Older booking payloads preserve newer values and coherent driver identity;
  partial driver metadata does not erase an omitted badge. Explicit driver removal
  clears the assignment. Older/equal-timestamp vehicle tracks cannot overwrite
  live position. A delayed shift-start does not reopen an ended shift.
- Timeline timestamps use offset-aware event timestamps, modification timestamps
  or the applicable lifecycle timestamp. Without one, receive time is the fallback.
  Perfect source ordering cannot be inferred from payloads without timestamps or
  revisions, and equally dated conflicting payloads need provider-specific rules.
  Conflicting terminal statuses retain the existing conservative first-terminal
  policy; automatic terminal corrections have not been introduced.
- Enrichment, metric broadcasts and other optional effects run after commit and
  cannot mark committed events failed. They remain best effort; guaranteed
  delivery would require a separately approved durable-outbox design.

## Synthetic validation

Unit tests:

```bash
npx --no-install tsx --test src/lib/**/*.test.ts
```

Integration tests explicitly refuse databases other than the isolated loopback
development database and require opt-in:

```bash
TAXICRM_SYNTHETIC_TESTS=1 npx --no-install tsx --test tests/integration/hackney-webhooks.test.ts
```

They create uniquely prefixed synthetic bookings, drivers, webhook configurations
and events, remove fixtures afterward, and reject any attempted external fetch.
They cover concurrent delivery, atomic rollback, retries, ordering, badge matching,
London month boundaries, partial metadata, GPS regression and ended shifts.
Run `npm run build` with the local development configuration to validate the page,
types and lint. Stop the development server before building, because both use
`.next`.

No schema change, migration, backfill, deployment or production operation is part
of this implementation. Production, real databases, PlymHub.ai, OpenClaw and the
Need A Cab import remain outside the authorized scope.
