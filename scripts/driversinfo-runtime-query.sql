-- Canonical query installed in the existing PM2 driversinfo-nac sender.
SELECT 0::bigint AS id,driver_id,car_id AS vehicle_id,latitude,longitude,callsign,name,status AS vehicle_status,"updatedAt" AS recorded_at FROM (
    SELECT driver.callsign, concat_ws(' ',driver.forename,driver.surname) AS name,
      fleet_state.status, vehicle."currentLatitude" AS latitude, vehicle."currentLongitude" AS longitude,
      driver."externalId" AS driver_id, vehicle."externalId" AS car_id, vehicle."lastSeenAt" AS "updatedAt"
    FROM public."Vehicle" vehicle
    LEFT JOIN public."Driver" driver ON driver.id=vehicle."currentDriverId"
    
LEFT JOIN LATERAL (
 SELECT s.* FROM public."DriverShift" s
 WHERE s.provider=vehicle.provider AND s."driverId"=driver.id AND s."startedAt"<=now()
 ORDER BY s."startedAt" DESC, s."modifiedAt" DESC NULLS LAST, s.id DESC LIMIT 1
) driver_shift ON true
LEFT JOIN LATERAL (
 SELECT s.id FROM public."DriverShift" s
 WHERE s.provider=vehicle.provider AND s."vehicleId"=vehicle.id AND s."startedAt"<=now()
 ORDER BY s."startedAt" DESC, s."modifiedAt" DESC NULLS LAST, s.id DESC LIMIT 1
) vehicle_shift ON true
LEFT JOIN LATERAL (
 SELECT b."externalId",b.status FROM public."Booking" b
 WHERE driver_shift.status='ACTIVE' AND driver_shift."endedAt" IS NULL
 AND driver_shift."vehicleId"=vehicle.id AND driver_shift.id=vehicle_shift.id
 AND b.provider=vehicle.provider AND b."driverId"=driver."externalId"
 AND (b."vehicleId"=vehicle."externalId" OR b."vehicleId" IS NULL)
 AND greatest(b."dispatchedAt",b."acceptedAt",b."arrivedAt",b."pickedUpAt")>=driver_shift."startedAt"
 AND b.status IN ('DISPATCHED','ACCEPTED','ARRIVED','POB')
 ORDER BY greatest(b."completedAt",b."cancelledAt",b."noFareAt",b."pickedUpAt",b."arrivedAt",b."acceptedAt",b."dispatchedAt") DESC,b.id DESC LIMIT 1
) shift_booking ON true
LEFT JOIN LATERAL (
 SELECT b.status FROM public."Booking" b
 WHERE driver_shift.status='ACTIVE' AND driver_shift."endedAt" IS NULL
 AND driver_shift."vehicleId"=vehicle.id AND driver_shift.id=vehicle_shift.id
 AND b.provider=vehicle.provider AND b."externalId"=vehicle."currentBookingId"::text
 AND b."driverId"=driver."externalId" AND (b."vehicleId"=vehicle."externalId" OR b."vehicleId" IS NULL)
 AND greatest(b."completedAt",b."cancelledAt",b."noFareAt")>=driver_shift."startedAt"
 AND b.status IN ('COMPLETED','CANCELLED','NO_FARE') LIMIT 1
) terminal_booking ON true
LEFT JOIN LATERAL (
 SELECT COALESCE(driver_shift.status='ACTIVE' AND driver_shift."endedAt" IS NULL
 AND driver_shift."vehicleId"=vehicle.id AND driver_shift.id=vehicle_shift.id,false) AS on_shift
) shift_state ON true
LEFT JOIN LATERAL (
 SELECT CASE
 WHEN NOT shift_state.on_shift THEN 'NotWorking'
 WHEN lower(coalesce(vehicle."currentStatus",''))='notworking' THEN 'NotWorking'
 WHEN shift_booking.status='POB' THEN 'BusyMeterOnFromClear'
 WHEN shift_booking.status='ARRIVED' THEN 'Arrived'
 WHEN shift_booking.status IN ('DISPATCHED','ACCEPTED') THEN 'BusyMeterOff'
 WHEN terminal_booking.status IS NOT NULL THEN 'Clear'
 ELSE coalesce(vehicle."currentStatus",'Unknown') END AS status,
 CASE WHEN NOT shift_state.on_shift OR terminal_booking.status IS NOT NULL AND shift_booking."externalId" IS NULL THEN NULL
 WHEN shift_booking."externalId" ~ '^[0-9]{1,9}$' THEN shift_booking."externalId"::integer
 ELSE vehicle."currentBookingId" END AS booking_id
) fleet_state ON true
    WHERE vehicle.provider='AUTOCAB' AND shift_state.on_shift
 AND vehicle."lastSeenAt">=driver_shift."startedAt"
 AND vehicle."lastSeenAt"<=now()+interval '30 seconds'
 AND vehicle."isActive" IS DISTINCT FROM false AND vehicle."isSuspended" IS DISTINCT FROM true
      AND vehicle."lastSeenAt">=now()-make_interval(secs=>120)
      AND fleet_state.status='Clear'
      AND driver.callsign IS NOT NULL AND driver.callsign<>'926'
      AND vehicle."currentLatitude" BETWEEN -90 AND 90
      AND vehicle."currentLongitude" BETWEEN -180 AND 180
    ORDER BY vehicle."lastSeenAt" DESC,vehicle."externalId"
  ) canonical_available;
