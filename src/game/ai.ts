// Enemy and boss behaviour.
import { audio } from '../core/audio';
import { clamp, TAU } from '../core/math';
import { ENEMY } from '../data/content';
import type { Game } from './game';
import { CELL, Terrain } from './grid';
import type { Enemy } from './types';

const PLAYER_R = 8;

function moveEnemy(g: Game, e: Enemy, vx: number, vy: number, dt: number, ghost = false) {
  let mult = 1;
  if (e.slow > 0) mult *= 0.55;
  const c = g.cellAt(e.x, e.y);
  if (c >= 0) {
    if (g.grid.owned[c]) mult *= g.wallT > 0 ? 0.4 : 0.85; // painted ground slows the grey
    else if (g.grid.terrain[c] === Terrain.Bog && e.def.ai !== 'wisp' && e.def.ai !== 'phantom' && !e.boss) mult *= 0.6;
  }
  let nx = e.x + (vx * mult + e.knockX) * dt;
  let ny = e.y + (vy * mult + e.knockY) * dt;
  e.knockX *= Math.max(0, 1 - dt * 8);
  e.knockY *= Math.max(0, 1 - dt * 8);
  if (!ghost && !e.boss) {
    if (g.isRockWorld(nx, e.y)) nx = e.x;
    if (g.isRockWorld(e.x, ny)) ny = e.y;
  }
  e.x = clamp(nx, e.r * 0.5, g.W - e.r * 0.5);
  e.y = clamp(ny, e.r * 0.5, g.H - e.r * 0.5);
}

function toward(e: Enemy, tx: number, ty: number) {
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, d };
}

function shootAt(g: Game, e: Enemy, tx: number, ty: number, speed: number, spread = 0, count = 1, color = '#4cc9f0') {
  const base = Math.atan2(ty - e.y, tx - e.x);
  for (let k = 0; k < count; k++) {
    const a = base + (count > 1 ? (k - (count - 1) / 2) * spread : 0);
    g.projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 6, dmg: e.dmg * 0.8, life: 3.2, pierce: 0, hostile: true, color, homing: 0, split: false, hit: [], kind: 'ink' });
  }
}

function radial(g: Game, e: Enemy, n: number, speed: number, color: string, offset = 0) {
  for (let k = 0; k < n; k++) {
    const a = offset + (k / n) * TAU;
    g.projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 7, dmg: e.dmg * 0.7, life: 3.5, pierce: 0, hostile: true, color, homing: 0, split: false, hit: [], kind: 'ink' });
  }
}

/** Check trail contact for an enemy (disc for big ones). */
function trailContact(g: Game, e: Enemy) {
  const grid = g.grid;
  if (grid.trail.length === 0) return;
  if (e.r <= 12) {
    const c = g.cellAt(e.x, e.y);
    if (c >= 0 && grid.trailIdx[c] >= 0) g.ignite(grid.trailIdx[c], e.x, e.y, e);
    return;
  }
  const rc = e.r / CELL;
  const cx = e.x / CELL, cy = e.y / CELL;
  for (let y = Math.floor(cy - rc); y <= Math.ceil(cy + rc); y++) {
    for (let x = Math.floor(cx - rc); x <= Math.ceil(cx + rc); x++) {
      if (!grid.inBounds(x, y)) continue;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > rc * rc) continue;
      const i = grid.idx(x, y);
      if (grid.trailIdx[i] >= 0) {
        g.ignite(grid.trailIdx[i], x * CELL + 5, y * CELL + 5, e);
        return;
      }
    }
  }
}

function contactPlayer(g: Game, e: Enemy) {
  const rr = e.r + PLAYER_R - 2;
  const dx = g.px - e.x, dy = g.py - e.y;
  if (dx * dx + dy * dy < rr * rr) g.damagePlayer(e.dmg, e.x, e.y);
}

