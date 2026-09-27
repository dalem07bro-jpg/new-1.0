// Usage: node scripts/shot.mjs "<query>" <seconds> <outPrefix> [shots]
import { chromium } from '@playwright/test';
const [,, query = 'bot&god', secs = '10', out = 'shot', nShots = '3'] = process.argv;
const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || t.startsWith('RUN_END') || t.startsWith('ERR')) errors.push(`[${m.type()}] ${t}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + e.stack));
await page.goto(base + '?' + query);
const total = Number(secs) * 1000, n = Number(nShots);
for (let i = 1; i <= n; i++) {
  await page.waitForTimeout(total / n);
  await page.screenshot({ path: `${out}_${i}.png` });
}
const info = await page.evaluate(() => {
  const m = window.__hue; const g = m.game ?? m.attract;
  if (!g) return null;
  return { time: g.time.toFixed(1), pct: (g.percent * 100).toFixed(1), enemies: g.enemies.length, hp: Math.round(g.hp), level: g.run.level, captures: g.run.stats.captures, kills: g.run.stats.kills, loops: g.run.stats.loops, snaps: g.run.stats.snaps, stage: g.run.stageIdx, boss: !!g.boss, parts: g.parts.count };
});
console.log(JSON.stringify(info));
console.log(errors.slice(0, 20).join('\n'));
await browser.close();
