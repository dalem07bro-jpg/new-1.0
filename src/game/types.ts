import type { EnemyDef } from '../data/content';

export interface Enemy {
  uid: number;
  def: EnemyDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  elite: boolean;
  boss: boolean;
  dead: boolean;
  state: number;
  t: number; // generic timer
  t2: number;
  t3: number;
  dirX: number;
  dirY: number;
  flash: number;
  freeze: number;
  slow: number;
  spawnT: number;
  captureAt: number; // world time when the claim wave reaches it; -1 = not captured
  trailCd: number;
  orbCd: number;
  thornCd: number;
  golemCd: number;
  auraCd: number;
  hidden: boolean; // submerged boss etc. (untargetable)
  segs?: { x: number; y: number }[];
  hist?: { x: number; y: number }[];
  phase: number;
  knockX: number;
  knockY: number;
}

export interface Proj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  pierce: number;
  hostile: boolean;
  color: string;
  homing: number;
  split: boolean;
  hit: number[]; // uids already hit (pierce)
  kind: 'bolt' | 'ink' | 'mini';
}

export type PickupKind = 'xp' | 'crimson' | 'heart' | 'magnet' | 'chest' | 'ochre';
export interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: PickupKind;
  value: number;
  pulled: boolean;
  life: number;
  t: number;
}

export type FeatureKind = 'cache' | 'chest' | 'shrine' | 'flower';
export interface Feature {
  kind: FeatureKind;
  cell: number;
  x: number;
  y: number;
  taken: boolean;
  pending: number; // capture time
  value: number;
}

export interface Mine { x: number; y: number; life: number; arm: number }
export interface Turret { x: number; y: number; life: number; cd: number; ang: number }
export interface Golem { x: number; y: number; vx: number; vy: number; cd: number; tx: number; ty: number; retarget: number; bob: number }
export interface Drop { x: number; y: number; t: number; r: number; dmg: number }
export interface Puddle { x: number; y: number; r: number; life: number }
export interface Beam { x: number; y: number; ang: number; len: number; w: number; life: number; color: string }
export interface Shock { x: number; y: number; r: number; maxR: number; life: number; maxLife: number; color: string; width: number }
export interface Fissure { cells: number[]; phase: number; period: number; x: number; y: number }

export interface WeaponState {
  id: string;
  level: number;
  evolved: boolean;
  cd: number;
  cd2: number;
  ang: number;
}

export type Blessing = 'frenzy' | 'haste' | 'wisdom' | 'aegis';

export interface Card {
  kind: 'weapon' | 'passive' | 'evo' | 'heal' | 'pigment' | 'relic';
  id: string;
  rarity: number; // 0 common .. 3 legendary
  level: number;
  isNew: boolean;
}
