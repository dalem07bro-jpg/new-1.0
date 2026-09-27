// Renders every achievement badge (unlocked + locked) into one sheet; scripts/achicons.mjs slices it.
import { ACHIEVEMENTS } from '../src/data/content';
import { iconPath } from '../src/render/icons';

export const ACH_ICON: Record<string, [string, string]> = {
  FIRST_LOOP: ['brush', '#ff5d8f'], CAPTURE_10: ['net', '#8ac926'], CAPTURE_50: ['net', '#06d6a0'], CAPTURE_150: ['net', '#ffd166'],
  LOOP_10PCT: ['map', '#4cc9f0'], LOOP_25PCT: ['map', '#c77dff'], BOSS_SMUDGE: ['crown', '#adb5bd'], BOSS_MIRE: ['drop', '#52b69a'],
  BOSS_ERASER: ['cross', '#f4f1de'], BOSS_WYRM: ['flame', '#ff7b3a'], WIN: ['trophy', '#ffd166'], WIN_V3: ['shield', '#4cc9f0'],
  WIN_V6: ['shield', '#c77dff'], WIN_V10: ['shield', '#ffd166'], WIN_ALL_CHARS: ['palette', '#ff5d8f'], STAGE_90: ['sun', '#fee440'],
  NO_SNAP: ['guard', '#caffbf'], FAST_STAGE: ['clock', '#fee440'], LEVEL_30: ['star', '#4cc9f0'], EVOLVE: ['prism', '#f15bb5'],
  EVOLVE_5: ['prism', '#c77dff'], EVOLVE_ALL: ['prism', '#ffd166'], RELICS_6: ['crown', '#9b5de5'], CAPTURES_1K: ['net', '#4cc9f0'],
  CAPTURES_10K: ['net', '#ffd166'], CELLS_1M: ['brush', '#ffd166'], MIXER: ['palette', '#9b5de5'], ATELIER_20: ['easel', '#f4a261'],
  STARS_10: ['star', '#fee440'], STARS_25: ['star', '#ffd166'], CLOSE_CALL: ['hourglass', '#ff4d6d'], TIGHT_LOOP: ['orbit', '#ff5d8f'],
  ENDLESS_2: ['orbit', '#c77dff'], DAILY: ['sun', '#fb8500'], SHRINE_3: ['eye', '#80ffdb'], NESTS_ALL: ['mine', '#9b5de5'],
};

const S = 64;
const cv = document.getElementById('c') as HTMLCanvasElement;
cv.width = S * ACHIEVEMENTS.length;
cv.height = S * 2;
const ctx = cv.getContext('2d')!;

function badge(x: number, y: number, icon: string, color: string, locked: boolean) {
  const c = locked ? '#6c6878' : color;
  const g = ctx.createRadialGradient(x + S / 2, y + S * 0.4, 2, x + S / 2, y + S / 2, S * 0.7);
  g.addColorStop(0, locked ? '#2a2733' : '#2f2640');
  g.addColorStop(1, '#0f0d15');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, S, S);
  // paint splash ring
  ctx.fillStyle = c;
  ctx.globalAlpha = locked ? 0.35 : 0.9;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + S / 2 + Math.cos(a) * S * 0.33, y + S / 2 + Math.sin(a) * S * 0.33, S * (k % 2 ? 0.07 : 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#17151f';
  ctx.beginPath();
  ctx.arc(x + S / 2, y + S / 2, S * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  const k = (S * 0.42) / 24;
  ctx.translate(x + S / 2 - 12 * k, y + S / 2 - 12 * k);
  ctx.scale(k, k);
  ctx.strokeStyle = locked ? '#8d8a96' : '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(iconPath(icon));
  ctx.restore();
}

ACHIEVEMENTS.forEach((a, i) => {
  const [icon, color] = ACH_ICON[a.id] ?? ['star', '#fff'];
  badge(i * S, 0, icon, color, false);
  badge(i * S, S, icon, color, true);
});
(window as any).__ids = ACHIEVEMENTS.map((a) => a.id);
(window as any).__ready = true;