export function updateEnemy(g: Game, e: Enemy, dt: number) {
  e.flash = Math.max(0, e.flash - dt);
  e.trailCd = Math.max(0, e.trailCd - dt);
  e.slow = Math.max(0, e.slow - dt);
  if (e.spawnT > 0) {
    e.spawnT -= dt;
    return;
  }
  if (e.captureAt >= 0) {
    if (g.time >= e.captureAt) g.resolveCapture(e);
    return; // frozen while the wave approaches
  }
  if (e.freeze > 0) {
    e.freeze -= dt;
    return;
  }
  if (g.stageCleared) return;

  if (e.boss) {
    updateBoss(g, e, dt);
    return;
  }

  const def = e.def;
  const sp = e.speed;
  e.t += dt;
  switch (def.ai) {
    case 'chase': {
      const v = toward(e, g.px, g.py);
      if (def.herd && e.state === 0) {
        // grazing herd: drift around, aggro when the painter comes close (trails attract attention)
        // alertness builds while the painter is near; lasso them before they notice!
        const alertR = g.grid.trail.length > 0 ? 170 : 140;
        if (v.d < alertR) e.t3 += dt * (v.d < 70 ? 3 : 1);
        else e.t3 = Math.max(0, e.t3 - dt * 0.5);
        if (e.t3 > 1.6 || e.hp < e.maxHp) {
          e.state = 1;
          e.phase = 0.8; // "!" indicator
          break;
        }
        e.t2 -= dt;
        if (e.t2 <= 0) {
          e.t2 = g.rng.range(1, 2.5);
          // wander, drifting slowly toward the painter so herds come into view
          const a = g.rng.range(0, TAU);
          const bias = v.d > 380 ? 0.6 : 0.15;
          const dx = Math.cos(a) * (1 - bias) + v.x * bias, dy = Math.sin(a) * (1 - bias) + v.y * bias;
          const m = Math.hypot(dx, dy) || 1;
          e.dirX = dx / m;
          e.dirY = dy / m;
        }
        moveEnemy(g, e, e.dirX * sp * 0.4, e.dirY * sp * 0.4, dt);
        break;
      }
      if (e.phase > 0) e.phase -= dt;
      if (def.herd && v.d > 560) {
        e.state = 0;
        e.t3 = 0;
      }
      moveEnemy(g, e, v.x * sp, v.y * sp, dt);
      break;
    }
    case 'wisp': {
      const v = toward(e, g.px, g.py);
      const wob = Math.sin(e.t * 5 + e.uid) * 0.9;
      const ax = v.x * Math.cos(wob) - v.y * Math.sin(wob), ay = v.x * Math.sin(wob) + v.y * Math.cos(wob);
      moveEnemy(g, e, ax * sp, ay * sp, dt);
      break;
    }
    case 'phantom': {
      const v = toward(e, g.px, g.py);
      moveEnemy(g, e, v.x * sp, v.y * sp, dt, true);
      break;
    }
    case 'trail': {
      e.t2 -= dt;
      if (g.grid.trail.length > 0) {
        if (e.t2 <= 0) {
          e.t2 = 0.3;
          const k = g.grid.nearestTrail(e.x, e.y);
          if (k >= 0) {
            const c = g.grid.trail[k];
            e.dirX = (c % g.grid.w) * CELL + CELL / 2;
            e.dirY = Math.floor(c / g.grid.w) * CELL + CELL / 2;
          }
        }
        const v = toward(e, e.dirX, e.dirY);
        moveEnemy(g, e, v.x * sp * 1.1, v.y * sp * 1.1, dt);
      } else {
        // lurk at a distance, waiting for you to leave home
        const v = toward(e, g.px, g.py);
        const want = v.d > 150 ? 1 : v.d < 110 ? -1 : 0;
        const side = Math.sin(e.t * 0.8 + e.uid) > 0 ? 1 : -1;
        moveEnemy(g, e, (v.x * want - v.y * side * 0.5) * sp * 0.7, (v.y * want + v.x * side * 0.5) * sp * 0.7, dt);
      }
      break;
    }
    case 'ranged': {
      const v = toward(e, g.px, g.py);
      const want = v.d > 260 ? 1 : v.d < 170 ? -1 : 0;
      const side = Math.sin(e.t * 0.6 + e.uid) > 0 ? 1 : -1;
      moveEnemy(g, e, (v.x * want - v.y * side * 0.4) * sp, (v.y * want + v.x * side * 0.4) * sp, dt);
      e.t2 += dt;
      if (e.t2 > 2.4 && v.d < 420) {
        e.t2 = 0;
        const lead = 0.35;
        shootAt(g, e, g.px + g.pvx * lead, g.py + g.pvy * lead, 190, 0.25, e.elite ? 3 : 1, def.color);
      }
      break;
    }
    case 'leech': {
      e.t2 -= dt;
      if (e.t2 <= 0) {
        e.t2 = 0.5;
        const t = g.grid.nearestOwned(e.x / CELL, e.y / CELL, 50);
        if (t >= 0) {
          e.dirX = (t % g.grid.w) * CELL + CELL / 2;
          e.dirY = Math.floor(t / g.grid.w) * CELL + CELL / 2;
          const d = Math.hypot(e.dirX - e.x, e.dirY - e.y);
          if (d < CELL * 1.6) {
            // drain
            g.grid.setOwned(t, false);
            g.parts.burst(e.dirX, e.dirY, 3, '#80ed99', 40, 0.4, 2, 2);
          }
        } else {
          e.dirX = g.px;
          e.dirY = g.py;
        }
      }
      const v = toward(e, e.dirX, e.dirY);
      if (v.d > 4) moveEnemy(g, e, v.x * sp, v.y * sp, dt);
      break;
    }
    case 'charger': {
      const v = toward(e, g.px, g.py);
      if (e.state === 0) {
        moveEnemy(g, e, v.x * sp, v.y * sp, dt);
        e.t2 -= dt;
        if (v.d < 290 && e.t2 <= 0) {
          e.state = 1;
          e.t3 = 0.65;
          e.dirX = v.x;
          e.dirY = v.y;
        }
      } else if (e.state === 1) {
        e.t3 -= dt;
        e.dirX = v.x;
        e.dirY = v.y;
        if (e.t3 <= 0) {
          e.state = 2;
          e.t3 = 0.5;
        }
      } else {
        e.t3 -= dt;
        moveEnemy(g, e, e.dirX * 430, e.dirY * 430, dt);
        if (g.rng.chance(0.5)) g.parts.spawn(e.x, e.y, 0, 0, 0.3, e.r * 0.6, def.color, 0, 0);
        if (e.t3 <= 0) {
          e.state = 0;
          e.t2 = 2.6;
        }
      }
      break;
    }
    case 'turret': {
      e.t2 += dt;
      const v = toward(e, g.px, g.py);
      if (e.t2 > 1.9 && v.d < 340) {
        e.t2 = 0;
        shootAt(g, e, g.px, g.py, 200, 0.28, 3, def.color);
      }
      break;
    }
    case 'nest': {
      e.t2 += dt;
      const v = toward(e, g.px, g.py);
      if (e.t2 > 4.5 && v.d < 800 && g.enemies.length < 300) {
        e.t2 = 0;
        for (let k = 0; k < 2; k++) {
          const a = g.rng.range(0, TAU);
          const x = e.x + Math.cos(a) * 24, y = e.y + Math.sin(a) * 24;
          if (!g.isRockWorld(x, y)) g.spawnEnemy(ENEMY[g.biome.id === 'ember' ? 'wisp' : 'blot'], x, y, false).state = 1;
        }
      }
      break;
    }
  }
  if (def.ai !== 'nest') {
    contactPlayer(g, e);
    trailContact(g, e);
  }
}

