// Records a short WebM teaser of the staged "money shot" (lasso → flood → mass capture).
import { chromium } from '@playwright/test';
import fs from 'fs';
const out = process.argv[2] ?? 'steam/extras';
fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out + '/raw', size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto(base + '?autostart&god&level=3&seed=ms2&nohud');
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const g = window.__hue.game;
  g.tutorial = false; g.run.xp = -1e9; g.guardLeft = 999; g.time = 90;
  const cx = Math.min(g.W - 220, g.px + 260), cy = g.py;
  const def = window.__content.ENEMY.blot;
  for (let k = 0; k < 90; k++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 100;
    const e = g.spawnEnemy(def, cx + Math.cos(a) * d * 1.1, cy + Math.sin(a) * d * 0.9, false);
    e.state = 0; e.speed = 6; e.t3 = -999;
  }
  const pts = [];
  for (let k = 0; k <= 26; k++) { const a = Math.PI - (k / 26) * Math.PI * 2; pts.push([cx + Math.cos(a) * 140, cy + Math.sin(a) * 133]); }
  pts.push([g.px, g.py]);
  window.__wps = pts;
  setInterval(() => {
    const w = window.__wps[0];
    if (!w) { g.botMove = { x: 0, y: 0 }; return; }
    const dx = w[0] - g.px, dy = w[1] - g.py, d = Math.hypot(dx, dy);
    if (d < 12) { window.__wps.shift(); return; }
    g.botMove = { x: dx / d, y: dy / d };
  }, 16);
});
await page.waitForTimeout(15000);
const vpath = await page.video().path();
await ctx.close();
await browser.close();
fs.renameSync(vpath, out + '/money_shot.webm');
fs.rmSync(out + '/raw', { recursive: true, force: true });
console.log('saved', out + '/money_shot.webm', fs.statSync(out + '/money_shot.webm').size);
