# Driver On/Off shift policy

Owner clarification, 12 October 2026: Shift Start/Shift End webhooks are the
source of truth for driver shift state. GPS must never define On/Off shift.

- Resolve the latest started shift for each driver across ACTIVE and ENDED rows.
  Only matching Started/ACTIVE or Ended/ENDED rows qualify. Legacy Unknown subtypes are not valid Shift Start evidence.
  A later ended shift supersedes historical ACTIVE rows. Ties prefer ENDED.
- On shift: that latest shift is ACTIVE with no recorded end.
- Off shift: that latest shift has a recorded Shift End / ENDED state.
- No known shift event is not evidence of Off shift. Future-start records are not
  treated as current shifts. No expiry or fabricated closure is applied.
- Recent vehicle telemetry is a separate signal-quality metric. Lost GPS,
  NotWorking, stale or unknown vehicle status must not close a shift or move the
  driver to Off shift. The primary On shift KPI uses shift state alone.

The webhook processor accepts Started/Ended subtypes only. Invalid date order
and malformed end dates on Ended events fail transactionally instead of inventing active shifts.
Optional EndedDate placeholders on Started events cannot turn a Start into an End.
The existing two-second timestamp matching tolerance is retained. A delayed
start cannot reopen an ended shift. Duplicate ends reuse a matching shift and
cannot erase or regress a known end. Partial retries preserve a known vehicle
association when vehicle details are omitted. Each driver is transaction-locked.
An old end for an earlier shift does not close a newer shift.

Original webhook payloads remain stored. Legacy ACTIVE rows are not deleted or
closed by age; aggregate audit identifies drivers now Off because their latest
shift ended. Historical cleanup requires explicit matching source evidence.
There is no database schema change, automatic age-based repair or GPS-based
status backfill in this release. Financial rules and excluded integrations are
unchanged. The live map remains removed.

Tests use synthetic data and block external fetch: reverse event order, duplicate
end jitter, older-end retry, newer-start preservation, unknown subtype and invalid
chronology, latest-ended database selection, and On shift without vehicle GPS.
