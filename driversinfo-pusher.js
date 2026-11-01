const { Client } = require('pg');

const EXCLUDED_CALLSIGN = '926';
const WINDOW_SECS = 120;
const INTERVAL_MS = 10000;
const ENDPOINTS = [
  'https://api.plymhub.app/api/webhook/driversInfo',
  'https://testapi.plymhub.app/api/webhook/driversInfo',
];

async function getClearDrivers(client) {
  const { fleetLifecycleJoins, fleetLiveEligibility } = await import('./src/lib/fleet-lifecycle.mjs');
  const result = await client.query(`
    SELECT driver.callsign, concat_ws(' ',driver.forename,driver.surname) AS name,
      fleet_state.status, vehicle."currentLatitude" AS latitude, vehicle."currentLongitude" AS longitude,
      driver."externalId" AS driver_id, vehicle."externalId" AS car_id, vehicle."lastSeenAt" AS "updatedAt"
    FROM public."Vehicle" vehicle
    LEFT JOIN public."Driver" driver ON driver.id=vehicle."currentDriverId"
    ${fleetLifecycleJoins}
    WHERE vehicle.provider='AUTOCAB' AND ${fleetLiveEligibility}
      AND vehicle."lastSeenAt">=now()-make_interval(secs=>$1)
      AND fleet_state.status='Clear'
      AND driver.callsign IS NOT NULL AND driver.callsign<>$2
      AND vehicle."currentLatitude" BETWEEN -90 AND 90
      AND vehicle."currentLongitude" BETWEEN -180 AND 180
    ORDER BY vehicle."lastSeenAt" DESC,vehicle."externalId"
  `, [WINDOW_SECS, EXCLUDED_CALLSIGN]);
  return result.rows.filter(row => row.callsign && row.callsign !== EXCLUDED_CALLSIGN &&
    row.driver_id && row.car_id && row.latitude !== null && row.longitude !== null &&
    Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)) &&
    String(row.status).toLowerCase() === 'clear').map(row => ({
      callsign: row.callsign,
      name: row.name || '',
      status: 'CLEAR',
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      driverId: String(row.driver_id),
      carId: String(row.car_id),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
}

function createPusher({ client, fetchImpl = fetch, now = () => new Date(), logger = console }) {
  let running = false;
  return async function sendOnce() {
    if (running) return;
    running = true;
    try {
      // Query once and serialise once: both receivers get exactly the same snapshot.
      const drivers = await getClearDrivers(client);
      const payload = { generatedAt: now().toISOString(), count: drivers.length, drivers };
      const body = JSON.stringify(payload);
      const results = [];
      for (const endpoint of ENDPOINTS) {
        try {
          const response = await fetchImpl(endpoint, { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(15000) });
          // Consume the response without printing customer/driver data or arbitrary receiver content.
          await response.text();
          const outcome = { endpoint, status: response.status, ok: response.ok, count: drivers.length };
          results.push(outcome);
          logger[response.ok ? 'log' : 'error']('driversInfo delivery', outcome);
        } catch {
          const outcome = { endpoint, ok: false, count: drivers.length };
          results.push(outcome);
          logger.error('driversInfo delivery failed', outcome);
        }
      }
      return results;
    } catch {
      // Never send an empty snapshot merely because the database query failed.
      logger.error('driversInfo database read failed; no snapshot sent');
    } finally { running = false; }
  };
}

if (require.main === module) {
  require('dotenv').config();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.connect().then(async () => {
    const sendOnce = createPusher({ client });
    console.log('driversInfo pusher started: 10s, active shifts, recent CLEAR vehicles');
    await sendOnce();
    setInterval(() => void sendOnce(), INTERVAL_MS);
  }).catch(() => { console.error('driversInfo database connection failed'); process.exitCode = 1; });
}

module.exports = { getClearDrivers, createPusher, ENDPOINTS };
