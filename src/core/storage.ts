// Save game persistence. Uses the Electron bridge (file in userData → Steam Auto-Cloud) when present,
// otherwise localStorage. All reads are defensive: a corrupt or missing save yields a fresh profile.

import type { Lang } from './i18n';

export type PigmentKey = 'crimson' | 'azure' | 'ochre' | 'violet' | 'verdant' | 'amber';
export const PRIMARY: PigmentKey[] = ['crimson', 'azure', 'ochre'];
export const SECONDARY: PigmentKey[] = ['violet', 'verdant', 'amber'];
export const MIX_RECIPES: Record<string, [PigmentKey, PigmentKey]> = {
  violet: ['crimson', 'azure'],
  verdant: ['azure', 'ochre'],
  amber: ['crimson', 'ochre'],
};

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  shake: number; // 0..1
  flashes: boolean;
  damageNumbers: boolean;
  lang: Lang;
  mouseMove: boolean;
  gameSpeed: number;
  colorblind: boolean;
}

export interface Stats {
  runs: number;
  wins: number;
  captures: number;
  kills: number;
  cells: number;
  bosses: number;
  playTime: number;
  bestScore: number;
  bestEndless: number;
  snaps: number;
  mixes: number;
  maxLoopCaptures: number;
  maxLoopPct: number;
  evolutions: string[];
  atelierBought: number;
  ochreEarned: number;
  dailies: number;
  winsByChar: string[];
}

export interface SaveData {
  version: 1;
  pigments: Record<PigmentKey, number>;
  atelier: Record<string, number>;
  unlocked: { weapons: string[]; relics: string[]; chars: string[] };
  stars: Record<string, boolean[]>;
  varnishUnlocked: number;
  stats: Stats;
  achievements: string[];
  codex: { enemies: string[]; relics: string[]; weapons: string[] };
  daily: { date: string; best: number };
  settings: Settings;
  tutorialDone: boolean;
  lastChar: string;
  lastVarnish: number;
}

export function freshSave(lang: Lang): SaveData {
  return {
    version: 1,
    pigments: { crimson: 0, azure: 0, ochre: 0, violet: 0, verdant: 0, amber: 0 },
    atelier: {},
    unlocked: { weapons: [], relics: [], chars: ['pip'] },
    stars: {},
    varnishUnlocked: 0,
    stats: {
      runs: 0, wins: 0, captures: 0, kills: 0, cells: 0, bosses: 0, playTime: 0, bestScore: 0, bestEndless: 0,
      snaps: 0, mixes: 0, maxLoopCaptures: 0, maxLoopPct: 0, evolutions: [], atelierBought: 0, ochreEarned: 0, dailies: 0,
      winsByChar: [],
    },
    achievements: [],
    codex: { enemies: [], relics: [], weapons: [] },
    daily: { date: '', best: 0 },
    settings: {
      master: 0.8, music: 0.6, sfx: 0.8, shake: 1, flashes: true, damageNumbers: true, lang,
      mouseMove: true, gameSpeed: 1, colorblind: false,
    },
    tutorialDone: false,
    lastChar: 'pip',
    lastVarnish: 0,
  };
}

const KEY = 'hueandclaim.save.v1';

interface NativeBridge {
  loadSave(): string | null;
  writeSave(data: string): void;
}
function native(): NativeBridge | null {
  return (window as any).hueNative ?? null;
}

/** Deep-merge loaded data onto a fresh template so new fields added in updates get defaults. */
function merge<T>(base: T, loaded: any): T {
  if (loaded === null || loaded === undefined) return base;
  if (Array.isArray(base)) return (Array.isArray(loaded) ? loaded : base) as T;
  if (typeof base === 'object' && base !== null) {
    const out: any = { ...base };
    for (const k of Object.keys(loaded)) {
      const bv = (base as any)[k];
      out[k] = bv !== undefined && typeof bv === 'object' && bv !== null && !Array.isArray(bv) ? merge(bv, loaded[k]) : loaded[k] ?? bv;
    }
    return out;
  }
  return (typeof loaded === typeof base ? loaded : base) as T;
}

export function loadSave(lang: Lang): SaveData {
  const fresh = freshSave(lang);
  try {
    const raw = native()?.loadSave() ?? localStorage.getItem(KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return fresh;
    return merge(fresh, parsed);
  } catch {
    return fresh;
  }
}

let pending: number | null = null;
export function writeSave(save: SaveData, immediate = false) {
  const doWrite = () => {
    pending = null;
    const json = JSON.stringify(save);
    try {
      const n = native();
      if (n) n.writeSave(json);
      localStorage.setItem(KEY, json);
    } catch {
      /* storage unavailable (private mode) — keep playing */
    }
  };
  if (immediate) {
    if (pending !== null) clearTimeout(pending);
    doWrite();
    return;
  }
  if (pending === null) pending = window.setTimeout(doWrite, 300);
}

export function wipeSave() {
  try {
    localStorage.removeItem(KEY);
    native()?.writeSave('');
  } catch {
    /* ignore */
  }
}
