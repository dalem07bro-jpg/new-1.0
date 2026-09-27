// Run-wide state (persists across stages): character, build, level, relics, pigments, and derived stats.
import { Rng } from '../core/rng';
import type { SaveData } from '../core/storage';
import { BIOMES, CHARS, PASSIVES, RELICS, WEAPONS, type CharDef } from '../data/content';
import type { Blessing, Card, WeaponState } from './types';

export type Mode = 'journey' | 'endless' | 'daily';

export interface PlayerStats {
  maxHp: number;
  speed: number;
  armor: number;
  damage: number;
  cooldown: number;
  area: number;
  proj: number;
  crit: number;
  critMult: number;
  pickup: number;
  xpMult: number;
  pigMult: number;
  fuseMult: number;
  guard: number;
  regen: number;
  holy: number;
  captureXp: number;
  dashCd: number;
  luck: number;
  choices: number;
}

export const RARITY_MULT = [1, 1.4, 1.8, 2.5];
export const MAX_WEAPONS = 5;
export const MAX_PASSIVES = 6;
export const WEAPON_MAX_LEVEL = 5;

export const BASE_WEAPONS = ['swipe', 'bolt', 'orbit', 'thorns', 'splash'];

export function atelierLevel(save: SaveData, id: string) {
  return save.atelier[id] ?? 0;
}

export class Run {
  char: CharDef;
  varnish: number;
  mode: Mode;
  seed: number;
  rng: Rng;
  stageOrder: string[];
  stageIdx = 0;
  cycle = 0;
  level = 1;
  xp = 0;
  pendingLevels = 0;
  weapons: WeaponState[] = [];
  passives = new Map<string, { level: number; value: number }>();
  relics: string[] = [];
  banished = new Set<string>();
  rerolls: number;
  banishes: number;
  revives: number;
  blessing: { kind: Blessing; t: number } | null = null;
  pig = { crimson: 0, azure: 0, ochre: 0 };
  stats = {
    kills: 0, captures: 0, cells: 0, bosses: 0, snaps: 0, loops: 0, time: 0, shrines: 0,
    maxLoopCaptures: 0, maxLoopPct: 0, evolutions: [] as string[], score: 0, stagesCleared: 0,
  };
  s!: PlayerStats;
  readonly save: SaveData;

  constructor(save: SaveData, charId: string, varnish: number, mode: Mode, seed: number) {
    this.save = save;
    this.char = CHARS.find((c) => c.id === charId) ?? CHARS[0];
    this.varnish = varnish;
    this.mode = mode;
    this.seed = seed;
    this.rng = new Rng(seed);
    const middle = this.rng.shuffle(['marsh', 'ruins', 'ember']);
    this.stageOrder = ['meadows', ...middle, 'hollow'];
    this.rerolls = 1 + atelierLevel(save, 'reroll');
    this.banishes = atelierLevel(save, 'banish');
    this.revives = atelierLevel(save, 'revive');
    this.weapons.push({ id: this.char.weapon, level: 1, evolved: false, cd: 0.5, cd2: 0, ang: 0 });
    this.pendingLevels = atelierLevel(save, 'headstart');
    this.recompute();
  }

  get biomeId() {
    return this.stageOrder[this.stageIdx % this.stageOrder.length];
  }
  get biome() {
    return BIOMES.find((b) => b.id === this.biomeId)!;
  }
  get isFinalStage() {
    return this.stageIdx === this.stageOrder.length - 1;
  }

  pv(id: string) {
    return this.passives.get(id)?.value ?? 0;
  }
  pl(id: string) {
    return this.passives.get(id)?.level ?? 0;
  }
  has(relic: string) {
    return this.relics.includes(relic);
  }
  weapon(id: string) {
    return this.weapons.find((w) => w.id === id);
  }

