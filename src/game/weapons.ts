// Weapon behaviours. Each weapon reads its level (1-5) and evolved flag from the run.
import { audio } from '../core/audio';
import { dist2, TAU } from '../core/math';
import { WEAPONS } from '../data/content';
import type { Game } from './game';
import { CELL, type ClaimResult } from './grid';
import type { Enemy, WeaponState } from './types';

const tmp: Enemy[] = [];
const colorOf = (id: string) => WEAPONS.find((w) => w.id === id)?.color ?? '#fff';
const lv = (w: WeaponState, per: number) => 1 + per * (w.level - 1);

export function updateWeapons(g: Game, dt: number) {
  if (g.stageCleared) return;
  const s = g.run.s;
  for (const w of g.run.weapons) {
    w.cd -= dt;
    switch (w.id) {
      case 'swipe': swipe(g, w, dt, s.cooldown, s.area); break;
      case 'bolt': bolt(g, w, s.cooldown, s.proj); break;
      case 'orbit': orbit(g, w, dt, s.area, s.proj); break;
      case 'thorns': thorns(g, w, dt); break;
      case 'mines': mines(g, w, s.cooldown, s.area); break;
      case 'easel': easel(g, w, s.cooldown); break;
      case 'beam': beam(g, w, s.cooldown, s.area); break;
      case 'golems': golems(g, w, dt); break;
      case 'rain': rain(g, w, s.cooldown, s.area, s.proj); break;
      case 'splash': break; // triggers on claim
    }
  }
  if (g.run.has('rosethorn') && !g.run.weapon('thorns')) thorns(g, { id: 'thorns', level: 2, evolved: false, cd: 0, cd2: 0, ang: 0 }, dt);
  updateMines(g, dt);
  updateTurrets(g, dt);
  updateDrops(g, dt);
}

// Brush Swipe: radial splash around the player
function swipe(g: Game, w: WeaponState, dt: number, cdm: number, area: number) {
  if (w.cd2 > 0) {
    w.cd2 -= dt;
    if (w.cd2 <= 0) swipeHit(g, w, area * 1.25);
  }
  if (w.cd > 0) return;
  w.cd = 1.15 * cdm * (1 - 0.06 * (w.level - 1));
  swipeHit(g, w, area);
  if (w.evolved) w.cd2 = 0.18;
}
function swipeHit(g: Game, w: WeaponState, area: number) {
  const r = 52 * area * lv(w, 0.1) * (w.evolved ? 1.25 : 1);
  const dmg = 12 * lv(w, 0.32) * (w.evolved ? 1.3 : 1);
  const col = g.run.char.id === 'pip' ? g.run.char.color : colorOf('swipe');
  g.shocks.push({ x: g.px, y: g.py, r: 6, maxR: r, life: 0.22, maxLife: 0.22, color: col, width: 6 });
  audio.swipe();
  for (const e of g.query(g.px, g.py, r, tmp)) {
    if (e.captureAt >= 0) continue;
    const a = Math.atan2(e.y - g.py, e.x - g.px);
    const kb = w.evolved ? 380 : 120;
    g.damageEnemy(e, dmg, Math.cos(a) * kb, Math.sin(a) * kb, col);
  }
}

// Paint Bolt: homing projectiles
function bolt(g: Game, w: WeaponState, cdm: number, proj: number) {
  if (w.cd > 0) return;
  w.cd = 0.95 * cdm * (1 - 0.05 * (w.level - 1));
  const n = 1 + Math.floor(w.level / 3) + proj;
  const used = new Set<number>();
  const col = colorOf('bolt');
  let fired = 0;
  for (let k = 0; k < n; k++) {
    const t = g.nearestEnemy(g.px, g.py, 520, used);
    let ang = g.facing + (k - (n - 1) / 2) * 0.3;
    if (t) {
      used.add(t.uid);
      ang = Math.atan2(t.y - g.py, t.x - g.px);
    } else if (k > 0) continue;
    else if (!t) break;
    g.projs.push({
      x: g.px, y: g.py, vx: Math.cos(ang) * 430, vy: Math.sin(ang) * 430, r: 5, dmg: 11 * lv(w, 0.26), life: 1.6,
      pierce: w.level >= 4 ? 1 : 0, hostile: false, color: col, homing: 8, split: w.evolved, hit: [], kind: 'bolt',
    });
    fired++;
  }
  if (fired) audio.shoot();
}

