// Meta progression: atelier purchases, pigment mixing, atlas stars, unlocks, achievements, run banking.
import { MIX_RECIPES, type PigmentKey, type SaveData } from '../core/storage';
import { ACHIEVEMENTS, ATELIER, BIOMES, CHARS, WEAPONS, type AtelierDef, type Cost } from '../data/content';
import type { Run } from './run';

export function atelierCost(def: AtelierDef, level: number): Cost {
  const out: Cost = {};
  for (const [k, v] of Object.entries(def.base) as [PigmentKey, number][]) out[k] = Math.round(v * Math.pow(def.growth, level));
  return out;
}

export function canAfford(save: SaveData, cost: Cost) {
  return (Object.entries(cost) as [PigmentKey, number][]).every(([k, v]) => save.pigments[k] >= v);
}

export function pay(save: SaveData, cost: Cost) {
  for (const [k, v] of Object.entries(cost) as [PigmentKey, number][]) save.pigments[k] -= v;
}

export function buyAtelier(save: SaveData, id: string): boolean {
  const def = ATELIER.find((a) => a.id === id);
  if (!def) return false;
  const lvl = save.atelier[id] ?? 0;
  if (lvl >= def.max) return false;
  const cost = atelierCost(def, lvl);
  if (!canAfford(save, cost)) return false;
  pay(save, cost);
  save.atelier[id] = lvl + 1;
  save.stats.atelierBought++;
  return true;
}

export function mix(save: SaveData, target: PigmentKey, times: number): number {
  const recipe = MIX_RECIPES[target];
  if (!recipe) return 0;
  let done = 0;
  for (let k = 0; k < times; k++) {
    if (save.pigments[recipe[0]] < 5 || save.pigments[recipe[1]] < 5) break;
    save.pigments[recipe[0]] -= 5;
    save.pigments[recipe[1]] -= 5;
    save.pigments[target] += 2;
    done++;
  }
  save.stats.mixes += done;
  return done;
}

export function starCount(save: SaveData) {
  let n = 0;
  for (const b of BIOMES) for (const s of save.stars[b.id] ?? []) if (s) n++;
  return n;
}
export const STAR_TOTAL = BIOMES.length * 5;
export function starBonus(save: SaveData) {
  return starCount(save) * 0.02;
}

/** Record stars for a cleared stage. Returns indices that are newly earned. */
export function awardStars(save: SaveData, biomeId: string, conds: boolean[]): number[] {
  const cur = save.stars[biomeId] ?? [false, false, false, false, false];
  const out: number[] = [];
  conds.forEach((ok, i) => {
    if (ok && !cur[i]) {
      cur[i] = true;
      out.push(i);
    }
  });
  save.stars[biomeId] = cur;
  return out;
}

/** Returns ids of characters newly unlocked. */
export function checkCharUnlocks(save: SaveData): string[] {
  const out: string[] = [];
  const st = save.stats;
  const rules: Record<string, boolean> = {
    vera: st.captures >= 300,
    bruno: st.bosses >= 2,
    mona: st.maxLoopPct >= 0.15,
  };
  for (const c of CHARS) {
    if (save.unlocked.chars.includes(c.id)) continue;
    if (rules[c.id]) {
      save.unlocked.chars.push(c.id);
      out.push(c.id);
    }
  }
  return out;
}

export function isAchieved(save: SaveData, id: string) {
  return save.achievements.includes(id);
}

/** Unlock an achievement (and forward to Steam when running in the desktop build). */
export function grantAchievement(save: SaveData, id: string): boolean {
  if (!ACHIEVEMENTS.some((a) => a.id === id) || save.achievements.includes(id)) return false;
  save.achievements.push(id);
  try {
    (window as any).hueNative?.achievement?.(id);
  } catch {
    /* ignore */
  }
  return true;
}

