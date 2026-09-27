// Stage simulation: player movement, trail & loop claims, sparks (fuses), enemies, pickups, bosses.
import { audio } from '../core/audio';
import { input } from '../core/input';
import { clamp, dist2, TAU } from '../core/math';
import { Rng } from '../core/rng';
import { ANOMALIES, ENEMY, type AnomalyDef, type BiomeDef, type EnemyDef } from '../data/content';
import { updateEnemy } from './ai';
import { Particles, Texts } from './fx';
import { CELL, Grid, Terrain, type ClaimResult } from './grid';
import { generateStage } from './mapgen';
import type { Run } from './run';
import type {
  Beam, Blessing, Card, Drop, Enemy, Feature, Fissure, Golem, Mine, Pickup, PickupKind, Proj, Puddle, Shock, Turret,
} from './types';
import { updateWeapons, onClaimWeapons } from './weapons';

export interface GameHooks {
  levelUp(cards: Card[], title: 'level' | 'chest'): void;
  stageClear(): void;
  gameOver(victory: boolean): void;
  announce(text: string, sub?: string, color?: string): void;
  achievement(id: string): void;
}

export interface RevealBatch {
  cells: number[];
  times: Float32Array;
  idx: number;
  color?: string;
}

const PLAYER_R = 8;

export class Game {
  run: Run;
  biome: BiomeDef;
  grid: Grid;
  rng: Rng;
  hooks: GameHooks;
  time = 0;
  realTime = 0;
  // player
  px = 0;
  py = 0;
  pvx = 0;
  pvy = 0;
  facing = 0;
  hp = 100;
  invuln = 0;
  dashT = 0;
  dashCd = 0;
  specialCd = 0;
  boldT = 0;
  wallT = 0;
  hurtFlash = 0;
  guardLeft = 0;
  lastCx = -1;
  lastCy = -1;
  onOwned = true;
  moving = false;
  trailPts: number[] = [];
  trailPtIdx: number[] = [];
  fuse = -1; // trail index of the spark (float), -1 = none
  fuseStart = -1;
  dashHit = new Set<number>();
  // world
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  pickups: Pickup[] = [];
  features: Feature[] = [];
  mines: Mine[] = [];
  turrets: Turret[] = [];
  golems: Golem[] = [];
  drops: Drop[] = [];
  puddles: Puddle[] = [];
  beams: Beam[] = [];
  shocks: Shock[] = [];
  fissures: Fissure[] = [];
  parts = new Particles();
  texts = new Texts();
  reveals: RevealBatch[] = [];
  claimTime: Float32Array;
  private claimStamp: Int32Array;
  private claimDist: Float32Array;
  private claimId = 0;
  private uidSeq = 1;
  // spatial hash
  private bucket = 64;
  private bCols: number;
  private bRows: number;
  private bHead: Int32Array;
  private bNext: Int32Array = new Int32Array(1024);
  // director
  spawnAcc = 0;
  nextTide = 45;
  boss: Enemy | null = null;
  bossSpawned = false;
  stageCleared = false;
  clearT = 0;
  over = false;
  goal: number;
  stageSnaps = 0;
  stageMaxLoopCaptures = 0;
  nestsTotal = 0;
  nestsCaptured = 0;
  loopCounter = 0;
  fadeAcc = 0;
  // camera (written by renderer, read for mouse aim)
  camX = 0;
  camY = 0;
  zoom = 1;
  shake = 0;
  hitStop = 0;
  flash = 0;
  combo = 0;
  comboT = 0;
  lastLoopCaptures = 0;
  private loopCaptureCount = 0;
  private loopCaptureT = 0;
  bossBar = 0;
  tutorial = false;
  tutorialStep = 0;
  anomaly: AnomalyDef | null = null;
  private stormT = 6;
  stormMarks: { x: number; y: number; t: number }[] = [];

  constructor(run: Run, hooks: GameHooks, tutorial = false) {
    this.run = run;
    this.hooks = hooks;
    this.tutorial = tutorial;
    this.biome = run.biome;
    this.rng = new Rng(run.seed * 31 + run.stageIdx * 977 + run.cycle * 7919);
    this.grid = new Grid(this.biome.w, this.biome.h);
    this.claimTime = new Float32Array(this.grid.size).fill(-99);
    this.claimStamp = new Int32Array(this.grid.size);
    this.claimDist = new Float32Array(this.grid.size);
    this.goal = this.biome.goal + (run.varnish >= 6 ? 0.05 : 0);
    const layout = generateStage(this.grid, this.biome, this.rng, run.stageIdx % 5);
    this.features = layout.features;
    this.fissures = layout.fissures;
    if (!tutorial && (run.stageIdx >= 1 || run.cycle > 0) && this.rng.chance(run.mode === 'endless' ? 0.85 : 0.6)) {
      this.anomaly = this.rng.pick(ANOMALIES);
    }
    if (this.anomaly?.id === 'treasure') {
      const extra = generateStage(new Grid(this.biome.w, this.biome.h), this.biome, this.rng, run.stageIdx % 5).features;
      for (const f of extra) {
        if ((f.kind === 'chest' || f.kind === 'cache') && this.grid.terrain[f.cell] !== Terrain.Rock && !this.features.some((o) => o.cell === f.cell)) this.features.push(f);
      }
    }
    this.px = layout.spawnX * CELL + CELL / 2;
    this.py = layout.spawnY * CELL + CELL / 2;
    const start = this.grid.claimDisc(layout.spawnX + 0.5, layout.spawnY + 0.5, 6.5);
    this.pushReveal(start, start.map((c) => Math.hypot((c % this.grid.w) - layout.spawnX, Math.floor(c / this.grid.w) - layout.spawnY)), 30);
    for (const n of layout.nests) this.spawnEnemy(ENEMY.nest, n.x, n.y, false);
    for (const s of layout.sentinels) this.spawnEnemy(ENEMY.sentinel, s.x, s.y, false);
    this.nestsTotal = layout.nests.length;
    this.bCols = Math.ceil((this.grid.w * CELL) / this.bucket);
    this.bRows = Math.ceil((this.grid.h * CELL) / this.bucket);
    this.bHead = new Int32Array(this.bCols * this.bRows);
    this.hp = run.s.maxHp;
    this.guardLeft = run.s.guard;
    this.camX = this.px;
    this.camY = this.py;
  }

  get pigAnomaly() {
    return this.anomaly?.id === 'golden' ? 2 : 1;
  }

  get W() {
    return this.grid.w * CELL;
  }
  get H() {
    return this.grid.h * CELL;
  }
  get percent() {
    return this.grid.percent;
  }

  // ------------------------------------------------------------------ helpers
  pushReveal(cells: number[], dist: number[], speed: number, color?: string) {
    const times = new Float32Array(cells.length);
    for (let k = 0; k < cells.length; k++) times[k] = this.time + dist[k] / speed;
    // sort by time (dist already mostly sorted)
    const order = cells.map((_, k) => k).sort((a, b) => times[a] - times[b]);
    const c2 = order.map((k) => cells[k]);
    const t2 = new Float32Array(order.map((k) => times[k]));
    this.reveals.push({ cells: c2, times: t2, idx: 0, color });
  }

