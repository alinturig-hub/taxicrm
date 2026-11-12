-- Aggregate source coverage only: no individual driver/customer data.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT current_database() AS database_name, current_user AS role, current_setting('transaction_read_only') AS read_only, now() AS checked_at;
SELECT count(*) AS canonical_bookings, max("updatedAt") AS latest_update FROM "Booking";
SELECT count(*) AS bookings, count("driverId") AS with_driver_id, count("pickupDueTime") AS with_pickup_time,
 count("acceptedAt") AS with_accept_time, count("completedAt") AS with_completed_time,
 count("meterDistanceMetres") AS with_meter_distance_metres, count("distance") AS with_distance,
 count("paymentType") AS with_payment_type, count("price") AS with_price
 FROM "Booking" WHERE "pickupDueTime" >= now() - interval '30 days' AND "pickupDueTime" < now();
SELECT coalesce("paymentType", '(missing)') AS payment_type, count(*) FROM "Booking"
 WHERE "pickupDueTime" >= now() - interval '30 days' AND "pickupDueTime" < now()
 GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
SELECT count(*) AS shifts, count("endedAt") AS with_end_time, count(DISTINCT "driverId") AS drivers
 FROM "DriverShift" WHERE "startedAt" >= now() - interval '30 days' AND "startedAt" < now();
SELECT count(*) AS snapshots, count("driverId") AS with_driver, count("bookingId") AS with_booking,
 min("snapshotAt") AS earliest, max("snapshotAt") AS latest
 FROM "VehicleSnapshot" WHERE "snapshotAt" >= now() - interval '7 days' AND "snapshotAt" < now();
SELECT "eventType", count(*) FROM "BookingTimelineEvent"
 WHERE "occurredAt" >= now() - interval '30 days' AND "occurredAt" < now()
 AND "eventType" IN ('BookingDispatched','BookingDispatchAccepted','BookingRejected','BookingCancelled','BookingNoFare','BookingComplete')
 GROUP BY 1 ORDER BY 2 DESC;
ROLLBACK;
