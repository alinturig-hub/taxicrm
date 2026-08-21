require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  // === 1. Clasament NO-FARE pe zona: nr + rata + context ===
  const zones = await client.query(`
    WITH allb AS (
      SELECT bl."zoneName" as z, b.status, b."accountName", b."bookingSource", b."typeOfBooking"
      FROM "Booking" b
      JOIN "BookingLocation" bl ON bl."bookingId" = b.id AND bl.type='PICKUP'
    )
    SELECT z as zona,
           COUNT(*) FILTER (WHERE status='NO_FARE') as nofare,
           COUNT(*) as total,
           ROUND(100.0 * COUNT(*) FILTER (WHERE status='NO_FARE') / NULLIF(COUNT(*),0),2) as pct,
           COUNT(*) FILTER (WHERE status='NO_FARE' AND "typeOfBooking"='Advanced') as nofare_advanced,
           COUNT(*) FILTER (WHERE status='NO_FARE' AND "typeOfBooking"='ASAP') as nofare_asap
    FROM allb
    GROUP BY z
    HAVING COUNT(*) FILTER (WHERE status='NO_FARE') >= 5
    ORDER BY nofare DESC
  `);
  console.log('=== CLASAMENT NO-FARE PE ZONA (top, dupa nr) ===');
  console.log('zona | nofare | total | % | Adv | ASAP');
  zones.rows.forEach(r => console.log(
    r.zona.padEnd(18) + ' | ' + String(r.nofare).padStart(4) + ' | ' + String(r.total).padStart(5) +
    ' | ' + String(r.pct).padStart(5) + '% | ' + String(r.nofare_advanced).padStart(3) + ' | ' + String(r.nofare_asap).padStart(4)
  ));

  // === 2. Zone cu rata MARE (chiar daca nr mic) — semnal de problema ===
  const zonesRate = await client.query(`
    WITH allb AS (
      SELECT bl."zoneName" as z, b.status FROM "Booking" b
      JOIN "BookingLocation" bl ON bl."bookingId" = b.id AND bl.type='PICKUP'
    )
    SELECT z as zona, COUNT(*) FILTER (WHERE status='NO_FARE') as nofare,
           COUNT(*) as total, ROUND(100.0*COUNT(*) FILTER (WHERE status='NO_FARE')/NULLIF(COUNT(*),0),2) as pct
    FROM allb GROUP BY z HAVING COUNT(*) >= 20
    ORDER BY pct DESC LIMIT 12
  `);
  console.log('\n=== ZONE CU CEA MAI MARE RATA no-fare (semnal) ===');
  zonesRate.rows.forEach(r => console.log(r.zona.padEnd(18) + ' | ' + String(r.nofare).padStart(4) + '/' + String(r.total).padStart(5) + ' | ' + r.pct + '%'));

  // === 3. Clienti recurenti no-fare (telefon + nume + zona + cont) ===
  const clients = await client.query(`
    SELECT b."telephoneNumber" as tel, b."customerName" as nume,
           COALESCE(NULLIF(b."accountName",''), 'CASH/PRIVAT') as cont,
           bl."zoneName" as zona, COUNT(*) as nr, ROUND(SUM(COALESCE(b.price,0)),0) as valoare_pierduta
    FROM "Booking" b
    JOIN "BookingLocation" bl ON bl."bookingId"=b.id AND bl.type='PICKUP'
    WHERE b.status='NO_FARE' AND b."telephoneNumber" IS NOT NULL AND b."telephoneNumber" != ''
    GROUP BY b."telephoneNumber", b."customerName", cont, bl."zoneName"
    HAVING COUNT(*) >= 2
    ORDER BY nr DESC, valoare_pierduta DESC
    LIMIT 25
  `);
  console.log('\n=== CLIENTI RECURENTI NO-FARE (cu >=2, top 25) ===');
  console.log('tel | nume | cont | zona | nr | valoare_pierduta');
  clients.rows.forEach(r => console.log(
    (r.tel||'?').padEnd(14) + ' | ' + (r.nume||'?').padEnd(18) + ' | ' + String(r.cont).padEnd(14) +
    ' | ' + String(r.zona).padEnd(16) + ' | ' + String(r.nr).padStart(2) + ' | ' + String(r.valoare_pierduta).padStart(5)
  ));

  // === 4. Laira Depot: detalii — ce conturi/surse (marea problema feroviara) ===
  const laira = await client.query(`
    SELECT COALESCE(NULLIF(b."accountName",''),'CASH') as cont,
           b."typeOfBooking" as tip, b."bookingSource" as sursa,
           COUNT(*) as nr, ROUND(SUM(COALESCE(b.price,0)),0) as val
    FROM "Booking" b
    JOIN "BookingLocation" bl ON bl."bookingId"=b.id AND bl.type='PICKUP'
    WHERE b.status='NO_FARE' AND bl."address" ILIKE '%Laira%'
    GROUP BY cont, b."typeOfBooking", b."bookingSource" ORDER BY nr DESC
  `);
  console.log('\n=== LAIRA DEPOT no-fare: cont/tip/sursa ===');
  laira.rows.forEach(r => console.log(
    r.cont.padEnd(14)+' | '+String(r.tip).padEnd(9)+' | '+String(r.sursa).padEnd(16)+' | '+String(r.nr).padStart(3)+' | £'+r.val
  ));

  // === 5. Station: ora + tip ===
  const station = await client.query(`
    SELECT b."typeOfBooking" as tip,
           COUNT(*) FILTER (WHERE status='NO_FARE') as nofare,
           COUNT(*) as total,
           ROUND(100.0*COUNT(*) FILTER (WHERE status='NO_FARE')/NULLIF(COUNT(*),0),2) as pct
    FROM "Booking" b
    JOIN "BookingLocation" bl ON bl."bookingId"=b.id AND bl.type='PICKUP'
    WHERE bl."zoneName"='Station' GROUP BY b."typeOfBooking"
  `);
  console.log('\n=== STATION: no-fare pe tip booking ===');
  station.rows.forEach(r => console.log(r.tip.padEnd(10)+' | '+r.nofare+'/'+r.total+' | '+r.pct+'%'));

  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