// Chroma Orbs: orbiting damage
function orbit(g: Game, w: WeaponState, dt: number, area: number, proj: number) {
  const n = [0, 2, 2, 3, 3, 4][w.level] + proj + (w.evolved ? 2 : 0);
  w.ang += dt * (2.8 + 0.15 * w.level);
  const base = 62 * area;
  const r = w.evolved ? base + (Math.sin(g.time * 1.6) * 0.5 + 0.5) * 95 * area : base;
  const dmg = 9 * lv(w, 0.26) * (w.evolved ? 1.4 : 1);
  for (let k = 0; k < n; k++) {
    const a = w.ang + (k / n) * TAU;
    const ox = g.px + Math.cos(a) * r, oy = g.py + Math.sin(a) * r;
    for (const e of g.query(ox, oy, 10 * area, tmp)) {
      if (e.captureAt >= 0 || e.orbCd > g.time) continue;
      e.orbCd = g.time + 0.45;
      g.damageEnemy(e, dmg, Math.cos(a) * 90, Math.sin(a) * 90, colorOf('orbit'));
    }
  }
}
export function orbPositions(g: Game): { x: number; y: number }[] {
  const w = g.run.weapon('orbit');
  if (!w) return [];
  const s = g.run.s;
  const n = [0, 2, 2, 3, 3, 4][w.level] + s.proj + (w.evolved ? 2 : 0);
  const base = 62 * s.area;
  const r = w.evolved ? base + (Math.sin(g.time * 1.6) * 0.5 + 0.5) * 95 * s.area : base;
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = w.ang + (k / n) * TAU;
    out.push({ x: g.px + Math.cos(a) * r, y: g.py + Math.sin(a) * r });
  }
  return out;
}

// Thorn Trail: trail cells hurt enemies
function thorns(g: Game, w: WeaponState, dt: number) {
  const grid = g.grid;
  if (grid.trail.length === 0) return;
  const dmg = 8 * lv(w, 0.3) * (w.evolved ? 2 : 1);
  for (const e of g.enemies) {
    if (e.dead || e.captureAt >= 0 || e.thornCd > g.time || e.hidden) continue;
    const c = g.cellAt(e.x, e.y);
    if (c < 0 || grid.trailIdx[c] < 0) continue;
    e.thornCd = g.time + 0.3;
    g.damageEnemy(e, dmg, 0, 0, colorOf('thorns'));
    if (Math.random() < 0.5) g.parts.spawn(e.x, e.y, 0, -30, 0.3, 3, '#9b5de5', 3, 2);
  }
  void dt;
}

// Claim Splash: explosions along a freshly closed loop
export function onClaimWeapons(g: Game, trail: number[], res: ClaimResult) {
  const w = g.run.weapon('splash');
  if (!w || trail.length === 0) return;
  const area = g.run.s.area;
  const step = Math.max(3, 8 - w.level);
  const r = 36 * area * lv(w, 0.1) * (w.evolved ? 1.6 : 1);
  const dmg = 20 * lv(w, 0.3);
  let count = 0;
  for (let k = 0; k < trail.length && count < 45; k += step, count++) {
    const c = trail[k];
    const x = (c % g.grid.w) * CELL + CELL / 2, y = Math.floor(c / g.grid.w) * CELL + CELL / 2;
    g.drops.push({ x, y, t: count * 0.02, r, dmg });
    if (w.evolved) g.puddles.push({ x, y, r: r * 0.8, life: 3 });
  }
  void res;
}

