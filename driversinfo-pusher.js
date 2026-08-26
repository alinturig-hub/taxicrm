require('dotenv').config({ path: '/workspace/projects/taxicrm/.env' });
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL;
const EXCLUDED_CALLSIGN = '926';
const WINDOW_SECS = 2 * 60;
const INTERVAL_MS = 10000;
const ENDPOINTS = [
  'https://api.plymhub.app/api/webhook/driversInfo',
  'https://testapi.plymhub.app/api/webhook/driversInfo',
];

const client = new Client({ connectionString: DB_URL });

async function getClearDrivers() {
  const res = await client.query(`
    SELECT DISTINCT ON (vs."driverId")
      d.callsign, d."fullName" as name, vs."vehicleStatus" as status,
      vs.latitude, vs.longitude, d."externalId" as driver_id,
      veh."externalId" as car_id, vs."snapshotAt" as "updatedAt"
    FROM "VehicleSnapshot" vs
    LEFT JOIN "Driver" d ON d.id = vs."driverId"
    LEFT JOIN "Vehicle" veh ON veh.id = vs."vehicleId"
    WHERE vs."snapshotAt" >= now() - make_interval(secs => $1)
      AND d.callsign IS NOT NULL AND d.callsign <> '926'
      AND vs.latitude IS NOT NULL AND vs.longitude IS NOT NULL
      AND vs."vehicleStatus" = 'Clear'
    ORDER BY vs."driverId", vs."snapshotAt" DESC
  `, [WINDOW_SECS]);

  return res.rows
    .filter(r => r.callsign && r.callsign !== EXCLUDED_CALLSIGN)
    .filter(r => r.latitude && r.longitude)
    .filter(r => String(r.status || '').toLowerCase() === 'clear')   // only CLEAR
    .map(r => ({
      callsign: r.callsign,
      name: r.name || '',
      status: String(r.status || '').toUpperCase(),
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      driverId: String(r.driver_id || ''),
      carId: String(r.car_id || ''),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    }));
}

let sentOnceLogged = false;
async function sendOnce() {
  let drivers;
  try { drivers = await getClearDrivers(); }
  catch (e) { console.error(new Date().toISOString(), 'DB query failed:', e.message); return; }

  const payload = { generatedAt: new Date().toISOString(), count: drivers.length, drivers };
  if (!sentOnceLogged) {
    console.log('=== SAMPLE PAYLOAD ===');
    console.log(JSON.stringify(payload, null, 2));
    sentOnceLogged = true;
  }
  for (const ep of ENDPOINTS) {
    try {
      const resp = await fetch(ep, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
      });
      const body = await resp.text();
      console.log(new Date().toISOString(), 'POST', resp.status, ep, 'count=' + drivers.length, '->', body.slice(0, 200));
    } catch (e) {
      console.error(new Date().toISOString(), 'POST failed', ep, '->', e.message);
    }
  }
}

client.connect().then(async () => {
  console.log('=== driversInfo pusher started ===');
  console.log('Endpoints:', ENDPOINTS.join(' | '));
  console.log('Interval:', INTERVAL_MS / 1000, 's | only CLEAR | fields: callsign, name, status, lat, lng, driverId(Autocab), carId(Autocab), updatedAt');
  await sendOnce();
  setInterval(sendOnce, INTERVAL_MS);
}).catch(e => { console.error('DB connect fail:', e.message); process.exit(1); });
