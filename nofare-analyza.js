require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  // === 1. NO_FARE pe interval orar ===
  const byHour = await client.query(`
    SELECT EXTRACT(HOUR FROM "pickupDueTime")::int as ora,
           COUNT(*) as nr
    FROM "Booking"
    WHERE status = 'NO_FARE'
    GROUP BY ora ORDER BY ora
  `);
  console.log('=== NO_FARE pe ora (pickupDueTime) ===');
  console.log('ora | nr');
  byHour.rows.forEach(r => console.log(String(r.ora).padStart(3) + ' | ' + r.nr));

  // === 2. NO_FARE pe zi a saptamanii ===
  const byDow = await client.query(`
    SELECT EXTRACT(DOW FROM "pickupDueTime")::int as zi,
           COUNT(*) as nr
    FROM "Booking"
    WHERE status = 'NO_FARE'
    GROUP BY zi ORDER BY zi
  `);
  console.log('\n=== NO_FARE pe zi (0=Duminica) ===');
  const zile = ['Dum','Lun','Mar','Mie','Joi','Vin','Sam'];
  byDow.rows.forEach(r => console.log(zile[r.zi] + ' | ' + r.nr));

  // === 3. NO_FARE pe tip booking (ASAP vs pre-booked) ===
  const byType = await client.query(`
    SELECT "typeOfBooking", COUNT(*) as nr
    FROM "Booking" WHERE status = 'NO_FARE'
    GROUP BY "typeOfBooking" ORDER BY nr DESC
  `);
  console.log('\n=== NO_FARE pe typeOfBooking ===');
  byType.rows.forEach(r => console.log((r.typeOfBooking || 'NULL').padEnd(15) + ' | ' + r.nr));

  // === 4. NO_FARE: lead time (cat timp inainte s-a facut booking-ul fata de pickup) ===
  const lead = await client.query(`
    SELECT
      CASE
        WHEN "bookedAtTime" IS NULL OR "pickupDueTime" IS NULL THEN 'fara timpi'
        WHEN EXTRACT(EPOCH FROM ("pickupDueTime" - "bookedAtTime")) < 600 THEN 'ASAP (<10min)'
        WHEN EXTRACT(EPOCH FROM ("pickupDueTime" - "bookedAtTime")) < 3600 THEN '10min-1h'
        WHEN EXTRACT(EPOCH FROM ("pickupDueTime" - "bookedAtTime")) < 10800 THEN '1-3h'
        WHEN EXTRACT(EPOCH FROM ("pickupDueTime" - "bookedAtTime")) < 86400 THEN '3-24h'
        ELSE '>24h'
      END as leadtime,
      COUNT(*) as nr
    FROM "Booking" WHERE status = 'NO_FARE'
    GROUP BY leadtime ORDER BY nr DESC
  `);
  console.log('\n=== NO_FARE pe lead time ===');
  lead.rows.forEach(r => console.log(r.leadtime.padEnd(18) + ' | ' + r.nr));

  // === 5. NO_FARE: distributie globala vs total pe fiecare dimensiune (rata) ===
  // rata no-fare pe zona
  const zoneRate = await client.query(`
    WITH allb AS (
      SELECT bl."zoneName" as "zname", b.status FROM "Booking" b
      JOIN "BookingLocation" bl ON bl."bookingId" = b.id AND bl.type = 'PICKUP'
    )
    SELECT "zname" as "zone",
           COUNT(*) FILTER (WHERE status = 'NO_FARE') as nofare,
           COUNT(*) as total,
           ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'NO_FARE') / NULLIF(COUNT(*),0), 2) as pct
    FROM allb GROUP BY "zname"
    HAVING COUNT(*) >= 20
    ORDER BY pct DESC
    LIMIT 20
  `);
  console.log('\n=== Zone cu CEA MAI MARE RATA de no-fare (peste 20 booking-uri) ===');
  console.log('zona | nofare | total | %');
  zoneRate.rows.forEach(r => console.log(r.zone.padEnd(20) + ' | ' + String(r.nofare).padStart(5) + ' | ' + String(r.total).padStart(6) + ' | ' + r.pct + '%'));

  // === 6. NO_FARE pe cont ===
  const byAcct = await client.query(`
    SELECT
      COALESCE(NULLIF("accountName",''), 'CASH/PRIVAT') as cont,
      COUNT(*) as nofare
    FROM "Booking" WHERE status = 'NO_FARE'
    GROUP BY cont ORDER BY nofare DESC LIMIT 15
  `);
  console.log('\n=== NO_FARE pe cont ===');
  byAcct.rows.forEach(r => console.log(r.cont.padEnd(35) + ' | ' + r.nofare));

  // === 7. Numarul de no-fare in timp (pe zi) ===
  const byDay = await client.query(`
    SELECT "pickupDueTime"::date as zi, COUNT(*) as nr
    FROM "Booking" WHERE status = 'NO_FARE' AND "pickupDueTime" IS NOT NULL
    GROUP BY zi ORDER BY zi
  `);
  console.log('\n=== NO_FARE pe zi (ultimele 20) ===');
  byDay.rows.slice(-20).forEach(r => console.log(String(r.zi).slice(0,10) + ' | ' + r.nr));

  // === 8. Lead zone comune: ce customeri/numere revin cu no-fare? ===
  const repeatCust = await client.query(`
    SELECT "telephoneNumber", "customerName", COUNT(*) as nr
    FROM "Booking" WHERE status = 'NO_FARE' AND "telephoneNumber" IS NOT NULL AND "telephoneNumber" != ''
    GROUP BY "telephoneNumber", "customerName"
    HAVING COUNT(*) >= 3
    ORDER BY nr DESC LIMIT 15
  `);
  console.log('\n=== Clienti cu cele mai multe no-fare (>=3) ===');
  repeatCust.rows.forEach(r => console.log((r.telephoneNumber || '?').padEnd(16) + ' | ' + (r.customerName || '?').padEnd(20) + ' | ' + r.nr));

  // === 9. No-fare rate vs total pe tip de booking ===
  const typeRate = await client.query(`
    SELECT "typeOfBooking",
           COUNT(*) FILTER (WHERE status='NO_FARE') as nofare,
           COUNT(*) as total,
           ROUND(100.0 * COUNT(*) FILTER (WHERE status='NO_FARE') / NULLIF(COUNT(*),0), 2) as pct
    FROM "Booking" GROUP BY "typeOfBooking" ORDER BY pct DESC
  `);
  console.log('\n=== Rata no-fare pe typeOfBooking (global) ===');
  typeRate.rows.forEach(r => console.log((r.typeOfBooking || 'NULL').padEnd(15) + ' | nofare:' + String(r.nofare).padStart(5) + ' | total:' + String(r.total).padStart(7) + ' | ' + r.pct + '%'));

  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
