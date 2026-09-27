// Renders every Steam graphical asset from tools/keyart.html at the exact sizes Steamworks asks for.
import { chromium } from '@playwright/test';
import fs from 'fs';
const base = process.env.BASE ?? 'http://localhost:5173/';
const out = 'steam/assets';
fs.mkdirSync(out, { recursive: true });
const assets = [
  ['header_capsule', 920, 430, 'wide'],
  ['small_capsule', 462, 174, 'small'],
  ['main_capsule', 1232, 706, 'wide'],
  ['vertical_capsule', 748, 896, 'tall'],
  ['page_background', 1438, 810, 'bg'],
  ['library_capsule', 600, 900, 'tall'],
  ['library_header', 920, 430, 'wide'],
  ['library_hero', 3840, 1240, 'hero'],
  ['library_logo', 1280, 720, 'logo'],
  ['event_cover', 800, 450, 'wide'],
  ['event_header', 1920, 622, 'wide'],
  ['community_icon', 184, 184, 'icon'],
  ['icon_256', 256, 256, 'icon'],
  ['og_image', 1200, 630, 'wide'],
];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [name, w, h, layout] of assets) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${base}tools/keyart.html?w=${w}&h=${h}&layout=${layout}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(100);
  const el = await page.$('#c');
  await el.screenshot({ path: `${out}/${name}.png`, omitBackground: layout === 'logo' });
  await page.close();
  console.log('✓', name, `${w}x${h}`);
}
await browser.close();
