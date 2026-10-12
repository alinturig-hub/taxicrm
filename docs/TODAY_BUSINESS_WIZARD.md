# Today: daily business view

The Today workspace now displays today's business events instead of all-time
customer/driver totals and module links. UI copy remains English.

The three-step inline wizard asks the user's focus (business, operations,
exceptions), their preferred figures, and confirmation. Customize Today can
reopen it. Set up later leaves a usable default view. Preferences are versioned,
validated against role-visible widgets and saved under a per-user localStorage
key. They apply to this browser, not all devices. No schema change or migration.

Figures use Europe/London and one server calculation timestamp:

- Bookings received: booking creation timestamp from midnight to now.
- Pickups scheduled: pickup timestamp within the entire London day, all statuses.
- Completed journeys: completion timestamp from midnight to now.
- Recorded revenue: existing company revenue calculation for completion events
  and account no-fare events from midnight to now, matched by provider/accountId.
  This is not profit. Price/cost fallback and waiting rules are unchanged.
- Cancellations: cancellation timestamp from midnight to now.
- Processing failures: events received today whose current status is FAILED.

Missing relevant timestamps are excluded from the respective figure, never
replaced with import time. Revenue shows a partial-amount warning for records
missing both price and cost; known zero remains a recorded value. Stored fields
may still be incomplete upstream. No invented fares, ratios or live-health claims.

Server data queries are permission-gated: bookings.view, integrations.view and
existing dashboard.view for financial figures. Client selection does not grant
access. Revenue processing reads only selected fields in 250-booking batches;
no raw payloads, provider calls or writes. Refresh reloads server figures; there
is no automatic polling or message sending.

Synthetic integration coverage tests London midnight, exclusion of future events,
future scheduled pickups, account waiting charges, missing amounts and hidden
figures. Browser smoke covers the three-step wizard, presets, save/reload,
customization and the existing theme/mobile/navigation checks.

Not implemented: cross-device preference sync, custom time windows, real-time
push updates, editable financial rules, campaigns or new schema models.
No production deployment is performed as part of this change.

## Owner comparison cards

Business defaults now include recorded revenue, company profit readiness,
bookings received and completed journeys. Cards show yesterday's value and the
absolute/percentage change. A zero baseline has no percentage, never Infinity.
Cancelled/failed event decreases are favourable; other activity increases are
shown as growth, not proof of profitability. Both periods flag missing amounts.

Activity and revenue compare midnight to the same London local clock time on
both days. Scheduled pickups compare whole-day schedules explicitly; the
historical schedule is its current database state, not a saved as-of snapshot.
Failures likewise reflect current FAILED status of events received in each window.
A repeated autumn time chooses the earlier occurrence on yesterday's date;
a nonexistent spring time shifts forward by the gap. DST policies are tested.

Company profit remains unavailable because driver payouts and operating expenses
are not supplied by the existing revenue fields. Booking cost is already part
of the established revenue fallback and is not assumed to be a business expense.
The owner confirmed costs will later be connected externally. No API connector,
expense schema, AI agent, credential access or profit rule is introduced here.
The current view uses existing TaxiCRM data only. AI is explicitly deferred.
