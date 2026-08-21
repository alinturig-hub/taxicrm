// Genereaza grafice PNG pentru TaxiCRM
// Ruleaza din /workspace/projects/taxicrm (unde e @napi-rs/canvas in node_modules)
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');

// Inregistreaza fonturile (fara font nu se randeaza textul)
const FONT_BASE = '/workspace/opt/openclaw/apps/android/app/src/main/res/font/';
GlobalFonts.registerFromPath(FONT_BASE + 'manrope_700_bold.ttf', 'Manrope Bold');
GlobalFonts.registerFromPath(FONT_BASE + 'manrope_400_regular.ttf', 'Manrope');
GlobalFonts.registerFromPath(FONT_BASE + 'manrope_600_semibold.ttf', 'Manrope Semibold');
const F = 'Manrope';

const OUT = '/workspace/projects/out-charts/';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Paleta
const BG = '#0f1420';
const CARD = '#1a2233';
const GREEN = '#4ade80', RED = '#f87171', AMBER = '#fbbf24', BLUE = '#60a5fa', PURPLE = '#c084fc', CYAN = '#22d3ee';
const TXT = '#e8ecf4', SUB = '#8b93a7', GRID = '#2a3652';

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- BAR CHART generic ----------
function barChart(filename, title, labels, values, color, { horizontal=false, valueLabel='', hlColor={} }={}) {
  const W = 760, H = 480, padL = horizontal ? 150 : 64, padB = 56, padT = 70, padR = 24;
  const c = createCanvas(W, H); const ctx = c.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = TXT; ctx.font = 'bold 22px Manrope'; ctx.textAlign='left';
  ctx.fillText(title, padL, 40);

  const chartW = W - padL - padR, chartH = H - padT - padB;
  const max = Math.max(...values) * 1.1;

  // grid
  ctx.strokeStyle = GRID; ctx.lineWidth = 1;
  if (horizontal) {
    // In mod orizontal, valorile de pe axa X se deseneaza la dreapta, nu peste etichete
    for (let i = 0; i <= 4; i++) {
      const x = padL + (chartW * i / 4);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
      ctx.fillStyle = SUB; ctx.font = '11px Manrope'; ctx.textAlign = 'center';
      ctx.fillText(Math.round(max * i / 4), x, H - 18);
    }
  } else {
    for (let i = 0; i <= 4; i++) {
      const y = padT + chartH - (chartH * i / 4);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = SUB; ctx.font = '12px Manrope'; ctx.textAlign='right';
      ctx.fillText(Math.round(max * i / 4), padL - 8, y + 4);
    }
  }

  if (!horizontal) {
    const bw = chartW / labels.length;
    for (let i = 0; i < labels.length; i++) {
      const h = chartH * (values[i] / max);
      const x = padL + i * bw + bw * 0.15;
      const y = padT + chartH - h;
      ctx.fillStyle = hlColor[labels[i]] || color;
      roundedRect(ctx, x, y, bw * 0.7, h, 5); ctx.fill();
      ctx.fillStyle = TXT; ctx.font = 'bold 13px Manrope'; ctx.textAlign='center';
      ctx.fillText(values[i], padL + i * bw + bw * 0.5, y - 8);
      ctx.font = '12px Manrope'; ctx.fillStyle = SUB;
      ctx.save(); ctx.translate(padL + i * bw + bw * 0.5, H - 26);
      const lab = labels[i];
      if (lab.length > 11) { ctx.rotate(-0.5); ctx.textAlign='right'; }
      ctx.fillText(lab, 0, 0); ctx.restore();
    }
  } else {
    const bh = chartH / labels.length;
    for (let i = 0; i < labels.length; i++) {
      const bw = chartW * (values[i] / max);
      const y = padT + i * bh + bh * 0.15;
      ctx.fillStyle = hlColor[labels[i]] || color;
      roundedRect(ctx, padL, y, bw, bh * 0.7, 5); ctx.fill();
      ctx.fillStyle = TXT; ctx.font = 'bold 13px Manrope'; ctx.textAlign='left';
      ctx.fillText(values[i], padL + bw + 8, y + bh * 0.42);
      ctx.font = '12px Manrope'; ctx.fillStyle = SUB; ctx.textAlign='right';
      ctx.fillText(labels[i], padL - 10, y + bh * 0.42);
    }
  }
  fs.writeFileSync(OUT + filename, c.toBuffer('image/png'));
  console.log('Saved', filename);
}

