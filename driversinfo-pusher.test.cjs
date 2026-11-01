const test = require('node:test');
const assert = require('node:assert/strict');
const { getClearDrivers, createPusher, ENDPOINTS } = require('./driversinfo-pusher');
test('uses the verified receiver routes', () => assert.deepEqual(ENDPOINTS, ['https://api.plymhub.app/api/webhook/drivers', 'https://testapi.plymhub.app/api/webhook/drivers']));

test('driversInfo queries canonical state, not a historical Clear snapshot', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Driver"(id text,"externalId" text,callsign text,forename text,surname text);
      CREATE TABLE "Vehicle"(id text,provider text,"externalId" text,"currentDriverId" text,"currentStatus" text,"currentBookingId" int,"lastSeenAt" timestamptz,"isActive" boolean,"isSuspended" boolean,"currentLatitude" numeric,"currentLongitude" numeric);
      CREATE TABLE "DriverShift"(id text,provider text,"driverId" text,"vehicleId" text,status text,"startedAt" timestamptz,"endedAt" timestamptz,"modifiedAt" timestamptz);
      CREATE TABLE "Booking"(id text,provider text,"externalId" text,"driverId" text,"vehicleId" text,status text,"dispatchedAt" timestamptz,"acceptedAt" timestamptz,"arrivedAt" timestamptz,"pickedUpAt" timestamptz,"completedAt" timestamptz,"cancelledAt" timestamptz,"noFareAt" timestamptz);
      INSERT INTO "Driver" VALUES('driver','101','62','Test','Driver');
      INSERT INTO "Vehicle" VALUES('vehicle','AUTOCAB','201','driver','Clear',NULL,now(),true,false,50.37,-4.14);
    `);
    assert.equal((await getClearDrivers(db)).length, 0, 'no shift means no available car');
    await db.exec(`INSERT INTO "DriverShift" VALUES('shift','AUTOCAB','driver','vehicle','ACTIVE',now()-interval '1 hour',NULL,NULL)`);
    let rows = await getClearDrivers(db);
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]), ['callsign','name','status','lat','lng','driverId','carId','updatedAt']);
    assert.equal(rows[0].driverId, '101'); assert.equal(rows[0].carId, '201'); assert.equal(rows[0].status, 'CLEAR');
    await db.exec(`INSERT INTO "Booking"(id,provider,"externalId","driverId","vehicleId",status,"dispatchedAt") VALUES('booking','AUTOCAB','301','101','201','ACCEPTED',now()-interval '5 minutes'); UPDATE "Vehicle" SET "currentBookingId"=301`);
    assert.equal((await getClearDrivers(db)).length, 0, 'assigned job overrides Clear GPS');
    await db.exec(`UPDATE "Booking" SET status='POB',"pickedUpAt"=now()-interval '3 minutes'`);
    assert.equal((await getClearDrivers(db)).length, 0);
    await db.exec(`UPDATE "Booking" SET status='COMPLETED',"completedAt"=now()-interval '1 minute'`);
    assert.equal((await getClearDrivers(db)).length, 1);
    await db.exec(`UPDATE "DriverShift" SET status='ENDED',"endedAt"=now(); UPDATE "Vehicle" SET "lastSeenAt"=now()`);
    assert.equal((await getClearDrivers(db)).length, 0, 'logout wins over late GPS/completion');
    await db.exec(`UPDATE "DriverShift" SET status='ACTIVE',"endedAt"=NULL; UPDATE "Vehicle" SET "lastSeenAt"=now()-interval '3 minutes'`);
    assert.equal((await getClearDrivers(db)).length, 0, 'stale position is not pushed');
    await db.exec(`UPDATE "Vehicle" SET "lastSeenAt"=now(); UPDATE "Driver" SET callsign='926'`);
    assert.equal((await getClearDrivers(db)).length, 0, 'existing excluded callsign remains excluded');
  } finally { await db.close(); }
});

const logger = { log() {}, error() {} };
test('both endpoints receive byte-identical snapshots, including an authoritative empty list', async () => {
  const calls = [];
  const send = createPusher({ client: { query: async () => ({ rows: [] }) }, logger,
    now: () => new Date('2026-11-01T12:00:00Z'),
    fetchImpl: async (url, options) => { calls.push({ url, body: options.body }); return new Response('OK'); },
  });
  const outcomes = await send();
  assert.deepEqual(calls.map(call => call.url), ENDPOINTS);
  assert.equal(calls[0].body, calls[1].body);
  assert.deepEqual(JSON.parse(calls[0].body), { generatedAt: '2026-11-01T12:00:00.000Z', count: 0, drivers: [] });
  assert.equal(outcomes.every(result => result.ok), true);
});
test('failure at the first receiver does not suppress the second receiver', async () => {
  const calls = [];
  const send = createPusher({ client: { query: async () => ({ rows: [] }) }, logger,
    fetchImpl: async url => { calls.push(url); if (calls.length === 1) throw Error('network'); return new Response('OK'); },
  });
  const outcomes = await send();
  assert.deepEqual(calls, ENDPOINTS);
  assert.equal(outcomes[0].ok, false); assert.equal(outcomes[1].ok, true);
});
test('a failed database query sends no misleading empty list', async () => {
  let sent = 0;
  const send = createPusher({ client: { query: async () => { throw Error('database'); } }, logger,
    fetchImpl: async () => { sent++; return new Response('OK'); },
  });
  await send(); assert.equal(sent, 0);
});
test('timer overlap cannot send an older snapshot after a newer one', async () => {
  let release, queries = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const send = createPusher({ client: { query: async () => { queries++; await gate; return { rows: [] }; } }, logger,
    fetchImpl: async () => new Response('OK'),
  });
  const first = send();
  await send();
  release(); await first;
  assert.equal(queries, 1);
});
