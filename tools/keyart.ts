// Procedural key art for Steam capsules, rendered in the game's own paint style.
// Open tools/keyart.html?w=920&h=430&layout=wide (the capsule script automates all sizes).
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/fredoka/latin-600.css';
import { hash2 } from '../src/core/rng';
import { mixHex } from '../src/core/math';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') ?? 920);
const H = Number(q.get('h') ?? 430);
const layout = q.get('layout') ?? 'wide'; // wide | tall | small | logo | hero | bg | icon
const seed = Number(q.get('seed') ?? 7);

const cv = document.getElementById('c') as HTMLCanvasElement;
cv.width = W;
cv.height = H;
const ctx = cv.getContext('2d')!;
const TAU = Math.PI * 2;
const rnd = (i: number, k = 0) => hash2(i, k, seed);

const LAND = ['#7bd88f', '#9be564', '#ffd166', '#ff8fab', '#5fa8d3', '#3ecfcf', '#c77dff', '#ff7b3a', '#f4a261'];
const EDGE = '#fff3b0';

function background(transparent = false) {
  if (transparent) return;
  const g = ctx.createRadialGradient(W * 0.6, H * 0.45, 0, W * 0.6, H * 0.45, Math.max(W, H) * 0.8);
  g.addColorStop(0, '#2b2736');
  g.addColorStop(1, '#0f0d15');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // canvas weave
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const step = Math.max(4, Math.round(Math.min(W, H) / 120));
  for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

/** Paint-blob territory inside an implicit field. */
function territory(cx: number, cy: number, scale: number, blobs: [number, number, number][], cell: number) {
  const field = (x: number, y: number) => {
    let f = 0;
    for (const [bx, by, br] of blobs) {
      const dx = (x - (cx + bx * scale)) / (br * scale), dy = (y - (cy + by * scale)) / (br * scale);
      f += 1 / (dx * dx + dy * dy + 0.0001);
    }
    return f;
  };
  const cells: [number, number, number][] = [];
  for (let y = -cell; y < H + cell; y += cell)
    for (let x = -cell; x < W + cell; x += cell) {
      const jitter = (rnd(x, y) - 0.5) * 0.25;
      if (field(x, y) > 1 + jitter) cells.push([x, y, Math.floor(((Math.sin(x * 0.004 + y * 0.003) + Math.sin(x * 0.011 - y * 0.007)) * 0.25 + 0.5) * LAND.length) % LAND.length]);
    }
  const pass = (col: string | null, r: number, dy = 0) => {
    if (col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (const [x, y] of cells) { ctx.moveTo(x + r, y + dy); ctx.arc(x, y + dy, r, 0, TAU); }
      ctx.fill();
      return;
    }
    for (let k = 0; k < LAND.length; k++) {
      for (const light of [-0.08, 0, 0.1]) {
        ctx.fillStyle = light < 0 ? mixHex(LAND[k], '#000000', -light) : mixHex(LAND[k], '#ffffff', light);
        ctx.beginPath();
        let any = false;
        for (const [x, y, c] of cells) {
          if (c !== k) continue;
          const l = rnd(x * 3, y * 7) < 0.33 ? -0.08 : rnd(x * 3, y * 7) < 0.66 ? 0 : 0.1;
          if (l !== light) continue;
          any = true;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        if (any) ctx.fill();
      }
    }
  };
  pass('rgba(0,0,0,0.35)', cell * 1.05, cell * 0.3);
  pass(EDGE, cell * 0.92);
  pass(null, cell * 0.74);
  // flowers
  for (const [x, y] of cells) {
    const h = rnd(x, y + 1);
    if (h > 0.07) continue;
    const col = ['#ffffff', '#ff5d8f', '#fff3b0', '#c77dff'][Math.floor(rnd(y, x) * 4)];
    ctx.fillStyle = col;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * cell * 0.18, y + Math.sin(a) * cell * 0.18, cell * 0.12, 0, TAU);
      ctx.fill();
    }
  }
  return cells.length;
}