// ---------- DONUT ----------
function donut(filename, title, labels, values, colors) {
  const W = 720, H = 460, cx = W * 0.38, cy = H * 0.52, R = 130;
  const c = createCanvas(W, H); const ctx = c.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = TXT; ctx.font = 'bold 22px Manrope'; ctx.textAlign='left';
  ctx.fillText(title, 40, 40);

  const total = values.reduce((a, b) => a + b, 0);
  let ang = -Math.PI / 2;
  for (let i = 0; i < values.length; i++) {
    const a2 = ang + (values[i] / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, ang, a2);
    ctx.closePath();
    ctx.fillStyle = colors[i]; ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.62, ang, a2);
    ctx.lineTo(cx, cy); ctx.closePath(); ctx.fillStyle = BG; ctx.fill();
    ang = a2;
  }
  ctx.fillStyle = SUB; ctx.font = '14px Manrope'; ctx.textAlign='center';
  ctx.fillText(total.toLocaleString(), cx, cy - 4);
  ctx.fillStyle = TXT; ctx.font = 'bold 18px Manrope';
  ctx.fillText('total', cx, cy + 18);

  let ly = 70;
  for (let i = 0; i < labels.length; i++) {
    ctx.fillStyle = colors[i]; ctx.fillRect(W * 0.6, ly - 12, 14, 14);
    ctx.fillStyle = TXT; ctx.font = '13px Manrope'; ctx.textAlign='left';
    const pct = Math.round(values[i] / total * 100);
    ctx.fillText(labels[i], W * 0.6 + 22, ly);
    ctx.fillStyle = SUB;
    ctx.fillText(values[i].toLocaleString() + '  (' + pct + '%)', W * 0.6 + 22, ly + 16);
    ly += 46;
  }
  fs.writeFileSync(OUT + filename, c.toBuffer('image/png'));
  console.log('Saved', filename);
}

// ---------- LINE CHART ----------
function lineChart(filename, title, labels, values, color) {
  const W = 760, H = 460, padL = 54, padB = 40, padT = 66, padR = 24;
  const c = createCanvas(W, H); const ctx = c.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = TXT; ctx.font = 'bold 22px Manrope';
  ctx.fillText(title, padL, 40);

  const chartW = W - padL - padR, chartH = H - padT - padB;
  const max = Math.max(...values) * 1.15;
  ctx.strokeStyle = GRID;
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH - (chartH * i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = SUB; ctx.font = '12px Manrope'; ctx.textAlign='right';
    ctx.fillText(Math.round(max * i / 4), padL - 8, y + 4);
  }

  // fill
  ctx.beginPath();
  ctx.moveTo(padL, padT + chartH);
  values.forEach((v, i) => { ctx.lineTo(padL + (chartW * i / (values.length - 1)), padT + chartH - (chartH * v / max)); });
  ctx.lineTo(W - padR, padT + chartH); ctx.closePath();
  ctx.fillStyle = color + '26'; ctx.fill();

  // line
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = padL + (chartW * i / (values.length - 1)), y = padT + chartH - (chartH * v / max);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();

  // points
  values.forEach((v, i) => {
    const x = padL + (chartW * i / (values.length - 1)), y = padT + chartH - (chartH * v / max);
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  });

  // x labels (sparse)
  const step = Math.ceil(labels.length / 12);
  values.forEach((v, i) => {
    if (i % step !== 0 && i !== values.length - 1) return;
    const x = padL + (chartW * i / (values.length - 1));
    ctx.fillStyle = SUB; ctx.font = '11px Manrope'; ctx.textAlign='center';
    ctx.fillText(labels[i], x, H - 14);
  });
  fs.writeFileSync(OUT + filename, c.toBuffer('image/png'));
  console.log('Saved', filename);
}

// ===== GENERARE =====

// 1. Distributia statusurilor (donut)
donut('1-statusuri.png', 'Distributia booking-urilor pe status',
  ['Finalizate', 'Rejected', 'Anulate', 'In curs', 'No-fare'],
  [17592, 2392, 1940, 1617, 574],
  [GREEN, RED, AMBER, BLUE, PURPLE]);

// 2. Rejected breakdown (bar)
barChart('2-rejected.png', 'Ce s-a intamplat cu cele 2,392 REJECTED',
  ['Efectuate', 'Anulate', 'No-fare', 'Pierdute'],
  [1993, 250, 144, 5], GREEN, { hlColor: { 'Efectuate': GREEN, 'Anulate': AMBER, 'No-fare': PURPLE, 'Pierdute': RED } });

// 3. No-fare pe ora (line)
lineChart('3-nofare-ora.png', 'No-fare pe ora (varfuri: 0h 11h 13h 19h 21h 22h)',
  ['0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23'],
  [35,18,8,9,14,24,23,16,21,17,20,33,20,34,25,31,25,25,19,34,22,34,39,28], RED);

// 4. No-fare pe zona (bar horizontal)
barChart('4-nofare-zone.png', 'No-fare pe zona de pickup (top 8)',
  ['Station','Laira Depot','Derriford','City West','City East','Barbican','Devonport','Stoke'],
  [81,59,40,33,31,26,25,19], BLUE, { horizontal: true, hlColor: { 'Station': RED, 'Laira Depot': RED } });

// 5. No-fare pe zi (bar)
barChart('5-nofare-zi.png', 'No-fare pe zi a saptamanii',
  ['Luni','Marti','Miercuri','Joi','Vineri','Sambata','Duminica'],
  [59,56,96,111,102,80,70], PURPLE, { hlColor: { 'Joi': RED, 'Vineri': RED, 'Miercuri': RED } });

console.log('\nToate graficele generate in', OUT);
