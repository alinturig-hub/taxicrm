// Genereaza display PNG pentru no-fare: clasament zone + analiza + clienti + recomandari
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','DejaVu Sans');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','DejaVu Sans Bold');
// Prioritate font DejaVu de sistem (mai curat)
const F = 'DejaVu Sans';
const FB = 'DejaVu Sans Bold';

const W=1400, H=1900, BG='#0f1420', CARD='#1a2233', LINE='#26304a';
const G='#4ade80', R='#f87171', A='#fbbf24', B='#60a5fa', P='#c084fc', TXT='#e8ecf4', SUB='#8b93a7';
const OUT='/workspace/projects/out-charts/';

// helpers
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function text(ctx,s,x,y,size,color=F,weight='normal',align='left'){ctx.font=(weight==='bold'?'bold ':'')+size+'px '+F;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);}
function wrapText(ctx, textStr, maxw){
  const words=textStr.split(' '); const lines=[]; let cur='';
  for(const w of words){
    const t=cur?cur+' '+w:w;
    if(ctx.measureText(t).width>maxw){ if(cur) lines.push(cur); cur=w; } else cur=t;
  }
  if(cur) lines.push(cur);
  return lines;
}

const c=createCanvas(W,H), ctx=c.getContext('2d');
ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);

// HEADER
text(ctx,'No-fare — analiză pe zone & clienți',55,64,34,TXT,'bold');
text(ctx,'TaxiCRM · date reale · total 574 no-fare · 21 aug 2026',60,96,17,SUB);

let y=135;

// === CARD 1: clasament zone (bar) ===
const zones=[['Station',81,'#f87171'],['Laira Depot',59,'#f87171'],['Derriford',40,'#fbbf24'],['City West',33,'#60a5fa'],['City East',31,'#60a5fa'],['Barbican',26,'#60a5fa'],['Devonport',25,'#60a5fa'],['Stoke',19,'#60a5fa'],['Hoe',18,'#60a5fa'],['Millbay',18,'#60a5fa']];
const maxz=90;
rrect(ctx,40,y,W-80,330,14); ctx.fillStyle=CARD; ctx.fill();
text(ctx,'Clasament no-fare pe zonă (top 10)',62,y+38,20,TXT,'bold');
const bx=70, bw=(W-140)/10, by0=y+70, bh=200;
ctx.strokeStyle=LINE; ['#8b93a7','#4e5a75'].forEach(()=>{});
for(let i=0;i<4;i++){const yy=by0+bh-(bh*i/4);ctx.strokeStyle=LINE;ctx.beginPath();ctx.moveTo(bx,yy);ctx.lineTo(bx+bw*10,yy);ctx.stroke();text(ctx,Math.round(maxz*i/4),bx-12,yy+4,12,SUB);}
zones.forEach((z,i)=>{
  const hh=bh*(z[1]/maxz), x=bx+i*bw+bw*0.12;
  ctx.fillStyle=z[2]; rrect(ctx,x,by0+bh-hh,bw*0.76,hh,6); ctx.fill();
  text(ctx,''+z[1],x+bw*0.38,by0+bh-hh-8,14,TXT,'bold','center');
  ctx.save(); ctx.translate(x+bw*0.38, by0+bh+70); ctx.rotate(-0.6); ctx.textAlign='right';
  text(ctx,z[0],0,0,12.5,SUB); ctx.restore();
});
y+=360;

// === CARD 2: mecanica pe zone (analiza) ===
const analiza=[
 ['Laira Depot','10.1% rată — cea mai mare. 53/59 joburi de la CMAC CABX, Advanced, ThirdParty. Pre-booking-uri de la personalul depozitului GWR care nu se prezintă. ~£562 arse.','#f87171'],
 ['Station','81 no-fare, dar 71 sunt Advanced (10.2% rată). ASAP-ul la gară e doar 0.5%. Nu walk-in, ci pre-rezervări care nu apucă trenul.','#f87171'],
 ['Derriford','40 no-fare, 36 ASAP — spital, rezervări de urgență care pică. Rată ~4%.','#fbbf24'],
 ['Barbican / City E-W / Devonport','volum mediu (25-33), rată 2.7-4.6% — zonă de bar/centru, no-show pe ASAP, parțial inevitabil.','#60a5fa'],
];
let cardH=50+analiza.length*68;
rrect(ctx,40,y,W-80,cardH,14); ctx.fillStyle=CARD; ctx.fill();
text(ctx,'Ce spune analiza — mecanica fiecărei zone',62,y+38,20,TXT,'bold');
let ay=y+62;
analiza.forEach(a=>{
  ctx.fillStyle=a[2]; ctx.fillRect(62,ay-4,10,44);
  text(ctx,a[0],86,ay+14,16,TXT,'bold');
  ctx.fillStyle='#c8d2e8';
  const maxw=W-180; ctx.font='13.5px '+F;
  const lines=wrapText(ctx,a[1],maxw);
  lines.forEach((line,idx)=>{ text(ctx,line,86,ay+38+idx*18,13.5,'#aeb8cc'); });
  ay+=20+lines.length*18+22;
});
y+=cardH+24;