function blob(x: number, y: number, r: number, rim: string, eyesTo: [number, number], popping = false) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 0.9, r * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = popping ? '#ffffff' : '#17151f';
  ctx.beginPath();
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * TAU;
    const rr = r * (1 + 0.07 * Math.sin(a * 3 + x));
    if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.stroke();
  const la = Math.atan2(eyesTo[1] - y, eyesTo[0] - x);
  const ex = Math.cos(la) * r * 0.18, ey = Math.sin(la) * r * 0.18;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.33 + ex, y - r * 0.12 + ey, r * 0.25, 0, TAU);
  ctx.arc(x + r * 0.33 + ex, y - r * 0.12 + ey, r * 0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = popping ? '#ff5d8f' : rim;
  ctx.beginPath();
  ctx.arc(x - r * 0.33 + ex * 1.6, y - r * 0.12 + ey * 1.6, r * 0.12, 0, TAU);
  ctx.arc(x + r * 0.33 + ex * 1.6, y - r * 0.12 + ey * 1.6, r * 0.12, 0, TAU);
  ctx.fill();
  if (popping) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.45, 0, TAU);
    ctx.stroke();
  }
}

function confetti(x: number, y: number, n: number, spread: number, size: number, k0: number) {
  for (let k = 0; k < n; k++) {
    const a = rnd(k + k0, 1) * TAU, d = spread * (0.3 + rnd(k + k0, 2) * 0.9);
    ctx.fillStyle = LAND[Math.floor(rnd(k + k0, 3) * LAND.length)];
    ctx.save();
    ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
    ctx.rotate(rnd(k + k0, 4) * TAU);
    ctx.fillRect(-size / 2, -size / 3, size, size * 0.66);
    ctx.restore();
  }
}