  recompute() {
    const a = (id: string) => atelierLevel(this.save, id);
    const c = this.char;
    const bl = this.blessing?.kind;
    let maxHp = c.hp + a('vitality') * 10 + this.pv('thickcoat');
    if (this.varnish >= 5) maxHp *= 0.8;
    const thorns = this.weapon('thorns');
    const thornGuard = thorns ? (thorns.level >= 5 ? 3 : thorns.level >= 3 ? 2 : 1) : 0;
    this.s = {
      maxHp: Math.round(maxHp),
      speed: c.speed * (1 + a('bristles') * 0.03 + this.pv('swift') + (bl === 'haste' ? 0.3 : 0)),
      armor: Math.min(0.7, c.armor + a('armor') * 0.03 + this.pv('varnish') + (bl === 'aegis' ? 0.4 : 0)),
      damage: 1 + a('vibrance') * 0.05 + this.pv('vibrance') + (this.has('crown') ? 0.15 : 0) + (bl === 'frenzy' ? 0.4 : 0),
      cooldown: Math.max(0.35, (1 - this.pv('tempo')) * (bl === 'frenzy' ? 0.75 : 1)),
      area: 1 + (c.mods?.area ?? 0) + this.pv('spill') + (this.has('lens') ? 0.2 : 0),
      proj: Math.round(this.pv('prism')),
      crit: this.pv('palette') + (this.has('crit') ? 0.15 : 0),
      critMult: 2 + (this.has('crit') ? 0.5 : 0),
      pickup: 90 * (1 + a('magnet') * 0.15 + this.pv('magnet')),
      xpMult: (1 + a('muse') * 0.05 + this.pv('muse') + (this.has('lens') ? 0.1 : 0)) * (bl === 'wisdom' ? 2 : 1),
      pigMult: 1 + a('fortune') * 0.08 + this.pv('fortune') + (this.has('midas') ? 0.5 : 0) + this.varnish * 0.15,
      fuseMult: Math.max(0.3, (1 - a('quickdry') * 0.05) * (1 - this.pv('quickdry')) * (this.has('hourglass') ? 0.7 : 1) * (this.varnish >= 2 ? 1.15 : 1)),
      guard: Math.round(this.pv('guard')) + a('guard') + (this.has('mirror') ? 2 : 0) + thornGuard,
      regen: this.pv('hearth') + (this.has('sun') ? 3 : 0),
      holy: this.pv('holy'),
      captureXp: 1 + this.pv('capture'),
      dashCd: 2.6 * (1 + (c.mods?.dashCd ?? 0)) * (1 - this.pv('dash')) * (this.has('boots') ? 0.6 : 1),
      luck: a('luck') * 0.05 + this.pv('fortune') * 0.5 + (this.has('coin') ? 0.6 : 0),
      choices: 3 + (this.has('easel') ? 1 : 0),
    };
  }

  xpNeed(level = this.level) {
    return Math.floor(5 + level * 4 + Math.pow(level, 1.75) * 0.5);
  }

  unlockedWeapons(): string[] {
    return WEAPONS.filter((w) => !w.unlockCost || this.save.unlocked.weapons.includes(w.id)).map((w) => w.id);
  }
  unlockedRelics(): string[] {
    return RELICS.filter((r) => !r.cost || this.save.unlocked.relics.includes(r.id)).map((r) => r.id);
  }

  private rollRarity(minRarity: number) {
    const luck = this.s.luck;
    const r = this.rng.next();
    const leg = 0.012 + luck * 0.03, epic = 0.06 + luck * 0.08, rare = 0.22 + luck * 0.12;
    let rar = r < leg ? 3 : r < leg + epic ? 2 : r < leg + epic + rare ? 1 : 0;
    return Math.max(rar, minRarity);
  }

