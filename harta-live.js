require('dotenv').config();
const { Client } = require('pg');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','DejaVu Sans');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','DejaVu Sans Bold');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
  // Ultima pozitie per sofer activ, ultimele 5 min, fara #926
  const r = await client.query(`
    WITH latest AS (
      SELECT DISTINCT ON (vs."driverId")
        vs."driverId", vs.latitude, vs.longitude, vs."snapshotAt",
        vs."vehicleStatus"
      FROM "VehicleSnapshot" vs
      JOIN "Driver" d ON d.id = vs."driverId"
      WHERE vs."snapshotAt" > NOW() - INTERVAL '5 minutes'
        AND vs.latitude IS NOT NULL
        AND d.callsign != '926'
        AND d.active = true
      ORDER BY vs."driverId", vs."snapshotAt" DESC
    )
    SELECT l."driverId", d.callsign, d.forename, d.surname,
           l.latitude, l.longitude, l."snapshotAt", l."vehicleStatus"
    FROM latest l
    JOIN "Driver" d ON d.id = l."driverId"
    ORDER BY d.callsign
  `);
  const soferi = r.rows;
  console.log('Soferi activi pe harta:', soferi.length);

  // Proiectie Plymouth
  const cLat=50.375, cLng=-4.12;
  const kmLng=111.32*Math.cos(cLat*Math.PI/180);
  function proj(lat,lng){return{x:(lng-cLng)*kmLng,y:(cLat-lat)*111.32};}
  const P=soferi.map(s=>({s, p:proj(parseFloat(s.latitude),parseFloat(s.longitude))}));
  const xs=P.map(t=>t.p.x), ys=P.map(t=>t.p.y);
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const rx=Math.max(maxx-minx,0.6), ry=Math.max(maxy-miny,0.6);

  const W=1100,H=1100,PAD=90;
  const c=createCanvas(W,H), ctx=c.getContext('2d');
  ctx.fillStyle='#e6edf5'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#c6d2e0'; ctx.lineWidth=1;
  for(let i=0;i<=12;i++){ctx.beginPath();ctx.moveTo(PAD+i*(W-2*PAD)/12,PAD);ctx.lineTo(PAD+i*(W-2*PAD)/12,H-PAD);ctx.stroke();
    ctx.beginPath();ctx.moveTo(PAD,PAD+i*(H-2*PAD)/12);ctx.lineTo(W-PAD,PAD+i*(H-2*PAD)/12);ctx.stroke();}

  function XY(k){return{x:PAD+(k.x-minx)/rx*(W-2*PAD), y:H-PAD-(k.y-miny)/ry*(H-2*PAD)};}

  // marcaj soferi
  const busy=[], free=[];
  soferi.forEach(s=>{ (s.vehicleStatus && s.vehicleStatus.startsWith('Busy')) ? busy.push(s) : free.push(s); });
  P.forEach(t=>{
    const q=XY(t.p); const busyS=(t.s.vehicleStatus||'').startsWith('Busy');
    ctx.beginPath();ctx.arc(q.x,q.y,9,0,Math.PI*2);
    ctx.fillStyle=busyS?'#f87171':'#4ade80'; ctx.fill();
    ctx.strokeStyle=busyS?'#7f1d1d':'#14532d'; ctx.lineWidth=2; ctx.stroke();
  });
  // call signs
  ctx.font='bold 12px DejaVu Sans'; ctx.fillStyle='#1a2233'; ctx.textAlign='center';
  P.forEach(t=>{const q=XY(t.p);ctx.fillText(t.s.callsign,q.x,q.y-14);});

  // Titlu + legenda
  ctx.font='bold 20px DejaVu Sans'; ctx.textAlign='left'; ctx.fillStyle='#1a2233';
  ctx.fillText('Șoferi activi — live (Plymouth)', PAD, 36);
  ctx.font='13px DejaVu Sans'; ctx.fillStyle='#4b5563';
  ctx.fillText('Ultimele 5 min · ' + soferi.length + ' șoferi (fără #926)', PAD, 58);
  ctx.fillStyle='#4ade80'; ctx.fillRect(PAD,74,16,16); ctx.fillStyle='#1a2233';
  ctx.fillText(' = liber', PAD+24,86);
  ctx.fillStyle='#f87171'; ctx.fillRect(PAD,98,16,16); ctx.fillStyle='#1a2233';
  ctx.fillText(' = ocupat (cu client)', PAD+24,110);
  // scara
  const kpx=(1.0/rx)*(W-2*PAD); ctx.strokeStyle='#4b5563'; ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(PAD+10,H-PAD-20);ctx.lineTo(PAD+10+kpx,H-PAD-20);ctx.stroke();
  ctx.font='12px DejaVu Sans'; ctx.fillText('~1 km', PAD+10+kpx+6, H-PAD-22);

  fs.writeFileSync('/workspace/projects/out-charts/harta-live.png', c.toBuffer('image/png'));
  console.log('Saved harta-live.png', W+'x'+H, '· liber:'+free.length, 'ocupati:'+busy.length);
  await client.end();
}).catch(e=>{console.error(e);process.exit(1);});