  spawnEnemy(def: EnemyDef, x: number, y: number, elite: boolean): Enemy {
    const run = this.run;
    const tmin = this.time / 60;
    const isBoss = def.ai === 'boss';
    let hp = isBoss ? (def.bossHp ?? 1000) * run.bossHpMult : def.hp * run.hpMult * (1 + tmin * 0.13);
    if (elite) hp *= 3.2;
    const giant = this.anomaly?.id === 'giants' && !isBoss && def.ai !== 'nest' && def.ai !== 'turret';
    if (giant) hp *= 1.6;
    const speedMul = (run.varnish >= 7 ? 1.12 : 1) * (1 + 0.04 * (run.stageIdx % 5));
    const e: Enemy = {
      uid: this.uidSeq++, def, x, y, vx: 0, vy: 0, r: def.r * (elite ? 1.35 : 1) * (giant ? 1.3 : 1), hp, maxHp: hp,
      speed: def.speed * speedMul * (elite ? 0.92 : 1) * this.rng.range(0.92, 1.08), dmg: def.dmg * run.dmgMult * (elite ? 1.4 : 1),
      elite, boss: isBoss, dead: false, state: 0, t: this.rng.range(0, 1), t2: 0, t3: 0, dirX: 0, dirY: 0, flash: 0,
      freeze: 0, slow: 0, spawnT: isBoss ? 1.2 : 0.35, captureAt: -1, trailCd: 0, orbCd: 0, thornCd: 0, golemCd: 0, auraCd: 0,
      hidden: false, phase: 0, knockX: 0, knockY: 0,
    };
    if (def.id === 'wyrm') {
      e.segs = [];
      e.hist = [];
      for (let k = 0; k < 20; k++) e.segs.push({ x, y });
    }
    this.enemies.push(e);
    const codex = run.save.codex.enemies;
    if (!codex.includes(def.id)) codex.push(def.id);
    return e;
  }

