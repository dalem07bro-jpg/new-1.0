// Procedural stage layout: terrain (rocks, bog, fissures, ruins) and capturable features.
import { Rng } from '../core/rng';
import type { BiomeDef } from '../data/content';
import { CELL, Grid, Terrain } from './grid';
import type { Feature, FeatureKind, Fissure } from './types';

export interface StageLayout {
  spawnX: number; // cell coords
  spawnY: number;
  features: Feature[];
  nests: { x: number; y: number }[]; // world coords
  sentinels: { x: number; y: number }[];
  fissures: Fissure[];
}

function blob(g: Grid, rng: Rng, cx: number, cy: number, r: number, t: Terrain) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (!g.inBounds(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy) + rng.range(-0.6, 0.6);
      if (d <= r) g.terrain[g.idx(x, y)] = t;
    }
  }
}

function clearDisc(g: Grid, cx: number, cy: number, r: number) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if (g.inBounds(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) g.terrain[g.idx(x, y)] = Terrain.Normal;
}

function rockClusters(g: Grid, rng: Rng, n: number, rMin: number, rMax: number) {
  for (let k = 0; k < n; k++) {
    const cx = rng.int(4, g.w - 5), cy = rng.int(4, g.h - 5);
    const parts = rng.int(1, 3);
    for (let p = 0; p < parts; p++) blob(g, rng, cx + rng.int(-3, 3), cy + rng.int(-3, 3), rng.range(rMin, rMax), Terrain.Rock);
  }
}

function ruins(g: Grid, rng: Rng, spawnX: number, spawnY: number) {
  // Rooms: rectangular rock outlines with 1-2 doorways. Great for "dip in to claim the whole room".
  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  for (let tries = 0; tries < 220 && rooms.length < 14; tries++) {
    const w = rng.int(12, 26), h = rng.int(10, 20);
    const x = rng.int(3, g.w - w - 4), y = rng.int(3, g.h - h - 4);
    if (Math.abs(x + w / 2 - spawnX) < w / 2 + 12 && Math.abs(y + h / 2 - spawnY) < h / 2 + 12) continue;
    if (rooms.some((r) => x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h + 4 && y + h + 4 > r.y)) continue;
    rooms.push({ x, y, w, h });
  }
  for (const r of rooms) {
    for (let x = r.x; x < r.x + r.w; x++) {
      g.terrain[g.idx(x, r.y)] = Terrain.Rock;
      g.terrain[g.idx(x, r.y + r.h - 1)] = Terrain.Rock;
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      g.terrain[g.idx(r.x, y)] = Terrain.Rock;
      g.terrain[g.idx(r.x + r.w - 1, y)] = Terrain.Rock;
    }
    const doors = rng.int(1, 2);
    for (let d = 0; d < doors; d++) {
      const side = rng.int(0, 3);
      const len = rng.int(3, 5);
      if (side < 2) {
        const x0 = rng.int(r.x + 2, r.x + r.w - 3 - len);
        const y = side === 0 ? r.y : r.y + r.h - 1;
        for (let x = x0; x < x0 + len; x++) g.terrain[g.idx(x, y)] = Terrain.Normal;
      } else {
        const y0 = rng.int(r.y + 2, r.y + r.h - 3 - len);
        const x = side === 2 ? r.x : r.x + r.w - 1;
        for (let y = y0; y < y0 + len; y++) g.terrain[g.idx(x, y)] = Terrain.Normal;
      }
    }
    // a few broken wall pieces for variety
    if (rng.chance(0.5)) blob(g, rng, r.x + rng.int(2, r.w - 3), r.y + rng.int(2, r.h - 3), 1.2, Terrain.Rock);
  }
  // scattered pillars
  for (let k = 0; k < 26; k++) {
    const x = rng.int(2, g.w - 3), y = rng.int(2, g.h - 3);
    g.terrain[g.idx(x, y)] = Terrain.Rock;
    if (rng.chance(0.5)) g.terrain[g.idx(x + 1, y)] = Terrain.Rock;
  }
}

