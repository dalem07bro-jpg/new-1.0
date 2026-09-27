// Headless balance probe: lets the autopilot play real (non-god) runs and reports how far it gets.
import { chromium } from '@playwright/test';
const base = process.env.BASE ?? 'http://localhost:5173/';
const runs = Number(process.argv[2] ?? 2);
const query = process.argv[3] ?? 'bot&fast=4';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (let r = 0; r < runs; r++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  let result = null;
  page.on('console', (m) => { if (m.text().startsWith('RUN_END')) result = JSON.parse(m.text().slice(8)); });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(`${base}?${query}&seed=bal${r}`);
  const t0 = Date.now();
  while (!result && Date.now() - t0 < 280000) await page.waitForTimeout(2000);
  if (!result) result = await page.evaluate(() => { const g = window.__hue.game; return { timeout: true, stage: g.run.stageIdx, t: g.time, pct: g.percent, level: g.run.level }; });
  console.log(JSON.stringify({ run: r, stage: result.stage, victory: result.victory, level: result.level, time: result.stats?.time?.toFixed?.(0), caps: result.stats?.captures, kills: result.stats?.kills, snaps: result.stats?.snaps, extra: result.timeout ? result : undefined }));
  await page.close();
}
await browser.close();
