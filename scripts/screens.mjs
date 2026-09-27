// Captures candidate store screenshots at 1920x1080 from bot-driven runs.
import { chromium } from '@playwright/test';
import fs from 'fs';
const base = process.env.BASE ?? 'http://localhost:5173/';
const out = process.argv[2] ?? 'shots';
fs.mkdirSync(out, { recursive: true });
const configs = JSON.parse(process.argv[3]);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader'] });
for (const [name, query, waitS, n, gap] of configs) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(base + '?' + query);
  await page.waitForTimeout(waitS * 1000);
  for (let i = 0; i < n; i++) {
    await page.screenshot({ path: `${out}/${name}_${i}.png` });
    await page.waitForTimeout(gap * 1000);
  }
  await page.close();
  console.log('✓', name);
}
await browser.close();