function sparkle(x: number, y: number, s: number, col = '#fff') {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

function pip(x: number, y: number, r: number, ang: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 1.05, r * 1.1, r * 0.35, 0, 0, TAU);
  ctx.fill();
  // brush
  const hx = x + Math.cos(ang) * r * 0.6, hy = y + Math.sin(ang) * r * 0.6;
  ctx.strokeStyle = '#8d5524';
  ctx.lineWidth = r * 0.26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(ang) * r * 0.2, y - Math.sin(ang) * r * 0.2);
  ctx.lineTo(hx + Math.cos(ang) * r * 1.1, hy + Math.sin(ang) * r * 1.1);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.ellipse(hx + Math.cos(ang) * r * 1.45, hy + Math.sin(ang) * r * 1.45, r * 0.5, r * 0.32, ang, 0, TAU);
  ctx.fill();
  // body
  ctx.fillStyle = '#1b1a22';
  ctx.beginPath();
  ctx.arc(x, y, r * 1.12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff8e7';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  // hat
  ctx.fillStyle = '#ff5d8f';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.1, y - r * 0.62, r * 1.05, r * 0.55, -0.15, Math.PI, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.8, y - r * 1.08, r * 0.3, 0, TAU);
  ctx.fill();
  // face
  ctx.fillStyle = '#1b1a22';
  ctx.beginPath();
  ctx.arc(x + r * 0.05, y + r * 0.05, r * 0.14, 0, TAU);
  ctx.arc(x + r * 0.5, y + r * 0.05, r * 0.14, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#1b1a22';
  ctx.lineWidth = r * 0.1;
  ctx.beginPath();
  ctx.arc(x + r * 0.28, y + r * 0.3, r * 0.2, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,93,143,0.45)';
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y + r * 0.3, r * 0.14, 0, TAU);
  ctx.arc(x + r * 0.8, y + r * 0.3, r * 0.14, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The hero stroke: a loop lassoing a crowd. Returns the loop centre. */
function loopStroke(cx: number, cy: number, rx: number, ry: number, width: number, headAng: number) {
  const pts: [number, number][] = [];
  const start = headAng + 0.5;
  for (let k = 0; k <= 64; k++) {
    const t = start + (k / 64) * (TAU * 0.96);
    const wob = 1 + 0.06 * Math.sin(t * 3 + 1);
    pts.push([cx + Math.cos(t) * rx * wob, cy + Math.sin(t) * ry * wob]);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const path = () => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  };
  path();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = width * 1.6;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#ff5d8f';
  ctx.lineWidth = width;
  ctx.stroke();
  path();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = width * 0.25;
  ctx.stroke();
  return pts[pts.length - 1];
}

function logo(x: number, y: number, size: number, align: 'center' | 'left' = 'center', tagline = true, maxW = Infinity) {
  ctx.save();
  ctx.font = `700 ${size}px Fredoka`;
  const approx = ctx.measureText('HUE&CLAIM').width * 1.02;
  if (approx > maxW) size *= maxW / approx;
  ctx.font = `700 ${size}px Fredoka`;
  ctx.textBaseline = 'alphabetic';
  const parts: { t: string; c: string | 'grad'; s: number }[] = [
    { t: 'H', c: '#ff5d8f', s: 1 }, { t: 'U', c: '#ffd166', s: 1 }, { t: 'E', c: '#06d6a0', s: 1 },
    { t: '&', c: '#ffffff', s: 0.55 }, { t: 'CLAIM', c: 'grad', s: 1 },
  ];
  const widths = parts.map((p) => {
    ctx.font = `700 ${size * p.s}px Fredoka`;
    return ctx.measureText(p.t).width + (p.t === '&' ? size * 0.14 : 0);
  });
  const total = widths.reduce((a, b) => a + b, 0);
  let px = align === 'center' ? x - total / 2 : x;
  parts.forEach((p, i) => {
    ctx.font = `700 ${size * p.s}px Fredoka`;
    const py = p.t === '&' ? y - size * 0.25 : y;
    const tx = px + (p.t === '&' ? size * 0.07 : 0);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f0d15';
    ctx.lineWidth = size * 0.16 * p.s;
    ctx.strokeText(p.t, tx, py + size * 0.06);
    ctx.strokeText(p.t, tx, py);
    if (p.c === 'grad') {
      const g = ctx.createLinearGradient(tx, 0, tx + widths[i], 0);
      g.addColorStop(0, '#4cc9f0');
      g.addColorStop(0.45, '#9b5de5');
      g.addColorStop(1, '#ff5d8f');
      ctx.fillStyle = g;
    } else ctx.fillStyle = p.c;
    ctx.fillText(p.t, tx, py);
    // gloss
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.rect(tx, py - size * 0.72 * p.s, widths[i], size * 0.2 * p.s);
    ctx.clip();
    ctx.fillText(p.t, tx, py);
    ctx.restore();
    px += widths[i];
  });
  if (tagline) {
    ctx.font = `700 ${size * 0.19}px Fredoka`;
    ctx.fillStyle = '#fff3b0';
    ctx.textAlign = align === 'center' ? 'center' : 'left';
    ctx.lineWidth = size * 0.05;
    ctx.strokeStyle = '#0f0d15';
    const tx = align === 'center' ? x : x + size * 0.04;
    const tag = 'DRAW THE LINE. CLAIM THE WORLD.';
    ctx.strokeText(tag, tx, y + size * 0.36);
    ctx.fillText(tag, tx, y + size * 0.36);
  }
  ctx.restore();
  return total;
}

function scene(cx: number, cy: number, s: number, withLand = true) {
  // land blob behind (the painted world)
  if (withLand) {
    territory(cx + s * 1.2, cy + s * 1.1, s, [[0, 0, 1.1], [-1.1, 0.5, 0.8], [0.9, -0.6, 0.9], [0.4, -1.6, 0.6]], Math.max(6, s * 0.075));
  }
  // loop interior flooding with color (partial wave)
  territory(cx, cy, s, [[0, 0, 0.88], [0.25, -0.2, 0.6], [-0.3, 0.25, 0.55]], Math.max(6, s * 0.075));
  // captured crowd popping inside the loop
  for (let k = 0; k < 9; k++) {
    const a = rnd(k, 11) * TAU, d = s * 0.55 * Math.sqrt(rnd(k, 12));
    const x = cx + Math.cos(a) * d * 1.2, y = cy + Math.sin(a) * d * 0.8;
    const pop = k % 3 === 0;
    blob(x, y, s * (0.11 + rnd(k, 13) * 0.05), ['#8d99ae', '#f72585', '#4cc9f0', '#b5179e'][k % 4], [cx - s * 2, cy], pop);
    if (pop) confetti(x, y, 14, s * 0.28, s * 0.045, k * 31);
  }
  for (let k = 0; k < 14; k++) sparkle(cx + (rnd(k, 21) - 0.5) * s * 2.2, cy + (rnd(k, 22) - 0.5) * s * 1.5, s * (0.03 + rnd(k, 23) * 0.04), k % 3 ? '#ffffff' : '#fff3b0');
  // outside enemies approaching (uncaptured)
  for (let k = 0; k < 6; k++) {
    const a = -0.4 + rnd(k, 31) * 1.4, d = s * (1.55 + rnd(k, 32) * 0.5);
    blob(cx + Math.cos(a) * d * 1.25, cy + Math.sin(a) * d * 0.85, s * (0.09 + rnd(k, 33) * 0.05), ['#8d99ae', '#ff9f1c', '#80ed99'][k % 3], [cx, cy]);
  }
  const head = loopStroke(cx, cy, s * 1.25, s * 0.95, s * 0.11, -2.4);
  // spark on the trail (danger!)
  const sx = cx + Math.cos(0.4) * s * 1.25, sy = cy + Math.sin(0.4) * s * 0.95;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, s * 0.22);
  g.addColorStop(0, 'rgba(255,209,102,1)');
  g.addColorStop(0.4, 'rgba(255,123,58,0.6)');
  g.addColorStop(1, 'rgba(255,123,58,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, s * 0.22, 0, TAU);
  ctx.fill();
  sparkle(sx, sy, s * 0.07, '#ffffff');
  pip(head[0], head[1], s * 0.2, -0.6);
}

function render() {
  switch (layout) {
    case 'logo':
      logo(W / 2, H * 0.58, W * 0.2, 'center', true, W * 0.9);
      break;
    case 'icon': {
      background();
      territory(W * 0.5, H * 0.55, W * 0.55, [[0, 0, 0.75], [0.3, -0.3, 0.5], [-0.35, 0.2, 0.45]], Math.max(4, W / 22));
      pip(W * 0.5, H * 0.52, W * 0.2, -0.7);
      break;
    }
    case 'small':
      background();
      territory(W * 0.84, H * 0.6, H * 0.5, [[0, 0, 1], [-0.5, 0.4, 0.6]], 7);
      pip(W * 0.86, H * 0.55, H * 0.14, -0.6);
      logo(W * 0.4, H * 0.68, H * 0.42, 'center', false, W * 0.72);
      break;
    case 'tall':
      background();
      scene(W * 0.52, H * 0.66, W * 0.3, true);
      logo(W / 2, H * 0.2, W * 0.2, 'center', true, W * 0.9);
      break;
    case 'hero':
      background();
      scene(W * 0.62, H * 0.52, H * 0.34, true);
      territory(W * 0.12, H * 0.9, H * 0.3, [[0, 0, 1.1], [1, 0.3, 0.7]], H * 0.03);
      break;
    case 'bg':
      background();
      ctx.globalAlpha = 0.5;
      scene(W * 0.7, H * 0.55, H * 0.3, true);
      ctx.globalAlpha = 1;
      break;
    default: { // wide
      background();
      scene(W * 0.74, H * 0.5, H * 0.3, true);
      const g = ctx.createLinearGradient(0, 0, W * 0.6, 0);
      g.addColorStop(0, 'rgba(15,13,21,0.85)');
      g.addColorStop(0.75, 'rgba(15,13,21,0.5)');
      g.addColorStop(1, 'rgba(15,13,21,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W * 0.6, H);
      logo(W * 0.29, H * 0.53, H * 0.26, 'center', true, W * 0.52);
    }
  }
  (window as any).__ready = true;
}

document.fonts.ready.then(() => document.fonts.load('700 40px Fredoka')).then(render);