// Ink Mines: dropped while outside territory
function mines(g: Game, w: WeaponState, cdm: number, area: number) {
  if (w.cd > 0) return;
  if (g.onOwned && !w.evolved) return;
  if (!g.moving) return;
  w.cd = (1.1 - 0.1 * (w.level - 1)) * cdm;
  const max = 12 + w.level * 3 + (w.evolved ? 15 : 0);
  if (g.mines.length >= max) g.mines.shift();
  g.mines.push({ x: g.px, y: g.py, life: 12, arm: 0.4 });
  void area;
}
function updateMines(g: Game, dt: number) {
  const w = g.run.weapon('mines');
  if (!w) { g.mines.length = 0; return; }
  const area = g.run.s.area;
  const r = 50 * area * lv(w, 0.08);
  const dmg = 28 * lv(w, 0.3);
  const explode: { x: number; y: number }[] = [];
  for (const m of g.mines) {
    m.life -= dt;
    m.arm -= dt;
    if (m.arm > 0 || m.life <= 0) continue;
    if (g.query(m.x, m.y, 14, tmp).some((e) => e.captureAt < 0)) {
      m.life = -1;
      explode.push({ x: m.x, y: m.y });
    }
  }
  let guard = 0;
  while (explode.length && guard++ < 50) {
    const ex = explode.pop()!;
    g.shocks.push({ x: ex.x, y: ex.y, r: 5, maxR: r, life: 0.3, maxLife: 0.3, color: colorOf('mines'), width: 8 });
    g.parts.burst(ex.x, ex.y, 10, '#ef476f', 160, 0.4, 3);
    audio.boom();
    for (const e of g.query(ex.x, ex.y, r, tmp)) g.damageEnemy(e, dmg, (e.x - ex.x) * 3, (e.y - ex.y) * 3, '#ef476f');
    if (w.evolved) {
      for (const m of g.mines) {
        if (m.life > 0 && dist2(m.x, m.y, ex.x, ex.y) < 90 * 90) {
          m.life = -1;
          explode.push({ x: m.x, y: m.y });
        }
      }
    }
  }
  g.mines = g.mines.filter((m) => m.life > 0);
}

// Sentry Easel: turrets on your territory
function easel(g: Game, w: WeaponState, cdm: number) {
  if (w.cd > 0) return;
  w.cd = (7 - 0.6 * (w.level - 1)) * cdm;
  const max = 2 + w.level + (w.evolved ? 3 : 0);
  const t = g.grid.nearestOwned(g.px / CELL, g.py / CELL, 30);
  if (t < 0) return;
  const x = (t % g.grid.w) * CELL + CELL / 2 + (Math.random() - 0.5) * 30;
  const y = Math.floor(t / g.grid.w) * CELL + CELL / 2 + (Math.random() - 0.5) * 30;
  if (g.turrets.length >= max) g.turrets.shift();
  g.turrets.push({ x, y, life: w.evolved ? 1e9 : 18 + 2 * w.level, cd: 0.3, ang: 0 });
  g.parts.burst(x, y, 10, colorOf('easel'), 100, 0.4, 3, 2);
}
function updateTurrets(g: Game, dt: number) {
  const w = g.run.weapon('easel');
  if (!w) { g.turrets.length = 0; return; }
  const dmg = 9 * lv(w, 0.25);
  const rate = 0.7 * (w.evolved ? 0.5 : 1) * g.run.s.cooldown;
  for (const t of g.turrets) {
    t.life -= dt;
    t.cd -= dt;
    if (t.cd > 0) continue;
    const e = g.nearestEnemy(t.x, t.y, 270);
    if (!e) continue;
    t.cd = rate;
    t.ang = Math.atan2(e.y - t.y, e.x - t.x);
    g.projs.push({ x: t.x, y: t.y - 8, vx: Math.cos(t.ang) * 460, vy: Math.sin(t.ang) * 460, r: 4, dmg, life: 0.8, pierce: 0, hostile: false, color: colorOf('easel'), homing: 3, split: false, hit: [], kind: 'bolt' });
  }
  g.turrets = g.turrets.filter((t) => t.life > 0);
}

// Prism Beam: piercing line in facing direction
function beam(g: Game, w: WeaponState, cdm: number, area: number) {
  if (w.cd > 0) return;
  w.cd = 2.4 * cdm * (1 - 0.08 * (w.level - 1));
  const len = 320 * area;
  const width = 14 * lv(w, 0.15);
  const dmg = 28 * lv(w, 0.3);
  const dirs = w.evolved ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : [0];
  const col = colorOf('beam');
  for (const off of dirs) {
    const a = g.facing + off;
    const cx = Math.cos(a), cy = Math.sin(a);
    g.beams.push({ x: g.px, y: g.py, ang: a, len, w: width, life: 0.22, color: col });
    for (const e of g.enemies) {
      if (e.dead || e.hidden || e.captureAt >= 0) continue;
      const dx = e.x - g.px, dy = e.y - g.py;
      const along = dx * cx + dy * cy;
      if (along < 0 || along > len) continue;
      const perp = Math.abs(dx * -cy + dy * cx);
      if (perp > width + e.r) continue;
      g.damageEnemy(e, dmg * (w.evolved && Math.random() < g.run.s.crit ? 1.5 : 1), cx * 80, cy * 80, col);
    }
  }
  audio.shoot();
}

