require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Extragem refuzurile impreuna cu refuzantul (din dispatch-ul anterior)
async function loadRejections(client) {
  const res = await client.query(`
    WITH rej AS (
      SELECT "bookingId", metadata->>'Id' as autocab_id, "occurredAt" as refuz_timp,
             metadata->'Pickup'->'Coordinates'->>'Latitude' as plat,
             metadata->'Pickup'->'Coordinates'->>'Longitude' as plng
      FROM "BookingTimelineEvent"
      WHERE "eventType" = 'BookingRejected'
    )
    SELECT r."bookingId", r.autocab_id, r.refuz_timp, r.plat, r.plng,
           d.callsign as refuzant_callsign
    FROM rej r
    LEFT JOIN LATERAL (
      SELECT metadata->'DriverDetails'->'Driver'->>'Callsign' as callsign
      FROM "BookingTimelineEvent" t
      WHERE t."bookingId" = r."bookingId"
        AND t."eventType" = 'BookingDispatched'
        AND t."occurredAt" <= r.refuz_timp
        AND t.metadata->'DriverDetails'->'Driver'->>'Callsign' IS NOT NULL
      ORDER BY t."occurredAt" DESC
      LIMIT 1
    ) d ON true
    WHERE r.plat IS NOT NULL AND r.plng IS NOT NULL
  `);
  return res.rows;
}

// Gaseste pozitia driverului cel mai apropiata de targetTime
async function findDriverPosition(client, driverInternalId, targetTime) {
  const WINDOWS = [
    { before: 5 * 60, after: 5 * 60 },
    { before: 15 * 60, after: 15 * 60 },
    { before: 30 * 60, after: 30 * 60 },
    { before: 60 * 60, after: 60 * 60 },
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
  console.log('=== Corelare refuzuri: distanta sofer-pickup (metoda corecta) ===\n');

  const rejections = await loadRejections(client);
  console.log(`Total refuzuri cu coordonate pickup: ${rejections.length}`);
  const cuRefuzant = rejections.filter(r => r.refuzant_callsign);
  console.log(`Cu refuzant detectat: ${cuRefuzant.length}\n`);

  // Map callsign -> driver internal id
  const callsignCache = {};
  const results = [];

  for (const r of cuRefuzant) {
    const callsign = r.refuzant_callsign;
    if (!(callsign in callsignCache)) {
      const dr = await client.query(`SELECT id FROM "Driver" WHERE callsign = $1`, [callsign]);
      callsignCache[callsign] = dr.rows.length > 0 ? dr.rows[0].id : null;
    }
    const driverInternalId = callsignCache[callsign];
    if (!driverInternalId || !r.refuz_timp) continue;

    const pos = await findDriverPosition(client, driverInternalId, new Date(r.refuz_timp));
    if (!pos) continue;

    const dist = haversine(parseFloat(r.plat), parseFloat(r.plng), pos.lat, pos.lng);

    // Numele driverului
    const drInfo = await client.query(
      `SELECT forename, surname FROM "Driver" WHERE id = $1`, [driverInternalId]
    );

    results.push({
      bookingId: r.bookingId,
      autocabId: r.autocab_id,
      callsign: callsign,
      name: drInfo.rows[0] ? drInfo.rows[0].forename + ' ' + drInfo.rows[0].surname : '',
      distKm: dist,
      refuzTimp: r.refuz_timp,
      posTimp: pos.at,
      deltaSec: Math.abs((new Date(r.refuz_timp) - new Date(pos.at)) / 1000)
    });
  }

  console.log(`Corelate cu pozitie GPS: ${results.length}`);
  console.log(`(restul nu au snapshot GPS in fereastra +/- 60 min la momentul refuzului)\n`);

  // Sort desc
  results.sort((a, b) => b.distKm - a.distKm);

  console.log('=== TOP 25: soferi care au refuzat fiind CEI MAI DEPARTE de pickup ===');
  console.log('callsign | nume | distanta(km) | delta(s) | AutocabID');
  console.log('-'.repeat(90));
  for (const r of results.slice(0, 25)) {
    console.log(`${r.callsign.padEnd(8)} | ${(r.name || '?').padEnd(24)} | ${r.distKm.toFixed(2).padStart(8)} km | ${String(r.deltaSec.toFixed(0)).padStart(8)} | ${r.autocabId}`);
  }

  console.log('\n=== TOP 25: soferi care au refuzat fiind CEI MAI APROAPE de pickup ===');
  console.log('callsign | nume | distanta(km) | delta(s) | AutocabID');
  console.log('-'.repeat(90));
  const sortedAsc = [...results].sort((a, b) => a.distKm - b.distKm);
  for (const r of sortedAsc.slice(0, 25)) {
    console.log(`${r.callsign.padEnd(8)} | ${(r.name || '?').padEnd(24)} | ${r.distKm.toFixed(2).padStart(8)} km | ${String(r.deltaSec.toFixed(0)).padStart(8)} | ${r.autocabId}`);
  }

  // Statistici per sofer
  console.log('\n=== Statistici per sofer (doar cei cu >=3 refuzuri corelate GPS) ===');
  const byDriver = {};
  for (const r of results) {
    if (!byDriver[r.callsign]) byDriver[r.callsign] = { name: r.name, count: 0, distances: [] };
    byDriver[r.callsign].count++;
    byDriver[r.callsign].distances.push(r.distKm);
  }
  const driverStats = Object.entries(byDriver)
    .map(([cs, d]) => ({
      callsign: cs,
      name: d.name,
      count: d.count,
      avgDist: d.distances.reduce((s, x) => s + x, 0) / d.distances.length,
      maxDist: Math.max(...d.distances),
      minDist: Math.min(...d.distances)
    }))
    .filter(d => d.count >= 3)
    .sort((a, b) => b.avgDist - a.avgDist);

  console.log('callsign | nume | refuzuri | dist_medie | dist_max | dist_min');
  console.log('-'.repeat(80));
  for (const d of driverStats) {
    console.log(`${d.callsign.padEnd(8)} | ${(d.name || '?').padEnd(24)} | ${String(d.count).padStart(5)} | ${d.avgDist.toFixed(2).padStart(8)} km | ${d.maxDist.toFixed(2).padStart(8)} km | ${d.minDist.toFixed(2).padStart(8)} km`);
  }

  // Overall stats
  console.log('\n=== Statistici generale ===');
  const allDist = results.map(r => r.distKm);
  console.log(`Refuzuri corelate: ${results.length}`);
  console.log(`Distanta medie: ${(allDist.reduce((s,x)=>s+x,0)/allDist.length).toFixed(2)} km`);
  console.log(`Distanta mediana: ${allDist.sort((a,b)=>a-b)[Math.floor(allDist.length/2)].toFixed(2)} km`);
  console.log(`Refuzuri la <1km de pickup: ${allDist.filter(d=>d<1).length}`);
  console.log(`Refuzuri 1-3km: ${allDist.filter(d=>d>=1&&d<3).length}`);
  console.log(`Refuzuri 3-5km: ${allDist.filter(d=>d>=3&&d<5).length}`);
  console.log(`Refuzuri >5km: ${allDist.filter(d=>d>=5).length}`);

  await client.end();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
