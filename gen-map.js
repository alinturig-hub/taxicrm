// Harta PNG: sofer la reject (rosu) vs pickup (verde) - zona Plymouth
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','DejaVu Sans');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','DejaVu Sans Bold');

const data = JSON.parse(fs.readFileSync('/workspace/projects/map-data.json','utf8'));

// PROIECTIE liniara (lat/lng -> x/y) pe latitudine medie pt corectie distanta
function proj(lat,lng){
  // centru hartie
  const cLat=50.375, cLng=-4.12;
  // km per grad: lat ~111.32, lng ~ 111.32*cos(lat)
  const kmLng = 111.32 * Math.cos(cLat*Math.PI/180);
  return {
    x: (lng - cLng) * kmLng,  // km est
    y: (cLat - lat) * 111.32  // km nord (invers pt y jos)
  };
}

const W=1000, H=1000, PAD=80;
const c=createCanvas(W,H), ctx=c.getContext('2d');

// Fundal hartie stilizat (bloc urban)
ctx.fillStyle='#dfe7f0'; ctx.fillRect(0,0,W,H);
// grid
ctx.strokeStyle='#c2cedd'; ctx.lineWidth=1;
for(let i=0;i<=10;i++){ ctx.beginPath(); ctx.moveTo(PAD+i*(W-2*PAD)/10,PAD); ctx.lineTo(PAD+i*(W-2*PAD)/10,H-PAD); ctx.stroke(); }
for(let i=0;i<=10;i++){ ctx.beginPath(); ctx.moveTo(PAD,PAD+i*(H-2*PAD)/10); ctx.lineTo(W-PAD,PAD+i*(H-2*PAD)/10); ctx.stroke(); }
// scara ~1km
ctx.fillStyle='#8b93a7'; ctx.font='12px DejaVu Sans'; ctx.textAlign='left';
ctx.fillText('~1 km', PAD, H-PAD+20);

function toXY(p){ const k=proj(p.lat,p.lng); const kpx=1.0; /* km->px scaled */ 
  // scale: Plymouth extinde ~ +/- 1.2 km OW => prind tot in cadru
  const scale = (W-2*PAD)/3.0; // 3 km latime
  return { x: PAD + k.x*scale + (W-2*PAD)/2, y: H-PAD - k.y*scale - (H-2*PAD)/2 };
}

// dupa scale: refacem folosind range real
const pts = data.map(o=>({o, p:proj(o.driverLat,o.driverLng), k:proj(o.pickupLat,o.pickupLng) }));
const xs=[],ys=[];
pts.forEach(t=>{xs.push(t.p.x,t.k.x);ys.push(t.p.y,t.k.y);});
const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
const rx=Math.max(maxx-minx,0.5), ry=Math.max(maxy-miny,0.5);
function XY(k){ return { x: PAD + (k.x-minx)/rx*(W-2*PAD), y: H-PAD - (k.y-miny)/ry*(H-2*PAD) }; }

// Linii sofer->pickup
pts.forEach(t=>{
  const a=XY(t.p), b=XY(t.k);
  ctx.strokeStyle='rgba(248,113,113,0.55)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
});

// Puncte: pickup verde mai mare, sofer rosu
pts.forEach(t=>{
  const a=XY(t.p), b=XY(t.k);
  ctx.beginPath(); ctx.arc(b.x,b.y,7,0,Math.PI*2); ctx.fillStyle='#4ade80'; ctx.fill();
  ctx.strokeStyle='#14532d'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(a.x,a.y,7,0,Math.PI*2); ctx.fillStyle='#f87171'; ctx.fill();
  ctx.strokeStyle='#7f1d1d'; ctx.lineWidth=1.5; ctx.stroke();
});

// Legend
ctx.font='bold 17px DejaVu Sans'; ctx.textAlign='left';
ctx.fillStyle='#1a2233'; ctx.fillText('Plymouth — refuzuri job (sv=55)', PAD+10, 34);
ctx.font='13px DejaVu Sans';
ctx.fillStyle='#7f1d1d'; ctx.fillRect(PAD+10,46,14,14);
ctx.fillStyle='#1a2233'; ctx.fillText(' = șoferul la momentul reject', PAD+30,58);
ctx.fillStyle='#14532d'; ctx.fillRect(PAD+10,66,14,14);
ctx.fillStyle='#1a2233'; ctx.fillText(' = pickup-ul jobului oferit', PAD+30,78);
ctx.fillStyle='rgba(248,113,113,0.8)'; ctx.fillRect(PAD+10,86,30,4);
ctx.fillStyle='#1a2233'; ctx.fillText(' = distanta sofer->pickup', PAD+46,96);

fs.writeFileSync('/workspace/projects/out-charts/harta-refuzuri.png', c.toBuffer('image/png'));
console.log('Saved harta-refuzuri.png', W+'x'+H);
