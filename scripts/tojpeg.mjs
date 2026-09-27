// Converts PNGs to (optionally resized) JPEGs via headless Chromium. Usage: node scripts/tojpeg.mjs <out.jpg> <in.png> [width] [quality]
import { chromium } from '@playwright/test';
import fs from 'fs';
const jobs = JSON.parse(process.argv[2]); // [[in, out, width, quality], ...]
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
for (const [inp, out, width = 0, quality = 86] of jobs) {
  const b64 = fs.readFileSync(inp).toString('base64');
  await page.setContent(`<html><body style="margin:0;background:#0b0a10"><img id="i" src="data:image/png;base64,${b64}"></body></html>`);
  const dim = await page.evaluate(() => new Promise((r) => { const i = document.getElementById('i'); const go = () => r([i.naturalWidth, i.naturalHeight]); i.complete ? go() : (i.onload = go); }));
  const w = width || dim[0], h = Math.round((dim[1] * w) / dim[0]);
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(([w, h]) => { const i = document.getElementById('i'); i.style.width = w + 'px'; i.style.height = h + 'px'; i.style.display = 'block'; }, [w, h]);
  await page.screenshot({ path: out, type: 'jpeg', quality, clip: { x: 0, y: 0, width: w, height: h } });
}
await browser.close();
console.log(jobs.length, 'converted');