  private rebuildHash() {
    this.bHead.fill(-1);
    if (this.bNext.length < this.enemies.length) this.bNext = new Int32Array(this.enemies.length * 2);
    const b = this.bucket;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const cx = clamp((e.x / b) | 0, 0, this.bCols - 1), cy = clamp((e.y / b) | 0, 0, this.bRows - 1);
      const k = cy * this.bCols + cx;
      this.bNext[i] = this.bHead[k];
      this.bHead[k] = i;
    }
  }

  /** Enemies whose centers are within r (+their radius) of (x,y). */
  query(x: number, y: number, r: number, out: Enemy[] = []): Enemy[] {
    out.length = 0;
    const b = this.bucket;
    const x0 = clamp(((x - r - 60) / b) | 0, 0, this.bCols - 1), x1 = clamp(((x + r + 60) / b) | 0, 0, this.bCols - 1);
    const y0 = clamp(((y - r - 60) / b) | 0, 0, this.bRows - 1), y1 = clamp(((y + r + 60) / b) | 0, 0, this.bRows - 1);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let i = this.bHead[cy * this.bCols + cx];
        while (i >= 0) {
          const e = this.enemies[i];
          if (!e.dead && !e.hidden) {
            const rr = r + e.r;
            if (dist2(x, y, e.x, e.y) <= rr * rr) out.push(e);
          }
          i = this.bNext[i];
        }
      }
    }
    return out;
  }

  nearestEnemy(x: number, y: number, maxR = 600, exclude?: Set<number>): Enemy | null {
    let best: Enemy | null = null, bd = maxR * maxR;
    for (const e of this.enemies) {
      if (e.dead || e.hidden || e.captureAt >= 0 || e.spawnT > 0.2 || e.def.immune) continue;
      if (exclude && exclude.has(e.uid)) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  isRockWorld(x: number, y: number) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    return this.grid.isRockAt(cx, cy);
  }
  cellAt(x: number, y: number) {
    return this.grid.cellAtWorld(x, y);
  }

  shakeIt(a: number) {
    this.shake = Math.min(18, this.shake + a);
  }

  // ------------------------------------------------------------------ damage & death
  damageEnemy(e: Enemy, amount: number, kx = 0, ky = 0, color = '#fff', canCrit = true): number {
    if (e.dead || e.hidden || e.spawnT > 0.25) return 0;
    if (e.def.immune) {
      if (e.flash <= 0) this.texts.add(e.x, e.y - e.r, '∅', '#e0aaff', 12, 0.4);
      e.flash = 0.05;
      return 0;
    }
    let dmg = amount * this.run.s.damage;
    let crit = false;
    if (canCrit && this.rng.chance(this.run.s.crit)) {
      dmg *= this.run.s.critMult;
      crit = true;
    }
    e.hp -= dmg;
    e.flash = 0.08;
    if (!e.boss && e.def.ai !== 'nest' && e.def.ai !== 'turret') {
      e.knockX += kx;
      e.knockY += ky;
    }
    if (this.run.save.settings.damageNumbers && (dmg >= 4 || crit)) {
      this.texts.add(e.x + this.rng.range(-6, 6), e.y - e.r - 4, String(Math.round(dmg)), crit ? '#ffd166' : color === '#fff' ? '#ffffff' : color, crit ? 16 : 12, 0.55, -55);
    }
    audio.hit();
    if (e.hp <= 0) this.killEnemy(e, false);
    return dmg;
  }

  killEnemy(e: Enemy, captured: boolean) {
    if (e.dead) return;
    e.dead = true;
    const run = this.run;
    const col = captured ? this.rng.pick(this.biome.pal.land) : e.def.color;
    if (e.boss) {
      this.onBossDefeated(e);
      return;
    }
    run.stats[captured ? 'captures' : 'kills']++;
    run.save.stats[captured ? 'captures' : 'kills']++;
    const xp = e.def.xp * (e.elite ? 5 : 1) * (captured ? 1.5 * run.s.captureXp : 1) * (this.anomaly?.id === 'giants' ? 2 : this.anomaly?.id === 'swarm' ? 1.3 : 1);
    this.dropPickup(e.x, e.y, 'xp', xp, captured);
    const pigChance = captured ? 0.32 : 0.2;
    if (this.rng.chance(pigChance) || e.elite) this.dropPickup(e.x, e.y, 'crimson', e.elite ? 4 : 1, captured);
    if (this.rng.chance(0.022)) this.dropPickup(e.x, e.y, 'heart', 1, false);
    if (this.rng.chance(0.004)) this.dropPickup(e.x, e.y, 'magnet', 1, false);
    if (e.def.ai === 'nest' || e.def.ai === 'turret' || (e.elite && this.rng.chance(0.45))) {
      this.dropPickup(e.x, e.y, 'chest', 1, false);
      if (e.def.ai === 'nest' && captured) {
        this.nestsCaptured++;
        if (this.nestsCaptured >= this.nestsTotal && this.nestsTotal > 0) this.hooks.achievement('NESTS_ALL');
      }
    }
    if (e.def.splits && !captured) {
      for (let k = 0; k < 2; k++) {
        const c = this.spawnEnemy(ENEMY.blot, e.x + this.rng.range(-8, 8), e.y + this.rng.range(-8, 8), false);
        c.spawnT = 0.05;
      }
    }
    this.parts.burst(e.x, e.y, captured ? 14 : 9, col, captured ? 170 : 130, 0.5, captured ? 4 : 3, captured ? 2 : 0);
    if (captured) {
      this.parts.burst(e.x, e.y, 5, '#ffffff', 90, 0.4, 2, 3);
      audio.capture();
      if (run.has('lacquer')) {
        this.lacquerAcc = (this.lacquerAcc ?? 0) + 1;
        if (this.lacquerAcc >= 2) { this.lacquerAcc = 0; this.heal(1); }
      }
      if (run.has('twin')) this.fireBolt(e.x, e.y, 12, '#00bbf9');
    } else audio.kill();
    run.stats.score += captured ? 12 : 5;
  }
  private lacquerAcc = 0;

  fireBolt(x: number, y: number, dmg: number, color: string, split = false) {
    const t = this.nearestEnemy(x, y, 420);
    let ang = this.rng.range(0, TAU);
    if (t) ang = Math.atan2(t.y - y, t.x - x);
    this.projs.push({ x, y, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, r: 5, dmg, life: 1.4, pierce: 0, hostile: false, color, homing: 7, split, hit: [], kind: 'bolt' });
  }

  heal(n: number) {
    const before = this.hp;
    this.hp = Math.min(this.run.s.maxHp, this.hp + n);
    if (this.hp - before >= 5) this.texts.add(this.px, this.py - 18, '+' + Math.round(this.hp - before), '#7bd88f', 13, 0.8);
  }

  damagePlayer(amount: number, fromX: number, fromY: number) {
    if (this.invuln > 0 || this.dashT > 0 || this.over || this.stageCleared) return;
    const dmg = amount * (1 - this.run.s.armor);
    this.hp -= dmg;
    this.invuln = 0.55;
    this.hurtFlash = 0.25;
    audio.hurt();
    this.shakeIt(5);
    const a = Math.atan2(this.py - fromY, this.px - fromX);
    this.pvx += Math.cos(a) * 160;
    this.pvy += Math.sin(a) * 160;
    this.texts.add(this.px, this.py - 16, '-' + Math.round(dmg), '#ff4d6d', 15, 0.7);
    this.parts.burst(this.px, this.py, 8, '#ff4d6d', 120, 0.4, 3);
    if (this.hp <= 0) this.onPlayerDown();
  }

  private onPlayerDown() {
    const run = this.run;
    if (run.revives > 0) {
      run.revives--;
      this.hp = run.s.maxHp * 0.5;
      this.invuln = 3;
      this.flash = 0.6;
      this.hooks.announce(this.lang('REVIVED'), '', '#ffd166');
      for (const e of this.query(this.px, this.py, 260)) this.damageEnemy(e, 200, 0, 0, '#ffd166', false);
      this.shocks.push({ x: this.px, y: this.py, r: 10, maxR: 280, life: 0.6, maxLife: 0.6, color: '#ffd166', width: 10 });
      audio.levelUp();
      return;
    }
    this.hp = 0;
    this.over = true;
    audio.fuseStop();
    audio.defeat();
    this.parts.burst(this.px, this.py, 60, this.run.char.color, 260, 1.2, 5, 2);
    setTimeout(() => this.hooks.gameOver(false), 1300);
  }

  lang(key: 'REVIVED' | 'TIDE' | 'SNAP' | 'BOSS' | 'GOAL') {
    const de = this.run.save.settings.lang === 'de';
    switch (key) {
      case 'REVIVED': return de ? 'WIEDERBELEBT!' : 'REVIVED!';
      case 'TIDE': return de ? 'Eine graue Flut naht!' : 'A grey tide approaches!';
      case 'SNAP': return de ? 'RISS!' : 'SNAP!';
      case 'BOSS': return de ? 'erscheint!' : 'emerges!';
      case 'GOAL': return de ? 'Ziel erreicht' : 'Goal reached';
    }
  }

  dropPickup(x: number, y: number, kind: PickupKind, value: number, pulled: boolean) {
    const a = this.rng.range(0, TAU), s = this.rng.range(30, 90);
    this.pickups.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, kind, value, pulled, life: kind === 'xp' ? 60 : 40, t: 0 });
  }

  // ------------------------------------------------------------------ main update
  update(dt: number) {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.12;
    }
    this.realTime += dt;
    if (this.over) {
      this.parts.update(dt);
      this.texts.update(dt);
      return;
    }
    this.time += dt;
    this.run.stats.time += dt;
    this.run.save.stats.playTime += dt;
    this.rebuildHash();
    this.updatePlayer(dt);
    this.updateFuse(dt);
    if (!this.stageCleared) {
      this.updateDirector(dt);
      this.updateBiome(dt);
    }
    for (const e of this.enemies) if (!e.dead) updateEnemy(this, e, dt);
    this.separate();
    updateWeapons(this, dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateFeatures();
    this.updateMisc(dt);
    this.parts.update(dt);
    this.texts.update(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.loopCaptureT > 0) {
      this.loopCaptureT -= dt;
      if (this.loopCaptureT <= 0) this.finishLoopCaptures();
    }
    // blessings
    const bl = this.run.blessing;
    if (bl) {
      bl.t -= dt;
      if (bl.t <= 0) {
        this.run.blessing = null;
        this.run.recompute();
      }
    }
    // level ups
    while (this.run.xp >= this.run.xpNeed()) {
      this.run.xp -= this.run.xpNeed();
      this.run.level++;
      this.run.pendingLevels++;
      if (this.run.level >= 30) this.hooks.achievement('LEVEL_30');
    }
    if (this.run.pendingLevels > 0 && !this.over) {
      this.run.pendingLevels--;
      audio.levelUp();
      this.heal(this.run.s.maxHp * 0.08);
      this.hooks.levelUp(this.run.offer(this.run.s.choices), 'level');
    }
    // stage flow
    if (!this.bossSpawned && !this.stageCleared && this.percent >= this.goal) this.spawnBoss();
    if (this.stageCleared) {
      this.clearT += dt;
      if (this.clearT > 3.2 && !this.over) {
        this.over = true;
        this.hooks.stageClear();
      }
    }
    // music intensity
    const n = this.enemies.length;
    audio.intensity = clamp(n / 120 + (this.boss ? 0.5 : 0) + this.time / 600, 0, 1);
  }

  private updatePlayer(dt: number) {
    const run = this.run;
    const s = run.s;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.specialCd = Math.max(0, this.specialCd - dt);
    this.boldT = Math.max(0, this.boldT - dt);
    this.wallT = Math.max(0, this.wallT - dt);
    if (this.stageCleared) {
      this.pvx *= 0.9;
      this.pvy *= 0.9;
      return;
    }

    let mv = input.move();
    if (mv.x === 0 && mv.y === 0 && input.mouseDown && run.save.settings.mouseMove) {
      const wx = (input.mouseX - window.innerWidth / 2) / this.zoom + this.camX;
      const wy = (input.mouseY - window.innerHeight / 2) / this.zoom + this.camY;
      const dx = wx - this.px, dy = wy - this.py;
      const d = Math.hypot(dx, dy);
      if (d > 8) mv = { x: dx / d, y: dy / d };
    }
    if (this.botMove) mv = this.botMove;
    this.moving = mv.x !== 0 || mv.y !== 0;
    if (this.moving) this.facing = Math.atan2(mv.y, mv.x);

    const cell = this.cellAt(this.px, this.py);
    const owned = cell >= 0 && this.grid.owned[cell] === 1;
    this.onOwned = owned;
    let spd = s.speed;
    if (cell >= 0 && !owned && this.grid.terrain[cell] === Terrain.Bog) spd *= 0.62;
    if (!owned && run.has('compass')) spd *= 1.18;
    if (this.boldT > 0) spd *= 1.35;

    // dash
    if ((input.dashPressed() || this.botDash) && this.dashCd <= 0 && this.moving) {
      this.dashT = 0.17;
      this.dashCd = s.dashCd;
      this.dashHit.clear();
      audio.dash();
      this.parts.burst(this.px, this.py, 10, '#ffffff', 80, 0.3, 3);
    }
    this.botDash = false;
    if ((input.specialPressed() || this.botSpecial) && this.specialCd <= 0) this.useSpecial();
    this.botSpecial = false;

    let tvx = mv.x * spd, tvy = mv.y * spd;
    if (this.dashT > 0) {
      this.dashT -= dt;
      tvx = Math.cos(this.facing) * spd * 3.3;
      tvy = Math.sin(this.facing) * spd * 3.3;
      if (this.frameCount++ % 2 === 0) this.parts.spawn(this.px, this.py, 0, 0, 0.25, PLAYER_R, run.char.color, 0, 0);
      if (run.has('boots')) {
        for (const e of this.query(this.px, this.py, PLAYER_R + 6)) {
          if (!this.dashHit.has(e.uid)) {
            this.dashHit.add(e.uid);
            this.damageEnemy(e, 40, Math.cos(this.facing) * 200, Math.sin(this.facing) * 200);
          }
        }
      }
    }
    // smooth acceleration, knockback decays
    const acc = this.dashT > 0 ? 1 : Math.min(1, dt * 14);
    this.pvx += (tvx - this.pvx) * acc;
    this.pvy += (tvy - this.pvy) * acc;

    // move with rock collision (axis separated)
    const nx = this.px + this.pvx * dt;
    if (!this.collidesRock(nx, this.py)) this.px = nx;
    else this.pvx = 0;
    const ny = this.py + this.pvy * dt;
    if (!this.collidesRock(this.px, ny)) this.py = ny;
    else this.pvy = 0;
    this.px = clamp(this.px, PLAYER_R, this.W - PLAYER_R);
    this.py = clamp(this.py, PLAYER_R, this.H - PLAYER_R);

    // trail & claims
    const cx = Math.floor(this.px / CELL), cy = Math.floor(this.py / CELL);
    if (this.lastCx < 0) {
      this.lastCx = cx;
      this.lastCy = cy;
    }
    if (cx !== this.lastCx || cy !== this.lastCy) {
      const res = this.grid.walk(this.lastCx, this.lastCy, cx, cy, () => {
        this.trailPtIdx.push(this.trailPts.length / 2);
      });
      this.lastCx = cx;
      this.lastCy = cy;
      if (res === 'closed') this.closeLoop();
    }
    if (this.grid.trail.length > 0) {
      const n = this.trailPts.length;
      if (n === 0 || Math.hypot(this.trailPts[n - 2] - this.px, this.trailPts[n - 1] - this.py) > 5) this.trailPts.push(this.px, this.py);
    } else if (this.trailPts.length) {
      this.trailPts.length = 0;
      this.trailPtIdx.length = 0;
    }

    // regen on land
    if (owned && s.regen > 0) this.hp = Math.min(s.maxHp, this.hp + s.regen * dt);
  }
  private frameCount = 0;
  botMove: { x: number; y: number } | null = null;
  botDash = false;
  botSpecial = false;

  private collidesRock(x: number, y: number) {
    const r = PLAYER_R * 0.8;
    return this.isRockWorld(x - r, y - r) || this.isRockWorld(x + r, y - r) || this.isRockWorld(x - r, y + r) || this.isRockWorld(x + r, y + r);
  }

  private useSpecial() {
    const run = this.run;
    this.specialCd = run.char.special.cd * Math.max(0.5, run.s.cooldown);
    audio.special();
    const col = run.char.color;
    switch (run.char.id) {
      case 'pip':
        this.boldT = 3;
        this.parts.burst(this.px, this.py, 24, col, 180, 0.6, 4, 2);
        break;
      case 'vera': {
        const cx = this.px / CELL, cy = this.py / CELL;
        const cells = this.grid.claimDisc(cx, cy, 7.5);
        const dist = cells.map((c) => Math.hypot((c % this.grid.w) + 0.5 - cx, Math.floor(c / this.grid.w) + 0.5 - cy));
        this.applyClaim(cells, dist, 0, cells.length);
        this.shocks.push({ x: this.px, y: this.py, r: 10, maxR: 85, life: 0.5, maxLife: 0.5, color: col, width: 8 });
        break;
      }
      case 'bruno':
        this.wallT = 6;
        this.shocks.push({ x: this.px, y: this.py, r: 10, maxR: 160, life: 0.5, maxLife: 0.5, color: col, width: 10 });
        break;
      case 'mona': {
        const target = this.grid.nearestOwned(this.px / CELL, this.py / CELL, 200);
        if (target < 0) break;
        const tx = target % this.grid.w, ty = Math.floor(target / this.grid.w);
        this.parts.burst(this.px, this.py, 20, col, 160, 0.5, 4, 3);
        if (this.grid.trail.length > 0) {
          const res = this.grid.walk(this.lastCx, this.lastCy, tx, ty, () => this.trailPtIdx.push(this.trailPts.length / 2));
          this.trailPts.push(tx * CELL + CELL / 2, ty * CELL + CELL / 2);
          this.px = tx * CELL + CELL / 2;
          this.py = ty * CELL + CELL / 2;
          this.lastCx = tx;
          this.lastCy = ty;
          if (res === 'closed') this.closeLoop();
        } else {
          this.px = tx * CELL + CELL / 2;
          this.py = ty * CELL + CELL / 2;
          this.lastCx = tx;
          this.lastCy = ty;
        }
        this.invuln = Math.max(this.invuln, 0.4);
        this.parts.burst(this.px, this.py, 20, col, 160, 0.5, 4, 3);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ claims
  private closeLoop() {
    const grid = this.grid;
    const fuseWasNear = this.fuse >= 0 && grid.trail.length - this.fuse < 10;
    const closedTrail = grid.trail.slice();
    const res: ClaimResult = grid.closeTrail();
    this.clearFuse();
    this.trailPts.length = 0;
    this.trailPtIdx.length = 0;
    this.guardLeft = this.run.s.guard;
    if (res.cells.length === 0) return;
    if (fuseWasNear) this.hooks.achievement('CLOSE_CALL');
    this.applyClaim(res.cells, res.dist, res.trailCount, res.cells.length);
    onClaimWeapons(this, closedTrail, res);
  }

  /** Shared by loop closing and ability claims: reveal wave, captures, features, rewards. */
  applyClaim(cells: number[], dist: number[], trailCount: number, total: number) {
    if (cells.length === 0) return;
    const run = this.run;
    const maxDist = dist.reduce((m, d) => (d > m ? d : m), 0);
    const speed = Math.max(55, maxDist / 0.75);
    const id = ++this.claimId;
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k];
      this.claimStamp[c] = id;
      this.claimDist[c] = dist[k];
      this.claimTime[c] = this.time + dist[k] / speed;
    }
    this.pushReveal(cells, dist, speed);
    const pct = total / this.grid.claimable;
    const opus = run.has('opus') && pct >= 0.04 ? 2 : 1;

    // captures
    let captured = 0;
    let bossFrac = 0;
    for (const e of this.enemies) {
      if (e.dead || e.captureAt >= 0 || e.hidden) continue;
      const c = this.cellAt(e.x, e.y);
      if (c < 0 || this.claimStamp[c] !== id) continue;
      const at = this.time + this.claimDist[c] / speed + 0.05;
      if (e.boss) {
        const frac = clamp(0.3 * Math.sqrt(110 / Math.max(1, total)), 0.06, 0.3) * opus;
        e.captureAt = at;
        e.t3 = frac; // stash capture fraction
        bossFrac = frac;
      } else {
        e.captureAt = at;
        captured++;
      }
    }
    for (const f of this.features) {
      if (f.taken || f.pending >= 0) continue;
      if (this.claimStamp[f.cell] === id) f.pending = this.time + this.claimDist[f.cell] / speed + 0.05;
    }
    if (bossFrac >= 0.2) this.hooks.achievement('TIGHT_LOOP');

    // rewards
    run.stats.cells += total;
    run.save.stats.cells += total;
    run.stats.score += total;
    run.xp += total * 0.06 * run.s.xpMult * opus * (this.anomaly?.id === 'storm' ? 1.5 : 1);
    if (this.anomaly?.id === 'bloom' && trailCount > 0) this.heal(Math.min(12, 2 + total / 80));
    const az = (total / 70) * run.s.pigMult * opus * this.pigAnomaly;
    run.pig.azure += az;
    if (trailCount > 0) {
      run.stats.loops++;
      this.loopCounter++;
      this.hooks.achievement('FIRST_LOOP');
    }
    run.stats.maxLoopPct = Math.max(run.stats.maxLoopPct, pct);
    run.save.stats.maxLoopPct = Math.max(run.save.stats.maxLoopPct, pct);
    if (pct >= 0.1) this.hooks.achievement('LOOP_10PCT');
    if (pct >= 0.25) this.hooks.achievement('LOOP_25PCT');
    if (captured > 0) {
      this.loopCaptureCount += captured;
      this.loopCaptureT = maxDist / speed + 0.4;
    }
    // juice
    audio.claim(total, this.biome.root);
    this.shakeIt(Math.min(10, 2 + total / 150));
    if (total >= 30) {
      this.texts.add(this.px, this.py - 26, '+' + (pct * 100).toFixed(pct < 0.01 ? 2 : 1) + '%', this.biome.pal.edge, 16 + Math.min(14, total / 120), 1.1, -30);
    }
    if (captured >= 20) this.hitStop = 0.09;
    // relic effects
    if (run.has('stilllife')) for (const e of this.query(this.px, this.py, 420)) e.freeze = Math.max(e.freeze, 1);
    if (run.has('bomb') && trailCount > 0 && this.loopCounter % 6 === 0) {
      this.shocks.push({ x: this.px, y: this.py, r: 20, maxR: 520, life: 0.7, maxLife: 0.7, color: '#ef476f', width: 16 });
      for (const e of this.query(this.px, this.py, 520)) this.damageEnemy(e, 90, 0, 0, '#ef476f');
      audio.boom();
      this.shakeIt(12);
    }
    if (this.tutorial && trailCount > 0 && this.tutorialStep < 2) this.tutorialStep = 2;
  }

  private finishLoopCaptures() {
    const n = this.loopCaptureCount;
    this.loopCaptureCount = 0;
    if (n <= 0) return;
    const run = this.run;
    this.lastLoopCaptures = n;
    run.stats.maxLoopCaptures = Math.max(run.stats.maxLoopCaptures, n);
    run.save.stats.maxLoopCaptures = Math.max(run.save.stats.maxLoopCaptures, n);
    this.stageMaxLoopCaptures = Math.max(this.stageMaxLoopCaptures, n);
    if (n >= 10) this.hooks.achievement('CAPTURE_10');
    if (n >= 50) this.hooks.achievement('CAPTURE_50');
    if (n >= 150) this.hooks.achievement('CAPTURE_150');
    if (n >= 3) {
      const de = run.save.settings.lang === 'de';
      this.texts.add(this.px, this.py - 44, `×${n} ${de ? 'GEFANGEN' : 'CAPTURED'}!`, n >= 50 ? '#ffd166' : '#ffffff', 18 + Math.min(20, n / 4), 1.4, -24);
      if (n >= 25) this.shakeIt(8);
    }
  }

  // ------------------------------------------------------------------ fuse / snap
  ignite(trailIndex: number, x: number, y: number, e: Enemy | null) {
    if (this.grid.trail.length === 0 || this.stageCleared) return;
    if (e) {
      if (e.trailCd > 0) return;
      e.trailCd = 0.9;
    } else {
      if (this.envIgniteCd > 0) return;
      this.envIgniteCd = 0.5;
    }
    if (this.boldT > 0) {
      this.parts.burst(x, y, 4, '#ffffff', 60, 0.3, 2, 3);
      return;
    }
    const thorns = this.run.weapon('thorns');
    if (thorns?.evolved && this.rng.chance(0.5)) {
      this.parts.burst(x, y, 5, '#9b5de5', 70, 0.3, 2, 3);
      return;
    }
    if (this.guardLeft > 0) {
      this.guardLeft--;
      this.parts.burst(x, y, 10, '#caf0f8', 90, 0.4, 3, 3);
      this.texts.add(x, y - 10, '✦', '#caf0f8', 16, 0.5);
      return;
    }
    if (this.fuse < 0) {
      this.fuse = trailIndex;
      this.fuseStart = trailIndex;
      audio.fuseStart();
    } else if (trailIndex > this.fuse) {
      this.fuse = trailIndex;
    }
  }

  envIgniteCd = 0;

  private clearFuse() {
    if (this.fuse >= 0) audio.fuseStop();
    this.fuse = -1;
    this.fuseStart = -1;
  }

  private updateFuse(dt: number) {
    this.envIgniteCd = Math.max(0, this.envIgniteCd - dt);
    if (this.fuse < 0) return;
    const len = this.grid.trail.length;
    if (len === 0) {
      this.clearFuse();
      return;
    }
    const speed = 19.5 * this.run.s.fuseMult; // cells / second
    this.fuse += speed * dt;
    audio.fuseUpdate(clamp(1 - (len - this.fuse) / 30, 0, 1));
    // sparks at the fuse head
    const pt = this.trailPointAt(this.fuse);
    if (pt && this.rng.chance(0.8)) this.parts.spawn(pt[0], pt[1], this.rng.range(-80, 80), this.rng.range(-80, 80), 0.3, 2.5, this.rng.pick(['#ffd166', '#ff7b3a', '#fff']), 1, 4);
    if (this.fuse >= len - 1) this.snap();
  }

  trailPointAt(trailIndex: number): [number, number] | null {
    const k = Math.min(this.trailPtIdx.length - 1, Math.max(0, Math.floor(trailIndex)));
    if (k < 0) return null;
    const pi = this.trailPtIdx[k];
    if (pi * 2 + 1 >= this.trailPts.length) return [this.px, this.py];
    return [this.trailPts[pi * 2], this.trailPts[pi * 2 + 1]];
  }

  private snap() {
    const run = this.run;
    const lost = this.grid.clearTrail();
    for (let k = 0; k < this.trailPts.length; k += 6) this.parts.spawn(this.trailPts[k], this.trailPts[k + 1], this.rng.range(-60, 60), this.rng.range(-60, 60), 0.6, 3, '#6c757d', 2);
    this.trailPts.length = 0;
    this.trailPtIdx.length = 0;
    this.clearFuse();
    run.stats.snaps++;
    run.save.stats.snaps++;
    this.stageSnaps++;
    audio.snap();
    this.shakeIt(12);
    const ember = run.has('emberquill');
    const dmg = run.s.maxHp * 0.2 * (ember ? 0.5 : 1);
    this.invuln = 0;
    this.texts.add(this.px, this.py - 30, this.lang('SNAP'), '#ff4d6d', 24, 1, -20);
    this.damagePlayer(dmg, this.px + Math.cos(this.facing), this.py + Math.sin(this.facing));
    this.invuln = 1.2;
    if (ember) {
      this.shocks.push({ x: this.px, y: this.py, r: 10, maxR: 200, life: 0.5, maxLife: 0.5, color: '#ff7b3a', width: 12 });
      for (const e of this.query(this.px, this.py, 200)) this.damageEnemy(e, 70, 0, 0, '#ff7b3a');
    }
    void lost;
  }

  // ------------------------------------------------------------------ director
  private updateDirector(dt: number) {
    const run = this.run;
    const tmin = this.time / 60;
    const s = run.stageIdx % 5;
    let count = 0;
    for (const e of this.enemies) if (!e.boss && e.def.ai !== 'nest' && e.def.ai !== 'turret') count++;
    const spawnMul = (run.varnish >= 4 ? 1.25 : 1) * (1 + 0.5 * run.cycle) * (this.tutorial ? 0.5 : 1) * (this.anomaly?.id === 'swarm' ? 1.5 : 1);
    const cap = 230 + 60 * run.cycle;
    const target = Math.min(cap, (16 + 12 * tmin + 6 * s) * spawnMul * (this.boss ? 0.6 : 1));
    this.spawnAcc += dt * (0.8 + target / 12);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (count >= target) break;
      this.spawnRandom();
      count++;
    }
    // tides: rings of blotlings — perfect capture opportunities
    if (this.time >= this.nextTide && !this.boss) {
      this.nextTide = this.time + 55;
      const n = Math.floor((16 + 5 * tmin + 4 * s) * spawnMul);
      const base = this.rng.range(0, TAU);
      for (let k = 0; k < n; k++) {
        const a = base + (k / n) * TAU;
        const x = clamp(this.px + Math.cos(a) * 400, 20, this.W - 20), y = clamp(this.py + Math.sin(a) * 400, 20, this.H - 20);
        if (this.isRockWorld(x, y)) continue;
        this.spawnEnemy(ENEMY[this.biome.id === 'ember' ? 'wisp' : 'blot'], x, y, false);
      }
      this.hooks.announce(this.lang('TIDE'), '', '#adb5bd');
    }
  }

  private spawnRandom() {
    const run = this.run;
    const tmin = this.time / 60;
    const pool = this.biome.pool.filter((p) => p.from <= tmin);
    const pick = this.rng.weighted(pool, (p) => p.w);
    const def = ENEMY[pick.id];
    let eliteChance = Math.min(0.14, 0.015 + 0.012 * tmin) * (run.varnish >= 3 ? 2 : 1) * (this.anomaly?.id === 'golden' ? 2 : 1);
    if (this.tutorial) eliteChance = 0;
    for (let tries = 0; tries < 14; tries++) {
      const a = this.rng.range(0, TAU);
      const d = this.rng.range(470, 720);
      const x = this.px + Math.cos(a) * d, y = this.py + Math.sin(a) * d;
      if (x < 15 || y < 15 || x > this.W - 15 || y > this.H - 15) continue;
      const c = this.cellAt(x, y);
      if (c < 0 || this.grid.terrain[c] === Terrain.Rock) continue;
      if (this.grid.owned[c] && tries < 10) continue;
      this.spawnEnemy(def, x, y, this.rng.chance(eliteChance));
      return;
    }
  }

  private spawnBoss() {
    this.bossSpawned = true;
    const def = ENEMY[this.biome.boss];
    let bx = this.px, by = this.py;
    for (let tries = 0; tries < 60; tries++) {
      const a = this.rng.range(0, TAU);
      const x = this.px + Math.cos(a) * 380, y = this.py + Math.sin(a) * 380;
      if (x < 80 || y < 80 || x > this.W - 80 || y > this.H - 80) continue;
      const c = this.cellAt(x, y);
      if (c < 0 || this.grid.owned[c] || this.grid.terrain[c] === Terrain.Rock) continue;
      bx = x;
      by = y;
      break;
    }
    this.boss = this.spawnEnemy(def, bx, by, false);
    audio.bossRoar();
    audio.playMusic('boss');
    this.shakeIt(14);
    const de = this.run.save.settings.lang === 'de';
    this.hooks.announce(de ? def.name.de : def.name.en, this.lang('BOSS'), def.color);
  }

  private onBossDefeated(e: Enemy) {
    const run = this.run;
    run.stats.bosses++;
    run.save.stats.bosses++;
    run.stats.score += 2500;
    const achMap: Record<string, string> = { smudge: 'BOSS_SMUDGE', mire: 'BOSS_MIRE', eraser: 'BOSS_ERASER', wyrm: 'BOSS_WYRM' };
    if (achMap[e.def.id]) this.hooks.achievement(achMap[e.def.id]);
    const ochre = Math.round((25 + 10 * (run.stageIdx % 5)) * run.s.pigMult);
    run.pig.ochre += ochre;
    run.save.stats.ochreEarned += ochre;
    this.dropPickup(e.x, e.y, 'xp', e.def.xp * 3, true);
    this.parts.burst(e.x, e.y, 120, e.def.color, 420, 1.4, 6, 2);
    this.parts.burst(e.x, e.y, 80, this.biome.pal.edge, 300, 1.2, 4, 3);
    this.shocks.push({ x: e.x, y: e.y, r: 20, maxR: 900, life: 1.1, maxLife: 1.1, color: '#ffffff', width: 20 });
    audio.boom();
    audio.victory();
    this.shakeIt(18);
    this.flash = run.save.settings.flashes ? 0.8 : 0.2;
    this.hitStop = 0.25;
    this.boss = null;
    this.stageCleared = true;
    this.clearT = 0;
    this.clearFuse();
    this.grid.clearTrail();
    this.trailPts.length = 0;
    this.trailPtIdx.length = 0;
    // pop every remaining enemy as a capture
    for (const o of this.enemies) if (!o.dead && o !== e) o.captureAt = this.time + 0.2 + Math.hypot(o.x - e.x, o.y - e.y) / 900;
    // flood the rest of the canvas with color from the boss position
    const cells: number[] = [], dist: number[] = [];
    const g = this.grid;
    const bcx = e.x / CELL, bcy = e.y / CELL;
    for (let i = 0; i < g.size; i++) {
      if (g.owned[i] || g.terrain[i] === Terrain.Rock) continue;
      g.setOwned(i, true);
      cells.push(i);
      dist.push(Math.hypot((i % g.w) - bcx, Math.floor(i / g.w) - bcy));
    }
    this.pushReveal(cells, dist, 120);
    for (const f of this.features) if (!f.taken) f.pending = this.time + 0.3;
    // stars bookkeeping for the stage
    run.stats.stagesCleared++;
    if (this.stageSnaps === 0) this.hooks.achievement('NO_SNAP');
    if (this.time < 210) this.hooks.achievement('FAST_STAGE');
  }

  // ------------------------------------------------------------------ biome mechanics
  private updateBiome(dt: number) {
    const g = this.grid;
    // Ember fissures
    for (const f of this.fissures) {
      f.phase += dt;
      const t = f.phase % f.period;
      const erupting = t > f.period - 1.6;
      if (!erupting) continue;
      if (t - dt <= f.period - 1.6) audio.eruption();
      for (const c of f.cells) {
        if (g.owned[c]) continue;
        const x = (c % g.w) * CELL + CELL / 2, y = Math.floor(c / g.w) * CELL + CELL / 2;
        if (this.rng.chance(0.18)) this.parts.spawn(x, y, this.rng.range(-20, 20), this.rng.range(-110, -40), 0.5, 3, this.rng.pick(['#ff7b3a', '#ffd60a', '#ff4d00']), 0, 1, 60);
        if (g.trailIdx[c] >= 0) this.ignite(g.trailIdx[c], x, y, null);
        if (Math.abs(this.px - x) < CELL && Math.abs(this.py - y) < CELL) this.damagePlayer(14 * this.run.dmgMult, x, y + 1);
        for (const e of this.query(x, y, 6)) if (!e.boss) this.damageEnemy(e, 45 * dt, 0, 0, '#ff7b3a', false);
      }
    }
    // Ink Storm: lightning strikes near the player and sparks the trail
    if (this.anomaly?.id === 'storm') {
      this.stormT -= dt;
      if (this.stormT <= 0) {
        this.stormT = this.rng.range(4, 7);
        const tr = g.trail;
        let x = this.px + this.rng.range(-260, 260), y = this.py + this.rng.range(-200, 200);
        if (tr.length > 6 && this.rng.chance(0.6)) {
          const k = this.rng.int(0, tr.length - 4);
          x = (tr[k] % g.w) * CELL + CELL / 2;
          y = Math.floor(tr[k] / g.w) * CELL + CELL / 2;
        }
        this.drops.push({ x, y, t: 0.9, r: 34, dmg: 40 });
        this.stormMarks.push({ x, y, t: 0.9 });
      }
      for (const m of this.stormMarks) {
        m.t -= dt;
        if (m.t <= 0) {
          const c = this.cellAt(m.x, m.y);
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const cc = c + dy * g.w + dx;
              if (cc >= 0 && cc < g.size && g.trailIdx[cc] >= 0) {
                this.ignite(g.trailIdx[cc], m.x, m.y, null);
                dy = dx = 99;
              }
            }
          if (Math.hypot(this.px - m.x, this.py - m.y) < 34) this.damagePlayer(12 * this.run.dmgMult, m.x, m.y + 1);
          this.parts.burst(m.x, m.y, 14, '#4cc9f0', 200, 0.4, 3, 1);
          audio.boom();
        }
      }
      this.stormMarks = this.stormMarks.filter((m) => m.t > 0);
    }
    // Hollow (and Varnish 10): land slowly fades at the edges
    const fadeRate = (this.biome.id === 'hollow' ? 2.5 + this.time / 60 : 0) + (this.run.varnish >= 10 ? 2 : 0);
    if (fadeRate > 0 && g.ownedCount > 120) {
      this.fadeAcc += dt * fadeRate;
      while (this.fadeAcc >= 1) {
        this.fadeAcc -= 1;
        for (let tries = 0; tries < 40; tries++) {
          const i = this.rng.int(0, g.size - 1);
          if (!g.isEdge(i)) continue;
          const x = (i % g.w) * CELL + CELL / 2, y = Math.floor(i / g.w) * CELL + CELL / 2;
          if (Math.hypot(x - this.px, y - this.py) < 60) continue;
          g.setOwned(i, false);
          if (this.rng.chance(0.3)) this.parts.spawn(x, y, 0, -20, 0.8, 3, '#6c757d', 2, 1);
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------ separation
  private separate() {
    const tmp: Enemy[] = [];
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead || e.boss || e.def.speed === 0 || e.captureAt >= 0) continue;
      this.query(e.x, e.y, e.r, tmp);
      let n = 0;
      for (const o of tmp) {
        if (o === e || o.captureAt >= 0) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const overlap = e.r + o.r - d;
        if (overlap > 0) {
          const push = o.boss || o.def.speed === 0 ? overlap : overlap * 0.5;
          e.x += (dx / d) * push * 0.6;
          e.y += (dy / d) * push * 0.6;
          if (++n > 6) break;
        }
      }
    }
  }

  // ------------------------------------------------------------------ projectiles
  private updateProjectiles(dt: number) {
    const tmp: Enemy[] = [];
    const g = this.grid;
    for (const p of this.projs) {
      p.life -= dt;
      if (p.homing > 0 && !p.hostile) {
        const t = this.nearestEnemy(p.x, p.y, 260);
        if (t) {
          const want = Math.atan2(t.y - p.y, t.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let da = want - cur;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          const na = cur + clamp(da, -p.homing * dt, p.homing * dt);
          const sp = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(na) * sp;
          p.vy = Math.sin(na) * sp;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0 || p.y < 0 || p.x > this.W || p.y > this.H) p.life = 0;
      if (p.life <= 0) continue;
      if (p.hostile) {
        if (this.isRockWorld(p.x, p.y)) { p.life = 0; continue; }
        const c = this.cellAt(p.x, p.y);
        if (c >= 0 && g.trailIdx[c] >= 0) {
          this.ignite(g.trailIdx[c], p.x, p.y, null);
          p.life = 0;
          this.parts.burst(p.x, p.y, 6, p.color, 60, 0.3, 3);
          continue;
        }
        if (dist2(p.x, p.y, this.px, this.py) < (p.r + PLAYER_R) ** 2) {
          this.damagePlayer(p.dmg, p.x, p.y);
          p.life = 0;
        }
        continue;
      }
      this.query(p.x, p.y, p.r, tmp);
      for (const e of tmp) {
        if (e.captureAt >= 0 || p.hit.includes(e.uid)) continue;
        this.damageEnemy(e, p.dmg, p.vx * 0.15, p.vy * 0.15, p.color);
        this.parts.burst(p.x, p.y, 4, p.color, 80, 0.25, 2);
        p.hit.push(e.uid);
        if (p.split) {
          const a0 = Math.atan2(p.vy, p.vx);
          for (let k = -1; k <= 1; k++) {
            const a = a0 + k * 0.7 + Math.PI;
            this.projs.push({ x: p.x, y: p.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, r: 3.5, dmg: p.dmg * 0.5, life: 0.6, pierce: 0, hostile: false, color: p.color, homing: 5, split: false, hit: [e.uid], kind: 'mini' });
          }
        }
        if (p.pierce-- <= 0) { p.life = 0; break; }
      }
    }
    this.projs = this.projs.filter((p) => p.life > 0);
  }

  // ------------------------------------------------------------------ pickups
  private updatePickups(dt: number) {
    const run = this.run;
    const pr = run.s.pickup;
    for (const p of this.pickups) {
      p.t += dt;
      p.life -= dt;
      const dx = this.px - p.x, dy = this.py - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!p.pulled && p.t > 0.25) {
        if (d < pr) p.pulled = true;
        else if (d < pr * 2.2) {
          // pickups resting on your painted land drift to you from further away
          const c = this.cellAt(p.x, p.y);
          if (c >= 0 && this.grid.owned[c]) p.pulled = true;
        }
      }
      if (p.pulled && p.t > 0.15) {
        const sp = 260 + p.t * 380;
        p.vx += ((dx / d) * sp - p.vx) * Math.min(1, dt * 8);
        p.vy += ((dy / d) * sp - p.vy) * Math.min(1, dt * 8);
      } else {
        p.vx *= 1 - dt * 4;
        p.vy *= 1 - dt * 4;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (d < PLAYER_R + 8 && p.t > 0.1) {
        p.life = -1;
        this.collect(p);
      }
    }
    this.pickups = this.pickups.filter((p) => p.life > 0);
  }

  private collect(p: Pickup) {
    const run = this.run;
    switch (p.kind) {
      case 'xp':
        run.xp += p.value * run.s.xpMult;
        audio.pickup();
        break;
      case 'crimson': {
        const v = p.value * run.s.pigMult * this.pigAnomaly;
        run.pig.crimson += v;
        audio.pigment();
        break;
      }
      case 'ochre': {
        const v = p.value * run.s.pigMult * this.pigAnomaly;
        run.pig.ochre += v;
        run.save.stats.ochreEarned += v;
        audio.pigment();
        break;
      }
      case 'heart':
        this.heal(run.s.maxHp * 0.2 * (run.varnish >= 9 ? 0.5 : 1));
        audio.pigment();
        break;
      case 'magnet':
        for (const q of this.pickups) if (q.kind === 'xp') q.pulled = true;
        audio.select();
        break;
      case 'chest':
        audio.levelUp();
        this.flash = Math.max(this.flash, 0.15);
        this.hooks.levelUp(run.offer(run.s.choices, 1), 'chest');
        break;
    }
  }

  // ------------------------------------------------------------------ features
  private updateFeatures() {
    const run = this.run;
    for (const f of this.features) {
      if (f.taken || f.pending < 0 || this.time < f.pending) continue;
      f.taken = true;
      this.parts.burst(f.x, f.y, 26, this.biome.pal.accent, 200, 0.8, 4, 3);
      this.shocks.push({ x: f.x, y: f.y, r: 5, maxR: 60, life: 0.4, maxLife: 0.4, color: this.biome.pal.edge, width: 5 });
      switch (f.kind) {
        case 'cache':
          for (let k = 0; k < f.value; k++) this.dropPickup(f.x, f.y, 'ochre', 1, true);
          run.xp += 4 * run.s.xpMult;
          break;
        case 'chest':
          this.dropPickup(f.x, f.y, 'chest', 1, true);
          break;
        case 'flower':
          this.heal(run.s.maxHp * 0.35);
          audio.shrine();
          break;
        case 'shrine': {
          const kinds: Blessing[] = ['frenzy', 'haste', 'wisdom', 'aegis'];
          const kind = this.rng.pick(kinds);
          run.blessing = { kind, t: 45 };
          run.recompute();
          run.stats.shrines++;
          if (run.stats.shrines >= 3) this.hooks.achievement('SHRINE_3');
          audio.shrine();
          const names: Record<Blessing, [string, string]> = {
            frenzy: ['Frenzy', 'Raserei'], haste: ['Haste', 'Eile'], wisdom: ['Wisdom', 'Weisheit'], aegis: ['Aegis', 'Ägide'],
          };
          const de = run.save.settings.lang === 'de';
          this.hooks.announce(names[kind][de ? 1 : 0], de ? 'Segen für 45 s' : 'Blessing for 45s', '#80ffdb');
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------ misc systems
  private updateMisc(dt: number) {
    const run = this.run;
    const g = this.grid;
    // territory effects on enemies
    const holy = run.s.holy;
    const wet = run.has('wetpaint');
    const outline = run.has('outline');
    const wall = this.wallT > 0;
    for (const e of this.enemies) {
      if (e.dead || e.captureAt >= 0 || e.hidden) continue;
      const c = this.cellAt(e.x, e.y);
      if (c < 0 || !g.owned[c]) continue;
      let dps = holy;
      if (wet && this.time - this.claimTime[c] < 3) dps += 60;
      if (wall) dps += 40;
      if (outline && g.isEdge(c)) dps += 40;
      if (dps > 0) {
        e.auraCd -= dt;
        if (e.auraCd <= 0) {
          e.auraCd = 0.25;
          this.damageEnemy(e, dps * 0.25, 0, 0, '#fff3b0', false);
        }
      }
    }
    // shocks, beams, puddles
    for (const s of this.shocks) {
      s.life -= dt;
      s.r = s.maxR * (1 - s.life / s.maxLife);
    }
    this.shocks = this.shocks.filter((s) => s.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const p of this.puddles) {
      p.life -= dt;
      for (const e of this.query(p.x, p.y, p.r)) e.slow = Math.max(e.slow, 0.3);
    }
    this.puddles = this.puddles.filter((p) => p.life > 0);
    // pending captures resolved in ai.updateEnemy; boss bar smoothing
    if (this.boss) this.bossBar += (this.boss.hp / this.boss.maxHp - this.bossBar) * Math.min(1, dt * 6);
  }

  /** Called by ai when the reveal wave reaches a captured enemy. */
  resolveCapture(e: Enemy) {
    e.captureAt = -1;
    if (e.boss) {
      const dmg = e.maxHp * e.t3;
      e.hp -= dmg;
      e.flash = 0.2;
      this.texts.add(e.x, e.y - e.r - 10, '-' + Math.round(dmg), '#ffd166', 26, 1.2, -30);
      this.shocks.push({ x: e.x, y: e.y, r: e.r, maxR: e.r + 90, life: 0.5, maxLife: 0.5, color: this.biome.pal.edge, width: 10 });
      this.shakeIt(12);
      this.hitStop = 0.12;
      audio.boom();
      // burst free: tear the land around it back to grey
      const lost = this.grid.unclaimDisc(e.x / CELL, e.y / CELL, e.r / CELL + 3.5);
      void lost;
      if (e.hp <= 0) this.killEnemy(e, true);
      return;
    }
    if (e.elite) {
      e.hp -= e.maxHp * 0.55;
      e.flash = 0.2;
      this.parts.burst(e.x, e.y, 10, '#ffffff', 120, 0.4, 3, 3);
      if (e.hp <= 0) this.killEnemy(e, true);
      else {
        // pops out of the land it's standing on
        this.grid.unclaimDisc(e.x / CELL, e.y / CELL, e.r / CELL + 1.2);
      }
      return;
    }
    if (e.def.ai === 'nest' || e.def.ai === 'turret') {
      this.killEnemy(e, true);
      return;
    }
    this.killEnemy(e, true);
  }
}
