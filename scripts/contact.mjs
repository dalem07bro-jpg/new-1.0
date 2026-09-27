// Builds a contact sheet (grid of thumbnails) from PNGs for quick review.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
const [,, dir, pattern = '', outFile = 'contact.png', cols = '3'] = process.argv;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && f.includes(pattern)).sort();
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}"><figcaption>${f}</figcaption></figure>`).join('');
const html = `<html><body style="margin:0;background:#111;color:#fff;font:14px sans-serif;display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px">${imgs}<style>figure{margin:0}img{width:100%;display:block}</style></body></html>`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1800, height: 800 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
console.log(files.length, 'images →', outFile);