// === CARD 3: clienti recurenti ===
const clienti=[['TORIN GARNER','Estover · școala','3','£66'],['dain hudson-20635','Devonport · Princess Yachts','3','£51'],['Blessing','Devon · Clear Thinking Care','2','£80'],['Robert nunn','Derriford · Univ Hospital','2','£25'],['KERRY','Barbican · cash','2','£23'],['Eboni Devereaux','City East · cash','2','£21'],['jade cooper','Keyham · cash','2','£17'],['SUNNY','Station · cash','2','£16'],['James Chapman','Stoke · cash','2','£15'],['Victoria Montague','Mutley · cash','2','£15']];
let ch=50+clienti.length*30;
rrect(ctx,40,y,W-80,ch,14); ctx.fillStyle=CARD; ctx.fill();
text(ctx,'Clienți recurenți no-fare (≥2)',62,y+38,20,TXT,'bold');
// header
text(ctx,'Client',70,y+58,13,SUB,'bold'); text(ctx,'Cont / zona',360,y+58,13,SUB,'bold'); text(ctx,'Nr',640,y+58,13,SUB,'bold','center'); text(ctx,'£ pierdut',700,y+58,13,SUB,'bold');
ctx.strokeStyle=LINE; ctx.beginPath(); ctx.moveTo(70,y+64); ctx.lineTo(W-70,y+64); ctx.stroke();
let cy=y+82;
clienti.forEach(cl=>{
  text(ctx,cl[0],70,cy,14,TXT); text(ctx,cl[1],360,cy,13,'#aeb8cc'); text(ctx,cl[2],655,cy,14,TXT,'bold','center'); text(ctx,cl[3],720,cy,14,'#f87171','bold');
  cy+=30;
});
y+=ch+24;

// === CARD 4: recomandari ===
const recs=[
 ['Laira Depot — cel mai ușor câștig','Toate no-fare-urile mari sunt pre-booking Advanced cu același cont (CMAC CABX). Confirmare automată la X-2/4 ore pentru job-urile Advanced ale acestui cont: dacă nu confirmă, jobul se eliberează. Impact: până la ~53 joburi salvate/zonă.'],
 ['Station — confirmare la pre-rezervări','71 no-fare pe Advanced. Confirmare obligatorie cu 3-4h înainte la booking-urile Advanced pe gară + atenție la orele de tren (4-5 dim., 22h). Dacă n-a confirmat, nu trimite șoferul să aștepte.'],
 ['Derriford / spital — semnal la ASAP','Trimite șoferul doar după confirmare la bookings ASAP din zona spitalicească de 4% rată; marchează clienții recurenți (ex. Robert nunn) ca risc.'],
 ['Clienți recurenți ≥2 — listă de risc','TORIN GARNER, dain hudson, Blessing + Casa: listă de risc; la comanda următoare, cerere avans sau confirmare. Dacă rămân no-show, depunctare la prioritate.'],
 ['Regula globală — cost de maturitate la Advanced','Advanced are 3.07% no-show vs ASAP 2.04%. Orice job Advanced > 2h înainte merită confirmare automată. O singură regulă rezolvă 3 găuri deodată.'],
];
let yRec = y + 40;
recs.forEach((r)=>{
  const maxw=W-160; ctx.font='13.5px '+F;
  const nl=wrapText(ctx,r[1],maxw).length;
  const ch=50+nl*19+14;
  rrect(ctx,40,yRec,W-80,ch,12); ctx.fillStyle='#13231a'; ctx.fill();
  ctx.fillStyle='#4ade80'; ctx.fillRect(40,yRec+8,6,ch-16);
  text(ctx,'✓ '+r[0],66,yRec+30,16.5,'#7bed9f','bold');
  const lines=wrapText(ctx,r[1],maxw);
  lines.forEach((line,idx)=>{ text(ctx,line,66,yRec+56+idx*19,13.5,'#aeb8cc'); });
  yRec += ch + 10;
});
y = yRec - 30;

// FOOTER
text(ctx,'Linie roșie: Advanced = 3.07% no-show vs ASAP 2.04% · confirmarea automată la pre-booking rezolvă Laira + Station + toate zonele',55,Math.min(y+30,H-20),16,'#fbbf24','bold');

fs.writeFileSync(OUT+'nofare-display.png', c.toBuffer('image/png'));
console.log('Saved nofare-display.png', c.width+'x'+c.height);