/** Achievements derived from lifetime stats; returns newly granted ids. */
export function checkLifetimeAchievements(save: SaveData): string[] {
  const out: string[] = [];
  const st = save.stats;
  const tryGrant = (id: string, cond: boolean) => {
    if (cond && grantAchievement(save, id)) out.push(id);
  };
  tryGrant('CAPTURES_1K', st.captures >= 1000);
  tryGrant('CAPTURES_10K', st.captures >= 10000);
  tryGrant('CELLS_1M', st.cells >= 1_000_000);
  tryGrant('MIXER', st.mixes >= 1);
  tryGrant('ATELIER_20', st.atelierBought >= 20);
  const stars = starCount(save);
  tryGrant('STARS_10', stars >= 10);
  tryGrant('STARS_25', stars >= STAR_TOTAL);
  const evoKinds = new Set(st.evolutions);
  tryGrant('EVOLVE', evoKinds.size >= 1);
  tryGrant('EVOLVE_5', evoKinds.size >= 5);
  tryGrant('EVOLVE_ALL', WEAPONS.every((w) => evoKinds.has(w.id)));
  return out;
}

export interface RunSummary {
  victory: boolean;
  pigments: { crimson: number; azure: number; ochre: number };
  unlockedChars: string[];
  varnishUnlocked: number | null;
  endlessUnlocked: boolean;
  achievements: string[];
  score: number;
  dailyBest: boolean;
}

/** Bank a finished run into the save. */
export function finishRun(save: SaveData, run: Run, victory: boolean, dailyKey?: string): RunSummary {
  const bonus = 1 + starBonus(save);
  const pig = {
    crimson: Math.floor(run.pig.crimson * bonus),
    azure: Math.floor(run.pig.azure * bonus),
    ochre: Math.floor(run.pig.ochre * bonus),
  };
  save.pigments.crimson += pig.crimson;
  save.pigments.azure += pig.azure;
  save.pigments.ochre += pig.ochre;
  save.stats.runs++;
  for (const e of run.stats.evolutions) if (!save.stats.evolutions.includes(e)) save.stats.evolutions.push(e);
  const achievements: string[] = [];
  const grant = (id: string) => {
    if (grantAchievement(save, id)) achievements.push(id);
  };
  let varnishUnlocked: number | null = null;
  let endlessUnlocked = false;
  const score = Math.floor(run.stats.score + (victory ? 10000 : 0));
  if (victory && run.mode !== 'endless') {
    if (save.stats.wins === 0) endlessUnlocked = true;
    save.stats.wins++;
    grant('WIN');
    if (run.varnish >= 3) grant('WIN_V3');
    if (run.varnish >= 6) grant('WIN_V6');
    if (run.varnish >= 10) grant('WIN_V10');
    if (run.varnish >= save.varnishUnlocked && save.varnishUnlocked < 10) {
      save.varnishUnlocked = run.varnish + 1;
      varnishUnlocked = save.varnishUnlocked;
    }
    if (!save.stats.winsByChar.includes(run.char.id)) save.stats.winsByChar.push(run.char.id);
    if (CHARS.every((c) => save.stats.winsByChar.includes(c.id))) grant('WIN_ALL_CHARS');
  }
  if (run.mode === 'endless') {
    const stageReached = run.cycle * 5 + run.stageIdx + 1;
    save.stats.bestEndless = Math.max(save.stats.bestEndless, stageReached);
    if (run.cycle >= 1) grant('ENDLESS_2');
  }
  if (run.relics.length >= 6) grant('RELICS_6');
  save.stats.bestScore = Math.max(save.stats.bestScore, score);
  let dailyBest = false;
  if (run.mode === 'daily' && dailyKey) {
    save.stats.dailies++;
    grant('DAILY');
    if (save.daily.date !== dailyKey) save.daily = { date: dailyKey, best: 0 };
    if (score > save.daily.best) {
      save.daily.best = score;
      dailyBest = true;
    }
  }
  achievements.push(...checkLifetimeAchievements(save));
  const unlockedChars = checkCharUnlocks(save);
  return { victory, pigments: pig, unlockedChars, varnishUnlocked, endlessUnlocked, achievements, score, dailyBest };
}

export function todayKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
