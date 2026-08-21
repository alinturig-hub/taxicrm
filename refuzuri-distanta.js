require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find closest snapshot for a driver around a timestamp
// Strategy: query snapshots within +/- 5 min window, pick closest by time
// If too few, expand window
async function findDriverPosition(client, driverInternalId, targetTime) {
  const WINDOWS = [
    { before: 5 * 60, after: 5 * 60 },    // +/- 5 min
    { before: 15 * 60, after: 15 * 60 },  // +/- 15 min
    { before: 30 * 60, after: 30 * 60 },  // +/- 30 min
    { before: 60 * 60, after: 60 * 60 },  // +/- 60 min
  ];

  for (const win of WINDOWS) {
    const before = new Date(targetTime.getTime() - win.before * 1000);
    const after = new Date(targetTime.getTime() + win.after * 1000);
    const res = await client.query(`
      SELECT latitude, longitude, "snapshotAt"
      FROM "VehicleSnapshot"
      WHERE "driverId" = $1
        AND latitude IS NOT NULL
        AND "snapshotAt" BETWEEN $2 AND $3
      ORDER BY ABS(EXTRACT(EPOCH FROM ("snapshotAt" - $4::timestamp)))
      LIMIT 1
    `, [driverInternalId, before.toISOString(), after.toISOString(), targetTime.toISOString()]);
    if (res.rows.length > 0) {
      return { lat: parseFloat(res.rows[0].latitude), lng: parseFloat(res.rows[0].longitude), at: res.rows[0].snapshotAt };
    }
  }
  return null;
}

client.connect().then(async () => {
  console.log('=== Corelare refuzuri cu distanta sofer-pickup ===\n');

  // Ia toate booking-urile REJECTED cu driverId, pickup location si timestamp refuz
  const bookings = await client.query(`
    SELECT 
      b.id,
      b."driverCallSign",
      b."driverId" as callsign_driver,
      bl.latitude as pickup_lat,
      bl.longitude as pickup_lng,
      t."occurredAt" as refuz_timp
    FROM "Booking" b
    JOIN "BookingLocation" bl ON bl."bookingId" = b.id AND bl.type = 'PICKUP'
    LEFT JOIN "BookingTimelineEvent" t ON t."bookingId" = b.id AND t."eventType" = 'BookingRejected'
    WHERE b.status = 'REJECTED'
      AND b."driverId" IS NOT NULL
      AND bl.latitude IS NOT NULL
      AND bl.longitude IS NOT NULL
  `);

  console.log(`Total bookari REJECTED corelabile: ${bookings.rows.length}\n`);

  // Cache: map callsign -> driver internal id
  const callsignCache = {};
  const results = [];

  for (const b of bookings.rows) {
    const callsign = b.callsign_driver;

    // Map callsign to driver internal id (cache)
    if (!(callsign in callsignCache)) {
      const dr = await client.query(`SELECT id FROM "Driver" WHERE callsign = $1`, [callsign]);
      callsignCache[callsign] = dr.rows.length > 0 ? dr.rows[0].id : null;
    }
    const driverInternalId = callsignCache[callsign];
    if (!driverInternalId || !b.refuz_timp) continue;

    const pos = await findDriverPosition(client, driverInternalId, new Date(b.refuz_timp));
    if (!pos) continue;

    const dist = haversine(b.pickup_lat, b.pickup_lng, pos.lat, pos.lng);

    results.push({
      bookingId: b.id,
      callsign: callsign,
      pickup: { lat: parseFloat(b.pickup_lat), lng: parseFloat(b.pickup_lng) },
      driverPos: { lat: pos.lat, lng: pos.lng },
      distKm: dist,
      refuzTimp: b.refuz_timp,
      posTimp: pos.at,
      deltaSec: Math.abs((new Date(b.refuz_timp) - new Date(pos.at)) / 1000)
    });
  }

  // Sort by distance descending
  results.sort((a, b) => b.distKm - a.distKm);

  console.log(`Corelate cu pozitie sofer: ${results.length}`);
  console.log(`Nu am gasit pozitie: ${bookings.rows.length - results.length}\n`);

  // Top 20 departe
  console.log('=== Top 20 soferi CEI MAI DEPARTE de pickup ===');
  console.log('=== (au refuzat desi nu erau aproape) ===');
  console.log('callsign | distanta(km) | delta_timp(sec) | bookingId');
  console.log('-'.repeat(80));
  for (const r of results.slice(0, 20)) {
    console.log(`${r.callsign.padEnd(10)} | ${r.distKm.toFixed(2).padStart(8)} km | ${r.deltaSec.toFixed(0).padStart(12)} s | ${r.bookingId}`);
  }

  console.log('\n=== Top 20 cei MAI APROAPE ===');
  console.log('callsign | distanta(km) | delta_timp(sec) | bookingId');
  console.log('-'.repeat(80));
  const sortedAsc = [...results].sort((a, b) => a.distKm - b.distKm);
  for (const r of sortedAsc.slice(0, 20)) {
    console.log(`${r.callsign.padEnd(10)} | ${r.distKm.toFixed(2).padStart(8)} km | ${r.deltaSec.toFixed(0).padStart(12)} s | ${r.bookingId}`);
  }

  // Statistici per sofer: refuzuri corelate, distanta medie/max
  console.log('\n=== Statistici per sofer (refuzuri corelate cu pozitie GPS) ===');
  const byDriver = {};
  for (const r of results) {
    if (!byDriver[r.callsign]) byDriver[r.callsign] = { count: 0, distances: [] };
    byDriver[r.callsign].count++;
    byDriver[r.callsign].distances.push(r.distKm);
  }
  const driverStats = Object.entries(byDriver)
    .map(([cs, d]) => ({
      callsign: cs,
      count: d.count,
      avgDist: d.distances.reduce((s, x) => s + x, 0) / d.distances.length,
      maxDist: Math.max(...d.distances),
      minDist: Math.min(...d.distances)
    }))
    .filter(d => d.count >= 5)
    .sort((a, b) => b.avgDist - a.avgDist);

  console.log('callsign | refuzuri | dist_medie(km) | dist_max(km) | dist_min(km)');
  console.log('-'.repeat(70));
  for (const d of driverStats) {
    console.log(`${d.callsign.padEnd(10)} | ${String(d.count).padStart(5)} | ${d.avgDist.toFixed(2).padStart(9)} | ${d.maxDist.toFixed(2).padStart(10)} | ${d.minDist.toFixed(2).padStart(10)}`);
  }

  await client.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
