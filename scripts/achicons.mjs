// Slices the achievement sheet into Steam's 64x64 JPG icons (achieved + unachieved).
import { chromium } from '@playwright/test';
import fs from 'fs';
const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'steam/achievements/icons';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 2400, height: 200 } });
await page.goto(base + 'tools/achicons.html');
await page.waitForFunction(() => window.__ready === true);
const ids = await page.evaluate(() => window.__ids);
for (let i = 0; i < ids.length; i++) {
  await page.screenshot({ path: `${out}/${ids[i]}.jpg`, type: 'jpeg', quality: 92, clip: { x: i * 64, y: 0, width: 64, height: 64 } });
  await page.screenshot({ path: `${out}/${ids[i]}_locked.jpg`, type: 'jpeg', quality: 92, clip: { x: i * 64, y: 64, width: 64, height: 64 } });
}
await page.screenshot({ path: 'steam/achievements/sheet.png', clip: { x: 0, y: 0, width: ids.length * 64, height: 128 } });
console.log(ids.length, 'achievements rendered');
await browser.close();
