# Shift-aware Autocab availability

Canonical fleet reads now derive availability from `DriverShift`, `Driver`, `Vehicle` and `Booking`, rather than interpreting the last `Clear` GPS record as a current working state. This covers the shared TaxiCRM reader used by public map markers, available-driver lists, fleet maps and freshness counts. The corresponding TaxiCRM fleet API uses the same SQL fragment.

The newest shift for both the current driver and vehicle must be the same shift, with status ACTIVE, no end date and an exact vehicle association. A later shift on another vehicle or with another driver invalidates the previous pair. Missing shift evidence fails closed. A delayed GPS or completed booking cannot reopen an ended shift. A newer shift is not blocked by the closure of an earlier shift.

Assigned bookings within that shift take priority over the GPS status: DISPATCHED/ACCEPTED → DOW, ARRIVED → DAP, POB → POB. A terminal event clears its own referenced job only if there is no other active assigned booking and the shift remains open. Future-dated shifts are ignored. New jobs are found using the driver's external ID and the vehicle's external ID when available; missing booking vehicle IDs conservatively block availability for that driver. Completed historical jobs from earlier shifts cannot clear the current vehicle.

Availability also requires a position at or after login, within the existing consumer freshness window, and an active, unsuspended vehicle. A position more than 30 seconds in the future is excluded. Historical fleet rows remain available as offline/stale records, never counted as free. Public markers still omit names and operational callsigns.

No production rows, schema or webhook processing order are changed. Existing monotonic shift handling and canonical booking state transitions remain the event store. The legacy lowercase-table fallback is unchanged; this rollout targets the current shared canonical database configuration.

Validation: an in-memory PostgreSQL regression runs the actual SQL through login, dispatch, arrival, POB, completion, another job, logout, delayed position/completion, a new shift, driver/vehicle reassignment, stale positions and suspension. Existing driver webhook and map interpolation tests also pass. A read-only production query completed successfully on 1 November 2026 at 08:14 UTC; it classified 6 recent available cars, 6 POB, 3 assigned and 2 arrived vehicles, excluding 282 records without a matching open shift. These counts are a point-in-time snapshot, not fixed expected totals.

Both web applications were deployed successfully on 1 November 2026. Need A Cab Plus: d69b6aac; TaxiCRM: 77228073. The failed intermediate TaxiCRM build was corrected by removing an obsolete unused map; lint, TypeScript and a full production build then passed.

## External driversInfo receivers

`driversinfo-pusher.js` targets both `https://api.plymhub.app/api/webhook/drivers` and `https://testapi.plymhub.app/api/webhook/drivers`. Its previous query filtered snapshots to Clear before selecting the latest record, which could resurrect a driver with a later busy snapshot. It also did not enforce shifts. It now reads canonical Vehicle state through the same `fleet-lifecycle.mjs` query as the fleet API.

The outgoing contract remains `{ generatedAt, count, drivers }`, with driver fields `callsign`, `name`, `status: CLEAR`, `lat`, `lng`, external Autocab `driverId`, external Autocab `carId` and `updatedAt`. The existing exclusion for callsign 926 and the two-minute freshness window are preserved. Both receivers get byte-identical snapshots. Successful empty reads send an empty list to remove old cars; failed reads send nothing. An overlapping timer cannot publish snapshots out of order, and failure at one receiver does not prevent attempting the other.

Run `node --test driversinfo-pusher.test.cjs`. Six tests cover the real PostgreSQL query, verified receiver routes, contract, both destinations, empty/failing reads, receiver failure and timer overlap.

## Live sender discovery and rollout

A temporary read-only server audit identified the actual existing sender as PM2 process `driversinfo-nac` in Docker container `openclaw-lilithx`, using `/workspace/opt/projects-forge/integrations/nac-drivers/sender.cjs`. This differs from the older repository script path. Its confirmed receiver routes are `/api/webhook/drivers`; `/api/webhook/driversInfo` returns 404. Direct checks from the cloud workspace were insufficient to establish this.

The actual sender's legacy lowercase driver_positions query was replaced with the tested canonical query recorded in `scripts/driversinfo-runtime-query.sql`. The credential loader, process name, output contract, 10-second cadence and receiver routes were preserved. A successful zero-car result now sends an empty list, so logout can remove the final displayed car. Database failures still send nothing. Staged tests and a read-only dry run passed before installing the file. The original is retained beside it as `sender.cjs.backup-20261101-shift`; the installed SHA-256 is `49a6517e263f6b66674cdbef2fe28ea44010652b29988d06b119fd1a6336614d`.

The existing PM2 process was restarted and its existing process list saved; no second sender was created. Server-originated POSTs on the actual routes returned HTTP 200 from both receivers for the same eligible snapshot. The old /driversInfo test POSTs returned 404 and were not repeated. The temporary audit service must be removed after verification; it is not part of the permanent deployment.