function fissures(g: Grid, rng: Rng, spawnX: number, spawnY: number): Fissure[] {
  const out: Fissure[] = [];
  for (let k = 0; k < 11; k++) {
    let x = rng.int(6, g.w - 7), y = rng.int(6, g.h - 7);
    if (Math.hypot(x - spawnX, y - spawnY) < 16) continue;
    let ang = rng.range(0, Math.PI * 2);
    const cells: number[] = [];
    const len = rng.int(26, 48);
    for (let s = 0; s < len; s++) {
      ang += rng.range(-0.45, 0.45);
      x += Math.cos(ang);
      y += Math.sin(ang);
      const cx = Math.round(x), cy = Math.round(y);
      if (!g.inBounds(cx, cy) || cx < 2 || cy < 2 || cx > g.w - 3 || cy > g.h - 3) break;
      if (Math.hypot(cx - spawnX, cy - spawnY) < 12) break;
      const i = g.idx(cx, cy);
      if (g.terrain[i] === Terrain.Normal) {
        g.terrain[i] = Terrain.Fissure;
        cells.push(i);
      }
    }
    if (cells.length > 8) {
      const mid = cells[cells.length >> 1];
      out.push({ cells, phase: rng.range(0, 8), period: rng.range(7, 10), x: (mid % g.w) * CELL, y: Math.floor(mid / g.w) * CELL });
    }
  }
  return out;
}

export function generateStage(g: Grid, biome: BiomeDef, rng: Rng, stageIndex: number): StageLayout {
  const spawnX = Math.floor(g.w / 2 + rng.int(-g.w / 6, g.w / 6));
  const spawnY = Math.floor(g.h / 2 + rng.int(-g.h / 6, g.h / 6));
  let fis: Fissure[] = [];

  switch (biome.id) {
    case 'meadows':
      rockClusters(g, rng, 7, 1.2, 2.6);
      break;
    case 'marsh':
      for (let k = 0; k < 22; k++) blob(g, rng, rng.int(4, g.w - 5), rng.int(4, g.h - 5), rng.range(3, 8), Terrain.Bog);
      rockClusters(g, rng, 4, 1, 2);
      break;
    case 'ruins':
      ruins(g, rng, spawnX, spawnY);
      break;
    case 'ember':
      rockClusters(g, rng, 9, 1.5, 3.2);
      fis = fissures(g, rng, spawnX, spawnY);
      break;
    case 'hollow':
      rockClusters(g, rng, 5, 1, 2.2);
      for (let k = 0; k < 8; k++) blob(g, rng, rng.int(4, g.w - 5), rng.int(4, g.h - 5), rng.range(2, 5), Terrain.Bog);
      break;
  }
  // always leave the spawn area open
  clearDisc(g, spawnX, spawnY, 9);
  g.recountClaimable();

  const features: Feature[] = [];
  const taken = new Set<number>();
  const place = (kind: FeatureKind, n: number, minDist: number, value: number) => {
    let tries = 0;
    while (n > 0 && tries++ < 600) {
      const x = rng.int(3, g.w - 4), y = rng.int(3, g.h - 4);
      const i = g.idx(x, y);
      if (g.terrain[i] === Terrain.Rock || taken.has(i)) continue;
      if (Math.hypot(x - spawnX, y - spawnY) < minDist) continue;
      if (features.some((f) => Math.hypot((f.cell % g.w) - x, Math.floor(f.cell / g.w) - y) < 7)) continue;
      taken.add(i);
      features.push({ kind, cell: i, x: x * CELL + CELL / 2, y: y * CELL + CELL / 2, taken: false, pending: -1, value });
      n--;
    }
  };
  place('cache', 11, 12, 3 + stageIndex);
  place('chest', 3, 22, 1);
  place('shrine', stageIndex >= 1 ? 2 : 1, 26, 1);
  place('flower', 2, 18, 1);

  const nests: { x: number; y: number }[] = [];
  const nestCount = 2 + Math.min(3, stageIndex);
  for (let tries = 0; tries < 400 && nests.length < nestCount; tries++) {
    const x = rng.int(6, g.w - 7), y = rng.int(6, g.h - 7);
    if (g.terrain[g.idx(x, y)] === Terrain.Rock) continue;
    if (Math.hypot(x - spawnX, y - spawnY) < 30) continue;
    if (nests.some((n) => Math.hypot(n.x / CELL - x, n.y / CELL - y) < 25)) continue;
    nests.push({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 });
  }
  const sentinels: { x: number; y: number }[] = [];
  if (biome.id === 'ruins' || biome.id === 'hollow') {
    const n = biome.id === 'ruins' ? 7 : 3;
    for (let tries = 0; tries < 400 && sentinels.length < n; tries++) {
      const x = rng.int(5, g.w - 6), y = rng.int(5, g.h - 6);
      if (g.terrain[g.idx(x, y)] === Terrain.Rock) continue;
      if (Math.hypot(x - spawnX, y - spawnY) < 24) continue;
      sentinels.push({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 });
    }
  }
  return { spawnX, spawnY, features, nests, sentinels, fissures: fis };
}
