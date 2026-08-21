import { prisma } from "@/lib/prisma";

export type RefusalPoint = {
  lat: number;
  lng: number;
};

export type RefusalDriver = {
  callsign: string;
  name: string | null;
};

export type RefusalDetail = {
  bookingId: string;
  externalId: string;
  status: string;
  typeOfBooking: string | null;
  bookingSource: string | null;
  accountName: string | null;
  customerName: string | null;
  telephoneNumber: string | null;
  pickup: RefusalPoint | null;
  pickupAddress: string | null;
  pickupZone: string | null;
  driver: RefusalDriver | null;
  driverPosition: RefusalPoint | null;
  driverPositionAt: string | null;
  refusedAt: string | null;
  deltaSeconds: number | null;
  distanceKm: number | null;
  outcome: {
    completedAt: string | null;
    noFareAt: string | null;
    cancelledAt: string | null;
  };
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Gaseste cel mai apropiat snapshot GPS de un moment dat, pentru un driver intern id. */
async function nearestVehiclePosition(
  driverId: string,
  at: Date,
): Promise<{ lat: number; lng: number; at: Date } | null> {
  const windows: Array<[number, number]> = [
    [5 * 60, 5 * 60],
    [15 * 60, 15 * 60],
    [30 * 60, 30 * 60],
    [60 * 60, 60 * 60],
  ];

  for (const [beforeSec, afterSec] of windows) {
    const before = new Date(at.getTime() - beforeSec * 1000);
    const after = new Date(at.getTime() + afterSec * 1000);

    const rows = (await prisma.$queryRaw`
      SELECT latitude, longitude, "snapshotAt"
      FROM "VehicleSnapshot"
      WHERE "driverId" = ${driverId}
        AND latitude IS NOT NULL
        AND "snapshotAt" BETWEEN ${before} AND ${after}
      ORDER BY ABS(EXTRACT(EPOCH FROM ("snapshotAt" - ${at}::timestamp)))
      LIMIT 1
    `) as Array<{ latitude: string | number; longitude: string | number; snapshotAt: Date }>;

    if (rows.length > 0) {
      return {
        lat: Number(rows[0].latitude),
        lng: Number(rows[0].longitude),
        at: rows[0].snapshotAt,
      };
    }
  }

  return null;
}

/**
 * Coreleaza un booking refuzat: cine a refuzat (din lanțul de dispatch),
 * poziția șoferului la momentul refuzului, pickup-ul, distanța.
 */
export async function getRefusalDetail(
  bookingId: string,
): Promise<RefusalDetail | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    return null;
  }

  // 1. Evenimentul de refuz (ultimul, daca sunt mai multe)
  const rejectEvents = await prisma.bookingTimelineEvent.findMany({
    where: { bookingId, eventType: "BookingRejected" },
    orderBy: { occurredAt: "desc" },
    take: 1,
  });

  const refusal = rejectEvents[0] ?? null;

  // 2. Pickup location
  const pickupLocation = await prisma.bookingLocation.findUnique({
    where: { bookingId_type: { bookingId, type: "PICKUP" } },
  });

  // 3. Refuzantul: ultimul BookingDispatched anterior refuzului
  let driverCallsign: string | null = null;
  let refusedAt: Date | null = null;

  if (refusal) {
    refusedAt = refusal.occurredAt;
    const dispatched = (await prisma.$queryRaw`
      SELECT metadata->'DriverDetails'->'Driver'->>'Callsign' AS callsign
      FROM "BookingTimelineEvent"
      WHERE "bookingId" = ${bookingId}
        AND "eventType" = 'BookingDispatched'
        AND "occurredAt" <= ${refusal.occurredAt}
        AND metadata->'DriverDetails'->'Driver'->>'Callsign' IS NOT NULL
      ORDER BY "occurredAt" DESC
      LIMIT 1
    `) as Array<{ callsign: string | null }>;

    driverCallsign = dispatched[0]?.callsign ?? null;
  }

  // 4. Driver intern id pe baza callsign
  let driverInternalId: string | null = null;
  let driverName: string | null = null;

  if (driverCallsign) {
    const driver = await prisma.driver.findFirst({
      where: { callsign: driverCallsign },
      select: { id: true, fullName: true, forename: true, surname: true },
    });
    if (driver) {
      driverInternalId = driver.id;
      driverName =
        driver.fullName ??
        ([driver.forename, driver.surname].filter(Boolean).join(" ") ||
        null);
    }
  }

  // 5. Pozitia soferului la momentul refuzului
  let driverPos: { lat: number; lng: number; at: Date } | null = null;
  if (driverInternalId && refusedAt) {
    driverPos = await nearestVehiclePosition(driverInternalId, refusedAt);
  }

  const pickupPoint: RefusalPoint | null =
    pickupLocation?.latitude != null && pickupLocation.longitude != null
      ? {
          lat: Number(pickupLocation.latitude),
          lng: Number(pickupLocation.longitude),
        }
      : null;

  let distanceKm: number | null = null;
  let deltaSeconds: number | null = null;

  if (driverPos && pickupPoint) {
    distanceKm = haversineKm(
      driverPos.lat,
      driverPos.lng,
      pickupPoint.lat,
      pickupPoint.lng,
    );
  }

  if (refusedAt && driverPos) {
    deltaSeconds = Math.abs((refusedAt.getTime() - driverPos.at.getTime()) / 1000);
  }

  return {
    bookingId: booking.id,
    externalId: booking.externalId,
    status: booking.status,
    typeOfBooking: booking.typeOfBooking,
    bookingSource: booking.bookingSource,
    accountName: booking.accountName,
    customerName: booking.customerName,
    telephoneNumber: booking.telephoneNumber,
    pickup: pickupPoint,
    pickupAddress: pickupLocation?.address ?? null,
    pickupZone: pickupLocation?.zoneName ?? null,
    driver: driverCallsign
      ? { callsign: driverCallsign, name: driverName }
      : null,
    driverPosition: driverPos
      ? { lat: driverPos.lat, lng: driverPos.lng }
      : null,
    driverPositionAt: driverPos ? driverPos.at.toISOString() : null,
    refusedAt: refusedAt ? refusedAt.toISOString() : null,
    deltaSeconds,
    distanceKm,
    outcome: {
      completedAt: booking.completedAt?.toISOString() ?? null,
      noFareAt: booking.noFareAt?.toISOString() ?? null,
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    },
  };
}