  /** Build level-up / chest choices. */
  offer(n: number, minRarity = 0): Card[] {
    const cands: Card[] = [];
    const evos: Card[] = [];
    for (const w of this.weapons) {
      if (w.evolved) continue;
      const def = WEAPONS.find((d) => d.id === w.id)!;
      if (w.level >= WEAPON_MAX_LEVEL) {
        if (this.passives.has(def.evo.passive)) evos.push({ kind: 'evo', id: w.id, rarity: 3, level: 6, isNew: false });
      } else if (!this.banished.has(w.id)) cands.push({ kind: 'weapon', id: w.id, rarity: 0, level: w.level + 1, isNew: false });
    }
    if (this.weapons.length < MAX_WEAPONS) {
      for (const id of this.unlockedWeapons()) {
        if (this.weapon(id) || this.banished.has(id)) continue;
        cands.push({ kind: 'weapon', id, rarity: 0, level: 1, isNew: true });
      }
    }
    for (const p of PASSIVES) {
      if (this.banished.has(p.id)) continue;
      const cur = this.passives.get(p.id);
      if (cur) {
        if (cur.level < p.max) cands.push({ kind: 'passive', id: p.id, rarity: 0, level: cur.level + 1, isNew: false });
      } else if (this.passives.size < MAX_PASSIVES) cands.push({ kind: 'passive', id: p.id, rarity: 0, level: 1, isNew: true });
    }
    const out: Card[] = [];
    if (evos.length) out.push(evos[0]);
    // weight owned things a little higher so builds come together
    const pool = cands.slice();
    while (out.length < n && pool.length) {
      const pick = this.rng.weighted(pool, (c) => (c.isNew ? 1 : 1.35));
      pool.splice(pool.indexOf(pick), 1);
      pick.rarity = this.rollRarity(minRarity);
      out.push(pick);
    }
    while (out.length < n) {
      const kind = out.some((c) => c.kind === 'heal') ? 'pigment' : 'heal';
      out.push({ kind, id: kind, rarity: 0, level: 0, isNew: false });
    }
    return out;
  }

  applyCard(card: Card): { healFrac: number; hpGain: number } {
    let healFrac = 0, hpGain = 0;
    switch (card.kind) {
      case 'weapon': {
        const w = this.weapon(card.id);
        const inc = card.rarity >= 2 ? 2 : 1;
        if (w) w.level = Math.min(WEAPON_MAX_LEVEL, w.level + inc);
        else this.weapons.push({ id: card.id, level: Math.min(WEAPON_MAX_LEVEL, inc), evolved: false, cd: 0.3, cd2: 0, ang: 0 });
        if (!this.save.codex.weapons.includes(card.id)) this.save.codex.weapons.push(card.id);
        break;
      }
      case 'evo': {
        const w = this.weapon(card.id);
        if (w) {
          w.evolved = true;
          w.level = WEAPON_MAX_LEVEL;
          this.stats.evolutions.push(card.id);
        }
        break;
      }
      case 'passive': {
        const def = PASSIVES.find((p) => p.id === card.id)!;
        const cur = this.passives.get(card.id) ?? { level: 0, value: 0 };
        const amt = def.fmt === 'int' ? def.per : def.per * RARITY_MULT[card.rarity];
        cur.level++;
        cur.value += amt;
        this.passives.set(card.id, cur);
        if (card.id === 'thickcoat') hpGain = amt;
        break;
      }
      case 'heal':
        healFrac = 0.35;
        break;
      case 'pigment':
        this.pig.ochre += 12;
        break;
    }
    this.recompute();
    return { healFrac, hpGain };
  }

  /** Value shown on a passive card for its rarity. */
  static passiveAmount(id: string, rarity: number) {
    const def = PASSIVES.find((p) => p.id === id)!;
    return def.fmt === 'int' ? def.per : def.per * RARITY_MULT[rarity];
  }

  relicOffer(n: number): string[] {
    const pool = this.unlockedRelics().filter((r) => !this.relics.includes(r));
    this.rng.shuffle(pool);
    return pool.slice(0, n);
  }

  addRelic(id: string) {
    if (this.relics.includes(id)) return;
    this.relics.push(id);
    if (!this.save.codex.relics.includes(id)) this.save.codex.relics.push(id);
    if (id === 'heart') this.revives++;
    if (id === 'dice') this.rerolls += 2;
    if (id === 'crown') {
      const weakest = this.weapons.filter((w) => w.level < WEAPON_MAX_LEVEL).sort((a, b) => a.level - b.level)[0];
      if (weakest) weakest.level++;
    }
    this.recompute();
  }

  /** Difficulty multipliers for the current stage. */
  get hpMult() {
    return (1 + 0.55 * (this.stageIdx % 5)) * (1 + 1.6 * this.cycle) * (this.varnish >= 1 ? 1.25 : 1);
  }
  get dmgMult() {
    return (1 + 0.2 * (this.stageIdx % 5)) * (1 + 0.5 * this.cycle);
  }
  get bossHpMult() {
    return (1 + 0.15 * (this.stageIdx % 5)) * (1 + 1.6 * this.cycle) * (this.varnish >= 1 ? 1.25 : 1) * (this.varnish >= 8 ? 1.4 : 1);
  }
}