// ------------------------------------------------------------------ bosses
function updateBoss(g: Game, e: Enemy, dt: number) {
  e.t += dt;
  e.t2 += dt;
  const v = toward(e, g.px, g.py);
  const hpFrac = e.hp / e.maxHp;
  switch (e.def.id) {
    case 'smudge': {
      if (e.state === 0) {
        moveEnemy(g, e, v.x * e.speed, v.y * e.speed, dt);
        if (e.t2 > 6.5) {
          e.t2 = 0;
          const n = hpFrac < 0.5 ? 10 : 7;
          for (let k = 0; k < n; k++) {
            const a = (k / n) * TAU;
            { const m = g.spawnEnemy(ENEMY.blot, e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, false); m.spawnT = 0.5; m.state = 1; }
          }
        }
        e.t3 += dt;
        if (e.t3 > 9) {
          e.t3 = 0;
          e.state = 1;
          e.phase = 0.8;
          e.dirX = g.px;
          e.dirY = g.py;
        }
      } else if (e.state === 1) {
        e.phase -= dt; // windup
        if (e.phase <= 0) {
          e.state = 2;
          e.phase = 0.55;
          e.hist = [{ x: e.x, y: e.y }];
        }
      } else {
        e.phase -= dt;
        const s = e.hist![0];
        const t = 1 - e.phase / 0.55;
        e.x = s.x + (e.dirX - s.x) * t;
        e.y = s.y + (e.dirY - s.y) * t;
        if (e.phase <= 0) {
          e.state = 0;
          g.shocks.push({ x: e.x, y: e.y, r: 10, maxR: 110, life: 0.45, maxLife: 0.45, color: '#adb5bd', width: 12 });
          g.shakeIt(10);
          audio.boom();
          if (Math.hypot(g.px - e.x, g.py - e.y) < 100) g.damagePlayer(e.dmg, e.x, e.y);
          g.grid.unclaimDisc(e.x / CELL, e.y / CELL, 5);
        }
      }
      break;
    }
    case 'mire': {
      if (e.state === 0) {
        e.hidden = false;
        moveEnemy(g, e, v.x * e.speed, v.y * e.speed, dt);
        if (e.t2 > 2.2) {
          e.t2 = 0;
          radial(g, e, hpFrac < 0.5 ? 12 : 9, 170, '#52b69a', e.t);
        }
        e.t3 += dt;
        if (e.t3 > 6) {
          e.t3 = 0;
          e.state = 1;
          e.hidden = true;
          g.parts.burst(e.x, e.y, 30, '#52b69a', 150, 0.7, 5, 2);
        }
      } else {
        e.hidden = true;
        moveEnemy(g, e, v.x * 150, v.y * 150, dt);
        e.t3 += dt;
        if (g.rng.chance(0.4)) g.parts.spawn(e.x + g.rng.range(-30, 30), e.y + g.rng.range(-30, 30), 0, -15, 0.6, 4, '#2d6a4f', 0, 1);
        if (e.t3 > 3) {
          e.t3 = 0;
          e.state = 0;
          e.hidden = false;
          g.grid.unclaimDisc(e.x / CELL, e.y / CELL, 8);
          g.shocks.push({ x: e.x, y: e.y, r: 10, maxR: 120, life: 0.5, maxLife: 0.5, color: '#52b69a', width: 12 });
          g.shakeIt(8);
          audio.boom();
          for (let k = 0; k < 4; k++) g.spawnEnemy(ENEMY.leech, e.x + g.rng.range(-60, 60), e.y + g.rng.range(-60, 60), false);
        }
      }
      break;
    }
    case 'eraser': {
      if (e.state === 0) {
        moveEnemy(g, e, v.x * e.speed, v.y * e.speed, dt);
        if (e.t2 > (hpFrac < 0.5 ? 3.6 : 5)) {
          e.t2 = 0;
          e.state = 1;
          e.phase = 0.9;
        }
      } else if (e.state === 1) {
        e.phase -= dt;
        e.dirX = v.x;
        e.dirY = v.y;
        if (e.phase <= 0) {
          e.state = 2;
          e.phase = 1.25;
        }
      } else {
        e.phase -= dt;
        const nx = e.x + e.dirX * 520 * dt, ny = e.y + e.dirY * 520 * dt;
        if (nx < e.r || nx > g.W - e.r) e.dirX *= -1;
        if (ny < e.r || ny > g.H - e.r) e.dirY *= -1;
        e.x = clamp(nx, e.r, g.W - e.r);
        e.y = clamp(ny, e.r, g.H - e.r);
        g.grid.unclaimDisc(e.x / CELL, e.y / CELL, e.r / CELL + 0.5);
        if (g.rng.chance(0.7)) g.parts.spawn(e.x, e.y, g.rng.range(-50, 50), g.rng.range(-50, 50), 0.5, 5, '#f4f1de', 2, 2);
        if (e.phase <= 0) e.state = 0;
      }
      break;
    }
    case 'wyrm': {
      const wob = Math.sin(e.t * 2.2) * 0.8;
      const ax = v.x * Math.cos(wob) - v.y * Math.sin(wob), ay = v.x * Math.sin(wob) + v.y * Math.cos(wob);
      const sp = e.speed * (hpFrac < 0.5 ? 1.2 : 1);
      moveEnemy(g, e, ax * sp, ay * sp, dt);
      const hist = e.hist!;
      hist.unshift({ x: e.x, y: e.y });
      if (hist.length > 600) hist.length = 600;
      // body follows the path
      let acc = 0, hi = 0;
      for (let s = 0; s < e.segs!.length; s++) {
        const want = (s + 1) * 20;
        while (hi < hist.length - 1 && acc < want) {
          acc += Math.hypot(hist[hi + 1].x - hist[hi].x, hist[hi + 1].y - hist[hi].y);
          hi++;
        }
        e.segs![s].x = hist[hi].x;
        e.segs![s].y = hist[hi].y;
      }
      // body burns trails and the player
      for (let s = 0; s < e.segs!.length; s += 2) {
        const sg = e.segs![s];
        const c = g.cellAt(sg.x, sg.y);
        if (c >= 0 && g.grid.trailIdx[c] >= 0) g.ignite(g.grid.trailIdx[c], sg.x, sg.y, null);
        if (Math.hypot(g.px - sg.x, g.py - sg.y) < 20 + PLAYER_R) g.damagePlayer(e.dmg * 0.6, sg.x, sg.y);
      }
      if (e.t2 > 7) {
        e.t2 = 0;
        radial(g, e, hpFrac < 0.5 ? 14 : 10, 200, '#ff4d00', e.t);
      }
      break;
    }
    case 'blank': {
      moveEnemy(g, e, v.x * e.speed * (hpFrac < 0.33 ? 1.4 : 1), v.y * e.speed * (hpFrac < 0.33 ? 1.4 : 1), dt);
      if (e.t2 > 8) {
        e.t2 = 0;
        for (let k = 0; k < 3; k++) g.spawnEnemy(ENEMY.phantom, e.x + g.rng.range(-80, 80), e.y + g.rng.range(-80, 80), false);
      }
      if (hpFrac < 0.66) {
        e.t3 += dt;
        if (e.t3 > 3) {
          e.t3 = 0;
          radial(g, e, 16, 175, '#e0aaff', e.t * 0.7);
        }
      }
      if (hpFrac < 0.33) {
        e.phase += dt;
        if (e.phase > 6) {
          e.phase = 0;
          // erase a ring of land around itself
          const g2 = g.grid;
          const cx = e.x / CELL, cy = e.y / CELL;
          for (let y = Math.floor(cy - 16); y <= cy + 16; y++)
            for (let x = Math.floor(cx - 16); x <= cx + 16; x++) {
              if (!g2.inBounds(x, y)) continue;
              const d = Math.hypot(x - cx, y - cy);
              if (d > 12 && d < 15) g2.setOwned(g2.idx(x, y), false);
            }
          g.shocks.push({ x: e.x, y: e.y, r: 20, maxR: 150, life: 0.6, maxLife: 0.6, color: '#ffffff', width: 14 });
          audio.boom();
        }
      }
      break;
    }
  }
  if (!e.hidden) {
    contactPlayer(g, e);
    trailContact(g, e);
  }
}
