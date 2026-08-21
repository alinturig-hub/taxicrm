require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  // === 1. Pierderea de revenue din no-fare ===
  const loss = await client.query(`
    SELECT
      COUNT(*) as nr_nofare,
      ROUND(SUM(COALESCE(price,0))) as suma_price,
      ROUND(SUM(COALESCE(cost,0))) as suma_cost,
      ROUND(AVG(COALESCE(price,0)),2) as avg_price
    FROM "Booking" WHERE status = 'NO_FARE'
  `);
  console.log('=== Pierdere estimata din no-fare ===');
  console.log(loss.rows[0]);

  // === 2. Cost mediu per job COMPLETAT (referinta) ===
  const ref = await client.query(`
    SELECT ROUND(AVG(COALESCE(price,0)),2) as avg_price_completat,
           COUNT(*) as nr_completate
    FROM "Booking" WHERE status = 'COMPLETED'
  `);
  console.log('\nReferinta COMPLETED:', ref.rows[0]);
  console.log('=> Pierdere totala estimata prin no-fare (daca ar fi fost completate):',
    (parseFloat(loss.rows[0].suma_price) ? '' : '') + (parseFloat(ref.rows[0].avg_price_completat) * parseInt(loss.rows[0].nr_nofare)).toFixed(0), 'GBP');

  // === 3. No-fare pe locatia EXACTA (top 20 adrese) ===
  const addr = await client.query(`
    SELECT bl."address", COUNT(*) as nr
    FROM "Booking" b
    JOIN "BookingLocation" bl ON bl."bookingId" = b.id AND bl.type='PICKUP'
    WHERE b.status = 'NO_FARE' AND bl."address" IS NOT NULL
    GROUP BY bl."address" ORDER BY nr DESC LIMIT 20
  `);
  console.log('\n=== NO_FARE pe adresa exacta (top 20) ===');
  addr.rows.forEach(r => console.log(String(r.nr).padStart(4) + ' | ' + r.address.slice(0,70)));

  // === 4. Laira Depot: cine comanda, ce tip ===
  const laira = await client.query(`
    SELECT b."customerName", b."typeOfBooking", b."bookingSource",
           COUNT(*) as nr
    FROM "Booking" b
    JOIN "BookingLocation" bl ON bl."bookingId" = b.id AND bl.type='PICKUP'
    WHERE b.status = 'NO_FARE' AND bl."address" ILIKE '%Laira%'
    GROUP BY b."customerName", b."typeOfBooking", b."bookingSource"
    ORDER BY nr DESC LIMIT 15
  `);
  console.log('\n=== Laira Depot NO_FARE: cine/tip/sursa ===');
  laira.rows.forEach(r => console.log((r.customerName||'?').padEnd(25) + ' | ' + (r.typeOfBooking||'?').padEnd(10) + ' | ' + (r.bookingSource||'?').padEnd(15) + ' | ' + r.nr));

  // === 5. Station no-fare: ora (vârf garni tren) ===
  const stat = await client.query(`
    SELECT EXTRACT(HOUR FROM b."pickupDueTime")::int as ora, COUNT(*) as nr
    FROM "Booking" b
    JOIN "BookingLocation" bl ON bl."bookingId" = b.id AND bl.type='PICKUP'
    WHERE b.status = 'NO_FARE' AND bl."zoneName" = 'Station'
    GROUP BY ora ORDER BY nr DESC LIMIT 8
  `);
  console.log('\n=== Station NO_FARE pe ora (top) ===');
  stat.rows.forEach(r => console.log('ora ' + String(r.ora).padStart(2) + 'h | ' + r.nr));

  // === 6. Numar soferi implicati in deplasari fara plata: distanta medie pickup pt nofare ===
  const distNofare = await client.query(`
    SELECT ROUND(AVG(COALESCE(distance,0)),2) as avg_km,
           ROUND(AVG(COALESCE("systemDistance",0)),2) as avg_sys_km
    FROM "Booking" WHERE status = 'NO_FARE'
  `);
  console.log('\n=== Distanta medie job no-fare ===');
  console.log(distNofare.rows[0], 'km');

  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
