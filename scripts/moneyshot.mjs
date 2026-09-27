// Scripted "money shot": a herd grazes, the painter lassos it, the wave floods and everything pops.
// Usage: node scripts/moneyshot.mjs <outDir> <name> "<query>" <herdSize> [boss]
import { chromium } from '@playwright/test';
import fs from 'fs';
const [,, out = 'shots', name = 'money', query = 'autostart&god&level=16&seed=ms1', herd = '70', boss = ''] = process.argv;
fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(base + '?' + query);
await page.waitForTimeout(2500);
// set up the scene
await page.evaluate(({ herd, boss }) => {
  const m = window.__hue;
  const g = m.game;
  g.time = Math.max(g.time, 90);
  const cx = Math.min(g.W - 220, g.px + 300), cy = g.py;
  const blotDef = g.enemies.map((e) => e.def).find((d) => d.id === 'blot');
  window.__scene = { cx, cy, r: 150 };
  g.tutorial = false;
  g.run.xp = -1e9; // no level-up modal in the middle of the shot
  g.guardLeft = 999; // the staged shot shouldn't be ruined by a stray spark
  for (let k = 0; k < herd; k++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 110;
    const def = blotDef ?? g.enemies[0].def;
    const e = g.spawnEnemy(def, cx + Math.cos(a) * d * 1.1, cy + Math.sin(a) * d * 0.9, false);
    e.state = 0; e.speed = 4; e.spawnT = 0; e.t3 = -999;
  }
  // steering: out to the circle, around it, back home
  const pts = [];
  const R = window.__scene.r;
  const a0 = Math.PI;
  for (let k = 0; k <= 26; k++) { const a = a0 - (k / 26) * Math.PI * 2; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.95]); }
  pts.push([g.px, g.py]);
  window.__wps = pts;
  window.__steer = setInterval(() => {
    const w = window.__wps[0];
    if (!w) { g.botMove = { x: 0, y: 0 }; return; }
    const dx = w[0] - g.px, dy = w[1] - g.py, d = Math.hypot(dx, dy);
    if (d < 12) { window.__wps.shift(); return; }
    g.botMove = { x: dx / d, y: dy / d };
  }, 16);
}, { herd: Number(herd), boss: !!boss });
// wait for the loop to close, then shoot the flood
let shots = 0;
const t0 = Date.now();
let closedAt = 0;
while (Date.now() - t0 < 30000 && shots < 6) {
  const st = await page.evaluate(() => ({ trail: window.__hue.game.grid.trail.length, reveals: window.__hue.game.reveals.length, left: window.__wps.length }));
  if (!closedAt && st.left <= 1 && st.trail === 0 && st.reveals > 0 && shots >= 1) closedAt = Date.now();
  if (st.left <= 6 && st.left > 1 && shots === 0) { await page.screenshot({ path: `${out}/${name}_lasso.png` }); shots++; }
  if (closedAt) {
    await page.waitForTimeout(shots === 1 ? 110 : 90);
    await page.screenshot({ path: `${out}/${name}_flood${shots}.png` });
    shots++;
  } else await page.waitForTimeout(40);
}
console.log(name, 'shots:', shots);
await browser.close();
