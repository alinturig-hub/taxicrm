require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.DATABASE_URL });

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function findPos(did, t) {
  const W = [[5*60,5*60],[15*60,15*60],[30*60,30*60],[60*60,60*60]];
  for (const [b,a] of W) {
    const before = new Date(t.getTime()-b*1000).toISOString();
    const after = new Date(t.getTime()+a*1000).toISOString();
    const r = await client.query(`
      SELECT latitude, longitude FROM "VehicleSnapshot"
      WHERE "driverId"=$1 AND latitude IS NOT NULL AND "snapshotAt" BETWEEN $2 AND $3
      ORDER BY ABS(EXTRACT(EPOCH FROM ("snapshotAt"-$4::timestamp))) LIMIT 1`,
      [did,before,after,t.toISOString()]);
    if (r.rows.length) return r.rows[0];
  }
  return null;
}

client.connect().then(async () => {
  const rej = await client.query(`
    WITH rej AS (
      SELECT "bookingId", metadata->>'Id' as autocab_id, "occurredAt" as t,
             metadata->'Pickup'->'Coordinates'->>'Latitude' as plat,
             metadata->'Pickup'->'Coordinates'->>'Longitude' as plng
      FROM "BookingTimelineEvent" WHERE "eventType"='BookingRejected'
    )
    SELECT r."bookingId", r.autocab_id, r.t, r.plat, r.plng, d.callsign
    FROM rej r
    LEFT JOIN LATERAL (
      SELECT metadata->'DriverDetails'->'Driver'->>'Callsign' as callsign
      FROM "BookingTimelineEvent" t
      WHERE t."bookingId"=r."bookingId" AND t."eventType"='BookingDispatched'
        AND t."occurredAt"<=r.t
        AND t.metadata->'DriverDetails'->'Driver'->>'Callsign' IS NOT NULL
      ORDER BY t."occurredAt" DESC LIMIT 1
    ) d ON true
    WHERE r.plat IS NOT NULL AND r.plng IS NOT NULL
  `);

  const cache = {};
  const out = [];
  for (const r of rej.rows) {
    const cs = r.callsign;
    if (!cs || !r.t) continue;
    if (!(cs in cache)) {
      const dr = await client.query('SELECT id, forename, surname FROM "Driver" WHERE callsign=$1',[cs]);
      cache[cs] = dr.rows[0] || null;
    }
    const d = cache[cs];
    if (!d) continue;
    const pos = await findPos(d.id, new Date(r.t));
    if (!pos) continue;
    const pl = { lat: parseFloat(r.plat), lng: parseFloat(r.plng) };
    const dist = haversine(pl.lat, pl.lng, parseFloat(pos.latitude), parseFloat(pos.longitude));
    out.push({
      callsign: cs, name: d.forename + ' ' + d.surname,
      booking: r.autocab_id, time: new Date(r.t).toISOString(),
      driverLat: parseFloat(pos.latitude), driverLng: parseFloat(pos.longitude),
      pickupLat: pl.lat, pickupLng: pl.lng, distKm: Math.round(dist*100)/100
    });
  }

  // subset relevant: cele cu distanta cea mai relevanta pt vizual (ex >0.2km sa faca liniile vizibile) dar variat
  out.sort((a,b)=>b.distKm-a.distKm);
  const diverse = [];
  // ia cele mai departe (extreme)
  const far = out.filter(o=>o.distKm>=1.5).slice(0,40);
  // ia si ceva apropiate
  const near = out.filter(o=>o.distKm<1.5).slice(0,15);
  const picked = [...far, ...near];
  fs.writeFileSync('/workspace/projects/map-data.json', JSON.stringify(picked, null, 2));
  console.log('Exportat', picked.length, 'refuzuri (din', out.length, 'corelate)');
  console.log('Distante: min', Math.min(...picked.map(o=>o.distKm)), 'km, max', Math.max(...picked.map(o=>o.distKm)), 'km');
  await client.end();
}).catch(e=>{console.error(e);process.exit(1);});
