// Store screenshots of UI moments: title screen and a level-up with an evolution on offer.
import { chromium } from '@playwright/test';
import fs from 'fs';
const out = process.argv[2] ?? 'shots';
const lang = process.argv[3] ?? 'en-US';
fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: lang });
let page = await ctx.newPage();
await page.goto(base);
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/title.png` });
await page.close();
page = await ctx.newPage();
await page.goto(base + '?autostart&god&level=14&relics=2&seed=lv1&time=120&fill=30');
await page.waitForTimeout(9000);
await page.evaluate(() => {
  const m = window.__hue;
  const run = m.run;
  let bolt = run.weapon('bolt');
  if (!bolt) { run.weapons.push({ id: 'bolt', level: 5, evolved: false, cd: 0, cd2: 0, ang: 0 }); bolt = run.weapon('bolt'); }
  bolt.level = 5;
  if (!run.passives.has('prism')) run.passives.set('prism', { level: 1, value: 1 });
  run.recompute();
  const cards = [
    { kind: 'evo', id: 'bolt', rarity: 3, level: 6, isNew: false },
    { kind: 'weapon', id: 'golems', rarity: 2, level: 1, isNew: true },
    { kind: 'passive', id: 'capture', rarity: 1, level: 1, isNew: !run.passives.has('capture') },
    { kind: 'passive', id: 'quickdry', rarity: 0, level: 1, isNew: !run.passives.has('quickdry') },
  ];
  m.game.run.xp = -1e9;
  m.game.tutorial = false;
  m.ui.levelUp(run, cards, 'level', () => {});
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/levelup.png` });
await browser.close();
console.log('ok');