// Fresco Golems: allies that live on your land
function golems(g: Game, w: WeaponState, dt: number) {
  const pct = g.percent * 100;
  const cap = 1 + w.level + (w.evolved ? 4 : 0);
  const want = Math.max(1, Math.min(cap, Math.floor(pct / (16 - 2 * w.level)) + 1));
  while (g.golems.length < want) {
    const t = g.grid.nearestOwned(g.px / CELL, g.py / CELL, 40);
    if (t < 0) break;
    g.golems.push({ x: (t % g.grid.w) * CELL + 5, y: Math.floor(t / g.grid.w) * CELL + 5, vx: 0, vy: 0, cd: 0, tx: g.px, ty: g.py, retarget: 0, bob: Math.random() * 6 });
  }
  while (g.golems.length > want) g.golems.pop();
  const dmg = 16 * lv(w, 0.3) * (w.evolved ? 2 : 1);
  const reach = w.evolved ? 34 : 22;
  for (const gl of g.golems) {
    gl.cd -= dt;
    gl.retarget -= dt;
    gl.bob += dt;
    if (gl.retarget <= 0) {
      gl.retarget = 0.4;
      const e = g.nearestEnemy(gl.x, gl.y, 240);
      if (e) { gl.tx = e.x; gl.ty = e.y; }
      else { gl.tx = g.px + Math.cos(gl.bob) * 50; gl.ty = g.py + Math.sin(gl.bob) * 50; }
    }
    const dx = gl.tx - gl.x, dy = gl.ty - gl.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 150;
    gl.vx += ((dx / d) * sp - gl.vx) * Math.min(1, dt * 5);
    gl.vy += ((dy / d) * sp - gl.vy) * Math.min(1, dt * 5);
    let nx = gl.x + gl.vx * dt, ny = gl.y + gl.vy * dt;
    // golems only walk on your land (they're painted on it)
    const c = g.cellAt(nx, ny);
    if (c < 0 || !g.grid.owned[c]) { nx = gl.x; ny = gl.y; gl.retarget = 0; }
    gl.x = nx;
    gl.y = ny;
    if (gl.cd <= 0) {
      const hits = g.query(gl.x, gl.y, reach, tmp);
      if (hits.length) {
        gl.cd = 0.7;
        for (const e of hits) g.damageEnemy(e, dmg, (e.x - gl.x) * 4, (e.y - gl.y) * 4, colorOf('golems'));
        g.shocks.push({ x: gl.x, y: gl.y, r: 4, maxR: reach + 8, life: 0.2, maxLife: 0.2, color: colorOf('golems'), width: 5 });
      }
    }
  }
}

// Pigment Rain: delayed strikes on random enemies
function rain(g: Game, w: WeaponState, cdm: number, area: number, proj: number) {
  if (w.cd > 0) return;
  w.cd = (1.4 - 0.1 * (w.level - 1)) * cdm;
  const n = (1 + Math.floor(w.level / 2) + proj) * (w.evolved ? 3 : 1);
  const near = g.query(g.px, g.py, 420, []).filter((e) => e.captureAt < 0);
  for (let k = 0; k < n && near.length; k++) {
    const e = near[Math.floor(Math.random() * near.length)];
    g.drops.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y + (Math.random() - 0.5) * 16, t: 0.45 + k * 0.05, r: 32 * area * (w.evolved ? 1.4 : 1), dmg: 20 * lv(w, 0.3) });
  }
}

function updateDrops(g: Game, dt: number) {
  for (const d of g.drops) {
    d.t -= dt;
    if (d.t > 0) continue;
    g.shocks.push({ x: d.x, y: d.y, r: 4, maxR: d.r, life: 0.25, maxLife: 0.25, color: '#4cc9f0', width: 6 });
    g.parts.burst(d.x, d.y, 6, g.rng.pick(g.biome.pal.land), 120, 0.4, 3);
    for (const e of g.query(d.x, d.y, d.r, tmp)) g.damageEnemy(e, d.dmg, (e.x - d.x) * 2, (e.y - d.y) * 2, '#4cc9f0');
  }
  if (g.drops.some((d) => d.t <= 0)) audio.hit();
  g.drops = g.drops.filter((d) => d.t > 0);
}