/**
 * Toate refuzurile unui șofer (pe callsign), corelate cu poziția la refuz + pickup.
 */
export async function getDriverRefusals(
  callsign: string,
): Promise<RefusalDetail[]> {
  const driver = await prisma.driver.findFirst({
    where: { callsign },
    select: { id: true },
  });

  if (!driver) {
    return [];
  }

  // Toate booking-urile din al caror timeline apare un refuz, ordonat desc
  const bookings = (await prisma.$queryRaw`
    SELECT DISTINCT b.id AS id
    FROM "Booking" b
    JOIN "BookingTimelineEvent" t ON t."bookingId" = b.id
    JOIN "BookingTimelineEvent" d ON d."bookingId" = b.id AND d."eventType" = 'BookingDispatched'
    WHERE b.status = 'REJECTED'
      AND d.metadata->'DriverDetails'->'Driver'->>'Callsign' = ${callsign}
      AND t."eventType" = 'BookingRejected'
    ORDER BY b."createdAt" DESC
  `) as Array<{ id: string }>;

  const details: RefusalDetail[] = [];

  for (const b of bookings) {
    const detail = await getRefusalDetail(b.id);
    if (detail) {
      details.push(detail);
    }
  }

  return details.filter((d) => d.driver?.callsign === callsign);
}
