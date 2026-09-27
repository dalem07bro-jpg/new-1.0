// Simple autopilot: plans rectangular loops out of the territory (and lassos around bosses).
// Drives the title-screen attract mode and automated play-tests.
import { TAU } from '../core/math';
import type { Game } from './game';
import { CELL, Terrain } from './grid';

export class Bot {
  private wps: { x: number; y: number }[] = [];
  private stuckT = 0;
  private lastX = 0;
  private lastY = 0;
  private homeCache: { x: number; y: number } | null = null;
  private homeT = 0;
  aggression = 1;

  private home(g: Game) {
    if (this.homeT <= 0 || !this.homeCache) {
      this.homeT = 0.25;
      const c = g.grid.nearestOwned(g.px / CELL, g.py / CELL, 160);
      this.homeCache = c >= 0 ? { x: (c % g.grid.w) * CELL + CELL / 2, y: Math.floor(c / g.grid.w) * CELL + CELL / 2 } : { x: g.px, y: g.py };
    }
    return this.homeCache;
  }

  private free(g: Game, x: number, y: number) {
    if (x < 30 || y < 30 || x > g.W - 30 || y > g.H - 30) return false;
    const c = g.cellAt(x, y);
    return c >= 0 && g.grid.terrain[c] !== Terrain.Rock;
  }

  private plan(g: Game) {
    const boss = g.boss;
    if (boss && !boss.hidden && Math.hypot(boss.x - g.px, boss.y - g.py) < 500) {
      const r = boss.r + 50;
      const a0 = Math.atan2(g.py - boss.y, g.px - boss.x);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.wps = [];
      for (let k = 0; k <= 8; k++) {
        const a = a0 + dir * (k / 8) * TAU;
        const x = boss.x + Math.cos(a) * r, y = boss.y + Math.sin(a) * r;
        if (this.free(g, x, y)) this.wps.push({ x, y });
      }
      return;
    }
    let best = -1e9, bestA = 0, bestD = 12;
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * TAU;
      const d = (8 + Math.random() * 16 * this.aggression) * CELL;
      const x = g.px + Math.cos(a) * d, y = g.py + Math.sin(a) * d;
      if (!this.free(g, x, y)) continue;
      let score = 0;
      for (let s = 1; s <= 6; s++) {
        const c = g.cellAt(g.px + Math.cos(a) * d * (s / 6), g.py + Math.sin(a) * d * (s / 6));
        if (c >= 0 && !g.grid.owned[c]) score += 1;
      }
      for (const f of g.features) if (!f.taken && Math.hypot(f.x - x, f.y - y) < 120) score += 3;
      let near = 0;
      for (const e of g.enemies) if (!e.boss && Math.hypot(e.x - x, e.y - y) < 110) near++;
      score += Math.min(6, near * 0.5) - (near > 18 ? 6 : 0);
      if (score > best) { best = score; bestA = a; bestD = d; }
    }
    const side = Math.random() < 0.5 ? 1 : -1;
    const L = (8 + Math.random() * 14 * this.aggression) * CELL;
    const ax = g.px + Math.cos(bestA) * bestD, ay = g.py + Math.sin(bestA) * bestD;
    const px = -Math.sin(bestA) * side, py = Math.cos(bestA) * side;
    const bx = ax + px * L, by = ay + py * L;
    const cx = g.px + px * L, cy = g.py + py * L;
    this.wps = [{ x: ax, y: ay }];
    if (this.free(g, bx, by)) this.wps.push({ x: bx, y: by });
    if (this.free(g, cx, cy)) this.wps.push({ x: cx, y: cy });
  }

  update(g: Game, dt: number) {
    this.homeT -= dt;
    const trail = g.grid.trail.length;
    const hpFrac = g.hp / g.run.s.maxHp;
    let tx: number, ty: number;
    const danger = g.fuse >= 0 || (hpFrac < 0.3 && trail > 0);
    if (danger) {
      const h = this.home(g);
      tx = h.x; ty = h.y;
      this.wps = [];
      const d = Math.hypot(h.x - g.px, h.y - g.py);
      if (d > 50) g.botDash = true;
    } else {
      if (this.wps.length === 0) {
        if (trail > 0 || !g.onOwned) {
          const h = this.home(g);
          tx = h.x; ty = h.y;
        } else {
          this.plan(g);
          tx = g.px; ty = g.py;
        }
      } else {
        tx = this.wps[0].x; ty = this.wps[0].y;
        if (Math.hypot(tx - g.px, ty - g.py) < 14) this.wps.shift();
      }
    }
    // stuck detection
    if (Math.hypot(g.px - this.lastX, g.py - this.lastY) < 0.5) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastX = g.px;
    this.lastY = g.py;
    if (this.stuckT > 1) {
      this.wps = [];
      this.stuckT = 0;
      tx = g.px + (Math.random() - 0.5) * 200;
      ty = g.py + (Math.random() - 0.5) * 200;
    }
    let mx = tx - g.px, my = ty - g.py;
    const m = Math.hypot(mx, my) || 1;
    mx /= m; my /= m;
    // enemy avoidance
    let ax = 0, ay = 0, close = 0;
    for (const e of g.enemies) {
      if (e.dead || e.hidden || e.captureAt >= 0 || e.def.ai === 'nest') continue;
      const dx = g.px - e.x, dy = g.py - e.y;
      const d = Math.hypot(dx, dy);
      const rr = e.r + 40;
      if (d < rr && d > 0) {
        ax += (dx / d) * (1 - d / rr) * 2.2;
        ay += (dy / d) * (1 - d / rr) * 2.2;
        if (d < e.r + 18) close++;
      }
    }
    mx += ax; my += ay;
    const mm = Math.hypot(mx, my) || 1;
    if (close > 0 && Math.random() < 0.05) g.botDash = true;
    let nearCount = 0;
    for (const e of g.enemies) if (!e.dead && Math.hypot(e.x - g.px, e.y - g.py) < 110) nearCount++;
    if (g.specialCd <= 0) {
      const id = g.run.char.id;
      if ((id === 'vera' || id === 'bruno') && nearCount > 6) g.botSpecial = true;
      if (id === 'pip' && trail > 20) g.botSpecial = true;
      if (id === 'mona' && danger && trail > 10) g.botSpecial = true;
    }
    if (m < 4 && this.wps.length === 0 && trail === 0) return { x: 0, y: 0 };
    return { x: mx / mm, y: my / mm };
  }
}
