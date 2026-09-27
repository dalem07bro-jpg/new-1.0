// Exports achievement metadata (EN/DE) for Steamworks setup: steam/achievements/achievements.json + .csv
import fs from 'fs';
import { build } from 'vite';
const out = await build({ logLevel: 'silent', build: { write: false, ssr: 'src/data/content.ts', rollupOptions: { output: { format: 'es' } } } });
const code = out.output[0].code;
const tmp = 'scripts/.content.tmp.mjs';
fs.writeFileSync(tmp, code);
const { ACHIEVEMENTS } = await import('./.content.tmp.mjs');
fs.unlinkSync(tmp);
const rows = ACHIEVEMENTS.map((a, i) => ({
  apiName: a.id, order: i + 1,
  name_en: a.name.en, desc_en: a.desc.en, name_de: a.name.de, desc_de: a.desc.de,
  icon: `icons/${a.id}.jpg`, icon_gray: `icons/${a.id}_locked.jpg`, hidden: false,
}));
fs.writeFileSync('steam/achievements/achievements.json', JSON.stringify(rows, null, 2));
const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
fs.writeFileSync('steam/achievements/achievements.csv', ['apiName,order,name_en,desc_en,name_de,desc_de,icon,icon_gray', ...rows.map((r) => [r.apiName, r.order, r.name_en, r.desc_en, r.name_de, r.desc_de, r.icon, r.icon_gray].map(esc).join(','))].join('\n'));
console.log(rows.length, 'achievements exported');
