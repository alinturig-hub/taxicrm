require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  const r = await client.query(`
    WITH latest AS (
      SELECT DISTINCT ON (vs."driverId")
        vs."driverId", vs.latitude, vs.longitude, vs."snapshotAt", vs."vehicleStatus"
      FROM "VehicleSnapshot" vs
      JOIN "Driver" d ON d.id = vs."driverId"
      WHERE vs."snapshotAt" > NOW() - INTERVAL '4 minutes'
        AND vs.latitude IS NOT NULL
        AND d.callsign != '926'
        AND d.active = true
      ORDER BY vs."driverId", vs."snapshotAt" DESC
    )
    SELECT l."driverId", d.callsign, d.forename, d.surname,
           l.latitude, l.longitude, l."snapshotAt", l."vehicleStatus"
    FROM latest l JOIN "Driver" d ON d.id = l."driverId"
    ORDER BY d.callsign
  `);
  const soferi = r.rows.map(s => ({
    callsign: s.callsign,
    name: (s.forename + ' ' + s.surname).trim(),
    lat: s.latitude, lng: s.longitude,
    status: s.vehicleStatus || 'unknown',
    time: new Date(s.snapshotAt).toISOString()
  }));
  const js = 'window.MAP_DATA = ' + JSON.stringify(soferi) + ';\n';
  fs.writeFileSync('/workspace/projects/live-data.js', js);
  console.log('Exportat', soferi.length, 'soferi live in live-data.js');
  const busy = soferi.filter(s=>s.status.startsWith('Busy')).length;
  console.log('Liberi:', soferi.length-busy, '· Ocupati:', busy);
  await client.end();
}).catch(e=>{console.error(e);process.exit(1);});
