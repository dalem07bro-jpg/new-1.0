// Main renderer: world (void, painted land, entities, effects) + in-game HUD.
import { clamp, fmtNum, fmtTime, rgba, TAU } from '../core/math';
import { t, tr } from '../core/i18n';
import { input } from '../core/input';
import { CHARS, PASSIVES, RELICS, WEAPONS } from '../data/content';
import type { Game } from '../game/game';
import { CELL } from '../game/grid';
import { orbPositions } from '../game/weapons';
import type { Enemy } from '../game/types';
import { iconPath } from './icons';
import { Painter, TS } from './painter';

const FONT = 'Fredoka, "Trebuchet MS", system-ui, sans-serif';

interface Announce {
  text: string;
  sub: string;
  color: string;
  t: number;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  W = 0; // css px
  H = 0;
  painter: Painter | null = null;
  private glowCache = new Map<string, HTMLCanvasElement>();
  private announces: Announce[] = [];
  private homeTarget: { x: number; y: number } | null = null;
  private homeT = 0;
  private lastPct = 0;
  private pctPulse = 0;
  hudVisible = true;
  lowFx = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  }

  attach(game: Game) {
    this.painter = new Painter(game.grid, game.biome);
    this.announces = [];
    this.lastPct = 0;
  }

  announce(text: string, sub = '', color = '#ffffff') {
    this.announces.push({ text, sub, color, t: 0 });
    if (this.announces.length > 3) this.announces.shift();
  }

  private glow(color: string): HTMLCanvasElement {
    let c = this.glowCache.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, rgba(color, 0.9));
      grd.addColorStop(0.35, rgba(color, 0.35));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      this.glowCache.set(color, c);
    }
    return c;
  }

  // ------------------------------------------------------------------ frame
  render(g: Game, dt: number) {
    const ctx = this.ctx;
    const p = this.painter!;
    // apply reveal batches whose time has come
    const grid = g.grid;
    const now = g.time;
    const toPaint: number[] = [];
    for (const b of g.reveals) {
      while (b.idx < b.cells.length && b.times[b.idx] <= now) {
        const c = b.cells[b.idx++];
        if (grid.owned[c] && !p.vis[c]) toPaint.push(c);
      }
      // sparkles at the wave front
      if (b.idx < b.cells.length && !this.lowFx) {
        for (let k = 0; k < 3; k++) {
          const c = b.cells[Math.min(b.cells.length - 1, b.idx + ((Math.random() * 30) | 0))];
          const x = (c % grid.w) * CELL + CELL / 2, y = Math.floor(c / grid.w) * CELL + CELL / 2;
          g.parts.spawn(x, y, (Math.random() - 0.5) * 40, -30 - Math.random() * 40, 0.5, 2.2, g.biome.pal.edge, 3, 1);
        }
      }
    }
    g.reveals = g.reveals.filter((b) => b.idx < b.cells.length);
    if (toPaint.length) p.paint(toPaint);
    // cells lost (leeches, bosses, fading)
    if (grid.changed.length) {
      const lost: number[] = [];
      for (const c of grid.changed) if (!grid.owned[c] && p.vis[c]) lost.push(c);
      grid.changed.length = 0;
      if (lost.length) p.erase(lost);
    }

    // camera
    const baseZoom = this.H / 580;
    const trailLen = grid.trail.length;
    const zoom = baseZoom * (1 - Math.min(0.14, trailLen / 900));
    g.zoom += (zoom - g.zoom) * Math.min(1, dt * 3);
    if (!isFinite(g.zoom) || g.zoom <= 0) g.zoom = zoom;
    const look = 0.22;
    let tx = g.px + g.pvx * look, ty = g.py + g.pvy * look;
    const halfW = this.W / 2 / g.zoom, halfH = this.H / 2 / g.zoom;
    const margin = 90;
    tx = g.W + margin * 2 < halfW * 2 ? g.W / 2 : clamp(tx, halfW - margin, g.W - halfW + margin);
    ty = g.H + margin * 2 < halfH * 2 ? g.H / 2 : clamp(ty, halfH - margin, g.H - halfH + margin);
    g.camX += (tx - g.camX) * Math.min(1, dt * 6);
    g.camY += (ty - g.camY) * Math.min(1, dt * 6);
    const shakeAmt = g.shake * g.run.save.settings.shake;
    const sx = (Math.random() - 0.5) * shakeAmt, sy = (Math.random() - 0.5) * shakeAmt;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0a10';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const z = g.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, z, (this.W / 2 - (g.camX + sx) * g.zoom) * this.dpr, (this.H / 2 - (g.camY + sy) * g.zoom) * this.dpr);
    const view = { x0: g.camX - halfW - 40, y0: g.camY - halfH - 40, x1: g.camX + halfW + 40, y1: g.camY + halfH + 40 };
    this.drawWorld(g, view, dt);

    // screen-space overlays
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawVignette(g);
    if (this.hudVisible) this.drawHUD(g, dt);
    this.drawAnnounces(dt);
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, g.flash) * (g.run.save.settings.flashes ? 1 : 0.3)})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  private inView(v: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number, r = 0) {
    return x + r > v.x0 && x - r < v.x1 && y + r > v.y0 && y - r < v.y1;
  }

  // ------------------------------------------------------------------ world
  private drawWorld(g: Game, v: { x0: number; y0: number; x1: number; y1: number }, dt: number) {
    const ctx = this.ctx;
    const p = this.painter!;
    const W = g.W, H = g.H;
    // void + painted land (cropped to view)
    const sx0 = clamp(v.x0, 0, W), sy0 = clamp(v.y0, 0, H), sx1 = clamp(v.x1, 0, W), sy1 = clamp(v.y1, 0, H);
    if (sx1 > sx0 && sy1 > sy0) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(p.voidCanvas, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
      ctx.drawImage(p.canvas, sx0 * TS, sy0 * TS, (sx1 - sx0) * TS, (sy1 - sy0) * TS, sx0, sy0, sx1 - sx0, sy1 - sy0);
    }
    // map border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-2, -2, W + 4, H + 4);

    // fissure glow (Ember Canyon)
    if (g.fissures.length) {
      for (const f of g.fissures) {
        const tt = f.phase % f.period;
        const warn = tt > f.period - 2.6;
        const erupt = tt > f.period - 1.6;
        if (!warn) continue;
        const a = erupt ? 0.85 : 0.25 + 0.25 * Math.sin(g.time * 20);
        ctx.fillStyle = erupt ? `rgba(255,120,30,${a})` : `rgba(255,80,20,${a})`;
        ctx.beginPath();
        for (const c of f.cells) {
          if (g.grid.owned[c]) continue;
          const x = (c % g.grid.w) * CELL + CELL / 2, y = Math.floor(c / g.grid.w) * CELL + CELL / 2;
          if (!this.inView(v, x, y, 10)) continue;
          ctx.moveTo(x + 6, y);
          ctx.arc(x, y, erupt ? 7 : 5, 0, TAU);
        }
        ctx.fill();
      }
    }

    // puddles
    for (const pd of g.puddles) {
      ctx.fillStyle = rgba('#06d6a0', 0.25 * Math.min(1, pd.life));
      ctx.beginPath();
      ctx.arc(pd.x, pd.y, pd.r, 0, TAU);
      ctx.fill();
    }

    // features
    for (const f of g.features) {
      if (f.taken || !this.inView(v, f.x, f.y, 30)) continue;
      this.drawFeature(g, f.kind, f.x, f.y, f.pending >= 0);
    }

    // mines & turrets & golems
    for (const m of g.mines) {
      if (!this.inView(v, m.x, m.y, 10)) continue;
      ctx.fillStyle = m.arm > 0 ? '#6c1f33' : '#ef476f';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, TAU);
      ctx.fill();
      if (m.arm <= 0 && Math.sin(g.time * 8 + m.x) > 0) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.8, 0, TAU);
        ctx.fill();
      }
    }
    for (const tu of g.turrets) {
      if (!this.inView(v, tu.x, tu.y, 20)) continue;
      this.drawEasel(tu.x, tu.y, tu.ang);
    }
    const golemEvo = g.run.weapon('golems')?.evolved;
    for (const gl of g.golems) {
      if (!this.inView(v, gl.x, gl.y, 20)) continue;
      this.drawGolem(gl.x, gl.y, gl.bob, golemEvo ? 1.5 : 1, g.biome.pal.land[1], g.biome.pal.edge);
    }

    // pickups
    for (const pk of g.pickups) {
      if (!this.inView(v, pk.x, pk.y, 10)) continue;
      this.drawPickup(pk.kind, pk.x, pk.y, pk.value, g.time);
    }

    // trail
    this.drawTrail(g);

    // rain markers
    for (const d of g.drops) {
      ctx.strokeStyle = rgba('#4cc9f0', 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * (0.4 + 0.6 * clamp(1 - d.t / 0.5, 0, 1)), 0, TAU);
      ctx.stroke();
    }

    // enemies (bosses last)
    let boss: Enemy | null = null;
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.boss) { boss = e; continue; }
      if (!this.inView(v, e.x, e.y, e.r + 10)) continue;
      this.drawEnemy(g, e);
    }
    if (boss) this.drawBoss(g, boss);

    // projectiles
    for (const pr of g.projs) {
      if (!this.inView(v, pr.x, pr.y, 20)) continue;
      if (pr.hostile) {
        ctx.fillStyle = '#1b1a22';
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.r + 1.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.r - 1, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glow(pr.color), pr.x - pr.r * 3, pr.y - pr.r * 3, pr.r * 6, pr.r * 6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.r * 0.6, 0, TAU);
        ctx.fill();
      }
    }

    // orbs
    const orbCol = WEAPONS.find((w) => w.id === 'orbit')!.color;
    for (const o of orbPositions(g)) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.glow(orbCol), o.x - 18, o.y - 18, 36, 36);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 5.5, 0, TAU);
      ctx.fill();
    }

    // player
    if (!g.over || g.hp > 0) this.drawPlayer(g);

    // beams
    for (const b of g.beams) {
      const a = b.life / 0.22;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.ang);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(b.color, 0.35 * a);
      ctx.fillRect(0, -b.w, b.len, b.w * 2);
      ctx.fillStyle = rgba('#ffffff', 0.8 * a);
      ctx.fillRect(0, -b.w * 0.3, b.len, b.w * 0.6);
      ctx.restore();
    }

    // shockwaves
    for (const s of g.shocks) {
      const a = s.life / s.maxLife;
      ctx.strokeStyle = rgba(s.color, 0.8 * a);
      ctx.lineWidth = s.width * a + 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(1, s.r), 0, TAU);
      ctx.stroke();
    }

    // particles
    const P = g.parts;
    for (let i = 0; i < P.count; i++) {
      const x = P.x[i], y = P.y[i];
      if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
      const lf = P.life[i] / P.max[i];
      const s = P.size[i];
      ctx.globalAlpha = Math.min(1, lf * 1.6);
      ctx.fillStyle = P.color[i];
      switch (P.kind[i]) {
        case 0:
          ctx.beginPath();
          ctx.arc(x, y, s * (0.4 + 0.6 * lf), 0, TAU);
          ctx.fill();
          break;
        case 1:
          ctx.strokeStyle = P.color[i];
          ctx.lineWidth = s * 0.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - P.vx[i] * 0.04, y - P.vy[i] * 0.04);
          ctx.stroke();
          break;
        case 2:
          ctx.fillRect(x - s / 2, y - s / 2, s, s * 0.7);
          break;
        case 3: {
          const k = s * lf;
          ctx.fillRect(x - k, y - k * 0.2, k * 2, k * 0.4);
          ctx.fillRect(x - k * 0.2, y - k, k * 0.4, k * 2);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;

    // floating texts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const tx of g.texts.list) {
      if (!this.inView(v, tx.x, tx.y, 40)) continue;
      const a = Math.min(1, tx.life / tx.max * 2.5);
      const pop = 1 + Math.max(0, (tx.life - tx.max + 0.12) / 0.12) * 0.4;
      ctx.globalAlpha = a;
      ctx.font = `700 ${tx.size * pop}px ${FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,8,16,0.85)';
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;

    // home arrow
    this.homeT -= dt;
    if (g.grid.trail.length > 0 && !g.stageCleared) {
      if (this.homeT <= 0) {
        this.homeT = 0.2;
        const hc = g.grid.nearestOwned(g.px / CELL, g.py / CELL, 120);
        this.homeTarget = hc >= 0 ? { x: (hc % g.grid.w) * CELL + CELL / 2, y: Math.floor(hc / g.grid.w) * CELL + CELL / 2 } : null;
      }
      if (this.homeTarget) {
        const a = Math.atan2(this.homeTarget.y - g.py, this.homeTarget.x - g.px);
        const d = Math.hypot(this.homeTarget.y - g.py, this.homeTarget.x - g.px);
        if (d > 40) {
          const r = 26;
          const danger = g.fuse >= 0;
          ctx.save();
          ctx.translate(g.px + Math.cos(a) * r, g.py + Math.sin(a) * r);
          ctx.rotate(a);
          ctx.fillStyle = danger ? (Math.sin(g.time * 20) > 0 ? '#ff4d6d' : '#ffd166') : rgba(g.biome.pal.edge, 0.85);
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-4, -5);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-4, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  private drawTrail(g: Game) {
    const pts = g.trailPts;
    if (pts.length < 2 || g.grid.trail.length === 0) return;
    const ctx = this.ctx;
    const col = g.run.char.color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const path = () => {
      ctx.beginPath();
      // start from the territory edge (first trail cell center) for a clean join
      const c0 = g.grid.trail[0];
      ctx.moveTo((c0 % g.grid.w) * CELL + CELL / 2, Math.floor(c0 / g.grid.w) * CELL + CELL / 2);
      for (let k = 0; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
      ctx.lineTo(g.px, g.py);
    };
    path();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = g.boldT > 0 ? '#ffffff' : col;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.45);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // thorny trail marks
    if (g.run.weapon('thorns') || g.run.has('rosethorn')) {
      ctx.fillStyle = '#e0aaff';
      for (let k = 0; k < pts.length; k += 8) {
        ctx.beginPath();
        ctx.arc(pts[k], pts[k + 1], 1.8, 0, TAU);
        ctx.fill();
      }
    }
    // burning section
    if (g.fuse >= 0 && g.fuseStart >= 0) {
      const a = g.trailPtIdx[Math.max(0, Math.floor(g.fuseStart))] ?? 0;
      const b = g.trailPtIdx[Math.min(g.trailPtIdx.length - 1, Math.floor(g.fuse))] ?? a;
      ctx.beginPath();
      for (let k = a; k <= b && k * 2 < pts.length; k++) {
        if (k === a) ctx.moveTo(pts[k * 2], pts[k * 2 + 1]);
        else ctx.lineTo(pts[k * 2], pts[k * 2 + 1]);
      }
      ctx.strokeStyle = Math.sin(g.time * 30) > 0 ? '#ff4d00' : '#ffd166';
      ctx.lineWidth = 7;
      ctx.stroke();
      const head = g.trailPointAt(g.fuse);
      if (head) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glow('#ff7b3a'), head[0] - 20, head[1] - 20, 40, 40);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  private drawPlayer(g: Game) {
    const ctx = this.ctx;
    const ch = g.run.char;
    const x = g.px, y = g.py;
    if (g.invuln > 0 && Math.floor(g.time * 20) % 2 === 0 && g.dashT <= 0) ctx.globalAlpha = 0.5;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 9, 3.5, 0, 0, TAU);
    ctx.fill();
    const bob = g.moving ? Math.sin(g.realTime * 16) * 1.2 : 0;
    const face = Math.cos(g.facing) >= 0 ? 1 : -1;
    // brush (behind)
    const ba = g.facing;
    const hx = x + Math.cos(ba) * 7, hy = y + bob + Math.sin(ba) * 7;
    ctx.strokeStyle = '#8d5524';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ba) * 2, y + bob - Math.sin(ba) * 2);
    ctx.lineTo(hx + Math.cos(ba) * 8, hy + Math.sin(ba) * 8);
    ctx.stroke();
    ctx.fillStyle = ch.color2;
    ctx.beginPath();
    ctx.ellipse(hx + Math.cos(ba) * 11, hy + Math.sin(ba) * 11, 4.5, 3, ba, 0, TAU);
    ctx.fill();
    // body
    ctx.fillStyle = '#1b1a22';
    ctx.beginPath();
    ctx.arc(x, y + bob, 9.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = g.hurtFlash > 0 ? '#ffb3c1' : '#fff8e7';
    ctx.beginPath();
    ctx.arc(x, y + bob, 8, 0, TAU);
    ctx.fill();
    // hat
    ctx.fillStyle = ch.color;
    ctx.beginPath();
    ctx.ellipse(x - face * 1, y + bob - 5.5, 8.5, 4.2, -0.15 * face, Math.PI, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - face * 6, y + bob - 9, 2.6, 0, TAU);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#1b1a22';
    ctx.beginPath();
    ctx.arc(x + face * 2.5 - 1.2, y + bob - 0.5, 1.3, 0, TAU);
    ctx.arc(x + face * 2.5 + 2.4, y + bob - 0.5, 1.3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // bold stroke aura / wall
    if (g.boldT > 0 || g.wallT > 0) {
      ctx.strokeStyle = rgba(ch.color, 0.6 + 0.3 * Math.sin(g.time * 12));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y + bob, 15, 0, TAU);
      ctx.stroke();
    }
  }

  private drawEnemy(g: Game, e: Enemy) {
    const ctx = this.ctx;
    const def = e.def;
    let x = e.x, y = e.y;
    let sc = 1;
    if (e.spawnT > 0) sc = clamp(1 - e.spawnT / 0.35, 0, 1);
    if (e.captureAt >= 0) {
      x += (Math.random() - 0.5) * 2.5;
      y += (Math.random() - 0.5) * 2.5;
    }
    const r = e.r * sc;
    if (r <= 0.5) return;
    const ph = def.id === 'phantom';
    if (ph) ctx.globalAlpha = 0.55 + 0.2 * Math.sin(g.time * 4 + e.uid);
    if (def.ai === 'nest') {
      this.drawNest(g, e);
      ctx.globalAlpha = 1;
      return;
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.8, r * 0.9, r * 0.35, 0, 0, TAU);
    ctx.fill();
    // telegraph for chargers
    if (def.ai === 'charger' && e.state === 1) {
      ctx.strokeStyle = rgba('#ff9f1c', 0.5);
      ctx.lineWidth = r * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + e.dirX * 180, y + e.dirY * 180);
      ctx.stroke();
      x += (Math.random() - 0.5) * 3;
    }
    // elite glow
    if (e.elite) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.glow(def.color), x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      ctx.globalCompositeOperation = 'source-over';
    }
    // body: ink blob with wobbly edge
    const wob = e.t * 6 + e.uid;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#17151f';
    ctx.beginPath();
    const n = 10;
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * TAU;
      const rr = r * (1 + 0.08 * Math.sin(a * 3 + wob));
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.95;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = e.elite ? 2.5 : 1.6;
    ctx.stroke();
    // type marks
    if (def.id === 'drip' || def.id === 'split') {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.95, r * 0.22, 0, TAU);
      ctx.fill();
    }
    if (def.ai === 'trail') {
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 1.1);
      ctx.lineTo(x - r * 0.2, y - r * 0.6);
      ctx.moveTo(x + r * 0.7, y - r * 1.1);
      ctx.lineTo(x + r * 0.2, y - r * 0.6);
      ctx.stroke();
    }
    if (def.ai === 'turret') {
      ctx.fillStyle = def.color;
      ctx.fillRect(x - r * 0.9, y + r * 0.5, r * 1.8, r * 0.5);
    }
    if (e.elite) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.8);
      ctx.lineTo(x - r * 0.35, y - r * 1.35);
      ctx.lineTo(x, y - r * 0.95);
      ctx.lineTo(x + r * 0.35, y - r * 1.35);
      ctx.lineTo(x + r * 0.5, y - r * 0.8);
      ctx.fill();
    }
    // eyes look at player
    const la = Math.atan2(g.py - y, g.px - x);
    const ex = Math.cos(la) * r * 0.18, ey = Math.sin(la) * r * 0.18;
    const eyeR = Math.max(1.4, r * 0.24);
    ctx.fillStyle = ph ? '#e0aaff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x - r * 0.33 + ex, y - r * 0.12 + ey, eyeR, 0, TAU);
    ctx.arc(x + r * 0.33 + ex, y - r * 0.12 + ey, eyeR, 0, TAU);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(x - r * 0.33 + ex * 1.6, y - r * 0.12 + ey * 1.6, eyeR * 0.5, 0, TAU);
    ctx.arc(x + r * 0.33 + ex * 1.6, y - r * 0.12 + ey * 1.6, eyeR * 0.5, 0, TAU);
    ctx.fill();
    // herd alertness
    if (def.herd && e.captureAt < 0) {
      const mark = e.state === 0 && e.t3 > 0.3 ? '?' : e.state === 1 && e.phase > 0 ? '!' : '';
      if (mark) {
        ctx.font = `700 ${Math.max(10, r * 1.3)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#17151f';
        ctx.strokeText(mark, x, y - r * 1.6);
        ctx.fillStyle = mark === '!' ? '#ff4d6d' : '#ffd166';
        ctx.fillText(mark, x, y - r * 1.6);
      }
    }
    // hp bar for tanky ones
    if ((e.elite || def.hp >= 40) && e.hp < e.maxHp && !def.immune) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - r, y - r - 7, r * 2, 3);
      ctx.fillStyle = def.color;
      ctx.fillRect(x - r, y - r - 7, r * 2 * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
    // capture ring
    if (e.captureAt >= 0) {
      ctx.strokeStyle = rgba('#ffffff', 0.9);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 3 + Math.max(0, (e.captureAt - g.time)) * 20, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawNest(g: Game, e: Enemy) {
    const ctx = this.ctx;
    const r = e.r;
    const pulse = 1 + 0.06 * Math.sin(g.time * 3 + e.uid);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.glow('#7b2cbf'), e.x - r * 2.5, e.y - r * 2.5, r * 5, r * 5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#10061c';
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + g.time * 0.3;
      const rr = r * pulse * (k % 2 ? 0.8 : 1.05);
      if (k === 0) ctx.moveTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
      else ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c77dff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#c77dff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.3, 0, TAU);
    ctx.fill();
    if (e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - r, e.y - r - 8, r * 2, 3);
      ctx.fillStyle = '#c77dff';
      ctx.fillRect(e.x - r, e.y - r - 8, r * 2 * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
    if (e.captureAt >= 0) {
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 5, 0, TAU);
      ctx.stroke();
    }
  }

  private drawBoss(g: Game, e: Enemy) {
    const ctx = this.ctx;
    const def = e.def;
    let x = e.x, y = e.y;
    const sc = e.spawnT > 0 ? clamp(1 - e.spawnT / 1.2, 0, 1) : 1;
    const r = e.r * sc;
    if (e.captureAt >= 0) {
      x += (Math.random() - 0.5) * 5;
      y += (Math.random() - 0.5) * 5;
    }
    if (e.hidden) {
      // submerged ripple
      ctx.strokeStyle = rgba(def.color, 0.5);
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(x, y, r * (0.6 + ((g.time * 0.8 + k / 3) % 1)), r * 0.35 * (0.6 + ((g.time * 0.8 + k / 3) % 1)), 0, 0, TAU);
        ctx.stroke();
      }
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.glow(def.color), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    ctx.globalCompositeOperation = 'source-over';
    // wyrm body
    if (e.segs) {
      for (let s = e.segs.length - 1; s >= 0; s--) {
        const sg = e.segs[s];
        const rr = 18 * (1 - s / e.segs.length * 0.5);
        ctx.fillStyle = '#1b0f0f';
        ctx.beginPath();
        ctx.arc(sg.x, sg.y, rr + 2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = s % 2 ? '#ff4d00' : '#ffb627';
        ctx.beginPath();
        ctx.arc(sg.x, sg.y, rr, 0, TAU);
        ctx.fill();
      }
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r, r * 0.35, 0, 0, TAU);
    ctx.fill();
    // telegraphs
    if ((def.id === 'eraser' && e.state === 1) || (def.id === 'smudge' && e.state === 1)) {
      ctx.strokeStyle = rgba('#ff4d6d', 0.35 + 0.25 * Math.sin(g.time * 25));
      ctx.lineWidth = def.id === 'eraser' ? r * 2 : 4;
      ctx.beginPath();
      if (def.id === 'eraser') {
        ctx.moveTo(x, y);
        ctx.lineTo(x + e.dirX * 500, y + e.dirY * 500);
      } else {
        ctx.arc(e.dirX, e.dirY, 100, 0, TAU);
      }
      ctx.stroke();
    }
    const flash = e.flash > 0;
    switch (def.id) {
      case 'eraser': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(e.dirY, e.dirX));
        ctx.fillStyle = flash ? '#fff' : '#f4f1de';
        roundRect(ctx, -r * 1.2, -r * 0.7, r * 2.4, r * 1.4, 10);
        ctx.fill();
        ctx.fillStyle = flash ? '#fff' : '#ff8fab';
        roundRect(ctx, -r * 1.2, -r * 0.7, r * 0.9, r * 1.4, 10);
        ctx.fill();
        ctx.strokeStyle = '#1b1a22';
        ctx.lineWidth = 3;
        roundRect(ctx, -r * 1.2, -r * 0.7, r * 2.4, r * 1.4, 10);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'blank': {
        ctx.fillStyle = flash ? '#ddd' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#0b0a10';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.72, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#e0aaff';
        ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(x, y, r * (0.3 + k * 0.15), g.time * (1 + k) , g.time * (1 + k) + Math.PI * 1.2);
          ctx.stroke();
        }
        break;
      }
      default: {
        const wob = g.time * 3;
        ctx.fillStyle = flash ? '#ffffff' : '#17151f';
        ctx.beginPath();
        for (let k = 0; k <= 16; k++) {
          const a = (k / 16) * TAU;
          const rr = r * (1 + 0.06 * Math.sin(a * 4 + wob));
          if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 4;
        ctx.stroke();
        if (def.id === 'smudge') {
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.moveTo(x - r * 0.55, y - r * 0.75);
          ctx.lineTo(x - r * 0.5, y - r * 1.35);
          ctx.lineTo(x - r * 0.2, y - r * 1.0);
          ctx.lineTo(x, y - r * 1.45);
          ctx.lineTo(x + r * 0.2, y - r * 1.0);
          ctx.lineTo(x + r * 0.5, y - r * 1.35);
          ctx.lineTo(x + r * 0.55, y - r * 0.75);
          ctx.fill();
        }
        if (def.id === 'mire') {
          ctx.fillStyle = def.color;
          for (let k = 0; k < 5; k++) {
            ctx.beginPath();
            ctx.arc(x - r * 0.8 + k * r * 0.4, y + r * 0.95 + Math.sin(g.time * 3 + k) * 3, r * 0.12, 0, TAU);
            ctx.fill();
          }
        }
        // eyes
        const la = Math.atan2(g.py - y, g.px - x);
        const ex = Math.cos(la) * r * 0.12, ey = Math.sin(la) * r * 0.12;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - r * 0.32 + ex, y - r * 0.1 + ey, r * 0.2, 0, TAU);
        ctx.arc(x + r * 0.32 + ex, y - r * 0.1 + ey, r * 0.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(x - r * 0.32 + ex * 1.8, y - r * 0.1 + ey * 1.8, r * 0.09, 0, TAU);
        ctx.arc(x + r * 0.32 + ex * 1.8, y - r * 0.1 + ey * 1.8, r * 0.09, 0, TAU);
        ctx.fill();
      }
    }
    if (e.captureAt >= 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 6 + Math.max(0, e.captureAt - g.time) * 40, 0, TAU);
      ctx.stroke();
    }
  }

  private drawFeature(g: Game, kind: string, x: number, y: number, pending: boolean) {
    const ctx = this.ctx;
    const t = g.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + x);
    // "capture me" dashed ring
    ctx.strokeStyle = rgba(g.biome.pal.edge, 0.25 + 0.25 * pulse);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 18, t * 0.5, t * 0.5 + TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    if (pending) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 30);
    switch (kind) {
      case 'cache': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glow('#ffb627'), x - 24, y - 24, 48, 48);
        ctx.globalCompositeOperation = 'source-over';
        const cols = ['#ffd166', '#f4a261', '#ffe8a3'];
        for (let k = 0; k < 3; k++) {
          const ox = (k - 1) * 5, h = 10 + (k === 1 ? 5 : 0);
          ctx.fillStyle = cols[k];
          ctx.beginPath();
          ctx.moveTo(x + ox, y - h);
          ctx.lineTo(x + ox + 4, y + 2);
          ctx.lineTo(x + ox, y + 5);
          ctx.lineTo(x + ox - 4, y + 2);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'chest': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glow('#ffd166'), x - 26, y - 26, 52, 52);
        ctx.globalCompositeOperation = 'source-over';
        this.drawChest(x, y, 1);
        break;
      }
      case 'shrine': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glow('#80ffdb'), x - 30, y - 30, 60, 60);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#d8d0c8';
        ctx.fillRect(x - 5, y - 4, 10, 12);
        ctx.fillStyle = '#b0a79f';
        ctx.fillRect(x - 7, y + 6, 14, 3);
        ctx.fillStyle = '#80ffdb';
        ctx.beginPath();
        ctx.arc(x, y - 9 + Math.sin(t * 2) * 2, 5, 0, TAU);
        ctx.fill();
        break;
      }
      case 'flower': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glow('#ff8fab'), x - 24, y - 24, 48, 48);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#2d6a4f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x, y - 2);
        ctx.stroke();
        ctx.fillStyle = '#ff8fab';
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + t;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * 4, y - 5 + Math.sin(a) * 4, 3, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath();
        ctx.arc(x, y - 5, 2.5, 0, TAU);
        ctx.fill();
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawChest(x: number, y: number, s: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#1b1a22';
    ctx.fillRect(x - 9 * s, y - 7 * s, 18 * s, 14 * s);
    ctx.fillStyle = '#c9832e';
    ctx.fillRect(x - 8 * s, y - 6 * s, 16 * s, 12 * s);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - 8 * s, y - 2 * s, 16 * s, 2.5 * s);
    ctx.fillRect(x - 1.5 * s, y - 3 * s, 3 * s, 5 * s);
  }

  private drawPickup(kind: string, x: number, y: number, value: number, t: number) {
    const ctx = this.ctx;
    switch (kind) {
      case 'xp': {
        const col = value >= 10 ? '#f15bb5' : value >= 3 ? '#06d6a0' : '#4cc9f0';
        const s = value >= 10 ? 5 : value >= 3 ? 4 : 3;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x, y - s * 1.3);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s * 1.3);
        ctx.lineTo(x - s, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(x - s * 0.3, y - s * 0.7, s * 0.4, s * 0.5);
        break;
      }
      case 'crimson':
      case 'ochre': {
        const col = kind === 'crimson' ? '#ef233c' : '#ffb627';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.quadraticCurveTo(x + 5, y, x, y + 4);
        ctx.quadraticCurveTo(x - 5, y, x, y - 7);
        ctx.fill();
        ctx.strokeStyle = '#1b1a22';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
      case 'heart': {
        const s = 1 + 0.1 * Math.sin(t * 6);
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath();
        ctx.moveTo(x, y + 5 * s);
        ctx.bezierCurveTo(x - 9 * s, y - 2 * s, x - 4 * s, y - 9 * s, x, y - 4 * s);
        ctx.bezierCurveTo(x + 4 * s, y - 9 * s, x + 9 * s, y - 2 * s, x, y + 5 * s);
        ctx.fill();
        break;
      }
      case 'magnet': {
        ctx.strokeStyle = '#ef233c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 5, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#ddd';
        ctx.fillRect(x - 6.5, y, 3, 3);
        ctx.fillRect(x + 3.5, y, 3, 3);
        break;
      }
      case 'chest': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glow('#ffd166'), x - 24, y - 24, 48, 48);
        ctx.globalCompositeOperation = 'source-over';
        this.drawChest(x, y + Math.sin(t * 4) * 2, 1);
        break;
      }
    }
  }

  private drawEasel(x: number, y: number, ang: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#8d5524';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 9);
    ctx.lineTo(x, y - 8);
    ctx.lineTo(x + 6, y + 9);
    ctx.stroke();
    ctx.fillStyle = '#fff8e7';
    ctx.fillRect(x - 7, y - 10, 14, 10);
    ctx.fillStyle = '#f4a261';
    ctx.beginPath();
    ctx.arc(x + Math.cos(ang) * 3, y - 5 + Math.sin(ang) * 2, 3, 0, TAU);
    ctx.fill();
  }

  private drawGolem(x: number, y: number, bob: number, s: number, col: string, edge: string) {
    const ctx = this.ctx;
    const b = Math.sin(bob * 6) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 9 * s, 8 * s, 3 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = edge;
    roundRect(ctx, x - 8 * s, y - 6 * s + b, 16 * s, 14 * s, 4 * s);
    ctx.fill();
    ctx.fillStyle = col;
    roundRect(ctx, x - 6.5 * s, y - 4.5 * s + b, 13 * s, 11 * s, 3 * s);
    ctx.fill();
    ctx.fillStyle = '#1b1a22';
    ctx.fillRect(x - 3.5 * s, y - 1 * s + b, 2 * s, 2 * s);
    ctx.fillRect(x + 1.5 * s, y - 1 * s + b, 2 * s, 2 * s);
  }

  private drawVignette(g: Game) {
    const ctx = this.ctx;
    const danger = g.fuse >= 0 ? 0.35 + 0.2 * Math.sin(g.time * 14) : 0;
    const hurt = g.hurtFlash * 1.5;
    const lowHp = g.hp / g.run.s.maxHp < 0.25 ? 0.2 + 0.1 * Math.sin(g.time * 5) : 0;
    const a = Math.max(danger, hurt, lowHp);
    const grd = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, a > 0 ? `rgba(200,20,50,${a})` : 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  // ------------------------------------------------------------------ HUD
  private drawHUD(g: Game, dt: number) {
    const ctx = this.ctx;
    const run = g.run;
    const s = clamp(Math.min(this.W / 1280, this.H / 720), 0.62, 1.6);
    const pad = 16 * s;
    ctx.textBaseline = 'middle';

    // HP + XP (top-left)
    const bw = 250 * s, bh = 18 * s;
    this.panel(pad - 6 * s, pad - 6 * s, bw + 12 * s, bh * 2 + 26 * s);
    const hpFrac = clamp(g.hp / run.s.maxHp, 0, 1);
    this.bar(pad, pad, bw, bh, hpFrac, '#ff4d6d', '#5c1a2a');
    ctx.font = `600 ${12 * s}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.ceil(Math.max(0, g.hp))} / ${run.s.maxHp}`, pad + 8 * s, pad + bh / 2 + 1);
    const xpFrac = clamp(run.xp / run.xpNeed(), 0, 1);
    this.bar(pad, pad + bh + 8 * s, bw, bh * 0.7, xpFrac, '#4cc9f0', '#16324a');
    ctx.font = `700 ${12 * s}px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`${t('LV')} ${run.level}`, pad + 8 * s, pad + bh + 8 * s + bh * 0.35 + 1);
    // guard pips
    if (run.s.guard > 0) {
      for (let k = 0; k < run.s.guard; k++) {
        ctx.fillStyle = k < g.guardLeft ? '#caf0f8' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(pad + bw - 8 * s - k * 12 * s, pad + bh + 8 * s + bh * 0.35, 4 * s, 0, TAU);
        ctx.fill();
      }
    }

    // territory bar (top-center)
    const pct = g.percent;
    if (pct > this.lastPct + 0.0005) this.pctPulse = 1;
    this.lastPct = pct;
    this.pctPulse = Math.max(0, this.pctPulse - dt * 2);
    const tw = Math.min(520 * s, this.W * 0.42), th = 20 * s;
    const tx = this.W / 2 - tw / 2, ty = pad + 16 * s;
    this.panel(tx - 10 * s, pad - 6 * s, tw + 20 * s, th + 44 * s);
    ctx.textAlign = 'center';
    ctx.font = `600 ${13 * s}px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const stageLabel = run.mode === 'endless' ? `${t('CYCLE')} ${run.cycle + 1} · ${run.stageIdx + 1}/5` : `${t('STAGE')} ${run.stageIdx + 1}/5`;
    ctx.fillText(`${tr(g.biome.name)} · ${stageLabel} · ${fmtTime(g.time)}${g.anomaly ? ' · ⚠ ' + tr(g.anomaly.name) : ''}`, this.W / 2, pad + 4 * s);
    this.bar(tx, ty, tw, th, clamp(pct, 0, 1), g.biome.pal.land[0], 'rgba(255,255,255,0.08)', g.biome.pal.edge, this.pctPulse);
    const gx = tx + tw * g.goal;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx - 1.5 * s, ty - 4 * s, 3 * s, th + 8 * s);
    ctx.font = `700 ${14 * s}px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    const pctText = `${(pct * 100).toFixed(1)}%  /  ${t('GOAL')} ${Math.round(g.goal * 100)}%`;
    ctx.strokeText(pctText, this.W / 2, ty + th / 2 + 1);
    ctx.fillText(pctText, this.W / 2, ty + th / 2 + 1);
    // boss bar
    if (g.boss) {
      const by = ty + th + 22 * s;
      const bwid = tw;
      this.panel(tx - 10 * s, by - 18 * s, bwid + 20 * s, 36 * s);
      ctx.font = `700 ${13 * s}px ${FONT}`;
      ctx.fillStyle = g.boss.def.color === '#ffffff' ? '#e0aaff' : g.boss.def.color;
      ctx.fillText(tr(g.boss.def.name), this.W / 2, by - 6 * s);
      this.bar(tx, by + 3 * s, bwid, 10 * s, clamp(g.bossBar, 0, 1), '#ff4d6d', '#3a0f18');
    }

    // minimap (top-right)
    const p = this.painter!;
    const mw = 200 * s, mh = (mw * g.grid.h) / g.grid.w;
    const mx = this.W - pad - mw, my = pad;
    this.panel(mx - 6 * s, my - 6 * s, mw + 12 * s, mh + 12 * s);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(p.mini, mx, my, mw, mh);
    ctx.imageSmoothingEnabled = true;
    const ms = mw / g.W;
    // trail
    if (g.trailPts.length > 2) {
      ctx.strokeStyle = run.char.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < g.trailPts.length; k += 2) {
        const X = mx + g.trailPts[k] * ms, Y = my + g.trailPts[k + 1] * ms;
        if (k === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
      ctx.lineTo(mx + g.px * ms, my + g.py * ms);
      ctx.stroke();
    }
    for (const f of g.features) {
      if (f.taken) continue;
      ctx.fillStyle = f.kind === 'chest' ? '#ffd166' : f.kind === 'shrine' ? '#80ffdb' : f.kind === 'flower' ? '#ff8fab' : '#ffb627';
      ctx.fillRect(mx + f.x * ms - 1.5, my + f.y * ms - 1.5, 3, 3);
    }
    for (const e of g.enemies) {
      if (e.dead || e.hidden) continue;
      if (e.def.ai === 'nest') ctx.fillStyle = '#c77dff';
      else if (e.boss) ctx.fillStyle = '#ff4d6d';
      else if (e.elite) ctx.fillStyle = '#ffd166';
      else continue;
      const rr = e.boss ? 4 : 2.5;
      ctx.fillRect(mx + e.x * ms - rr, my + e.y * ms - rr, rr * 2, rr * 2);
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx + g.px * ms, my + g.py * ms, 3.2, 0, TAU);
    ctx.fill();
    // view rect
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    const vw = (this.W / g.zoom) * ms, vh = (this.H / g.zoom) * ms;
    ctx.strokeRect(mx + g.camX * ms - vw / 2, my + g.camY * ms - vh / 2, vw, vh);

    // pigments + relics (below minimap)
    let ry = my + mh + 18 * s;
    ctx.textAlign = 'right';
    ctx.font = `600 ${13 * s}px ${FONT}`;
    const pig: [string, number][] = [['#ef233c', run.pig.crimson], ['#3a86ff', run.pig.azure], ['#ffb627', run.pig.ochre]];
    let px0 = this.W - pad;
    for (let k = pig.length - 1; k >= 0; k--) {
      const [col, v] = pig[k];
      const txt = fmtNum(v);
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, px0, ry);
      const w = ctx.measureText(txt).width;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px0 - w - 8 * s, ry, 5 * s, 0, TAU);
      ctx.fill();
      px0 -= w + 26 * s;
    }
    ry += 18 * s;
    let rx = this.W - pad - 14 * s;
    for (const id of run.relics) {
      const def = RELICS.find((r) => r.id === id)!;
      this.iconBadge(rx, ry + 10 * s, 13 * s, def.icon, def.color, 0, false);
      rx -= 30 * s;
      if (rx < this.W - pad - 200 * s) {
        rx = this.W - pad - 14 * s;
        ry += 30 * s;
      }
    }

    // blessing
    if (run.blessing) {
      ctx.textAlign = 'center';
      ctx.font = `700 ${14 * s}px ${FONT}`;
      ctx.fillStyle = '#80ffdb';
      const names: Record<string, string> = { frenzy: t('BL_FRENZY'), haste: t('BL_HASTE'), wisdom: t('BL_WISDOM'), aegis: t('BL_AEGIS') };
      ctx.fillText(`✦ ${names[run.blessing.kind]} ${Math.ceil(run.blessing.t)}s`, this.W / 2, this.H - 110 * s);
    }

    // weapons & passives (bottom-left)
    let ix = pad + 18 * s;
    const iy = this.H - pad - 58 * s;
    for (const w of run.weapons) {
      const def = WEAPONS.find((d) => d.id === w.id)!;
      this.iconBadge(ix, iy, 17 * s, def.icon, def.color, w.level, w.evolved);
      ix += 42 * s;
    }
    ix = pad + 14 * s;
    for (const [id, pv] of run.passives) {
      const def = PASSIVES.find((d) => d.id === id)!;
      this.iconBadge(ix, iy + 40 * s, 12 * s, def.icon, def.color, pv.level, false);
      ix += 32 * s;
    }

    // dash & special (bottom-center)
    const cx = this.W / 2, cy = this.H - pad - 30 * s;
    const pad2 = input.device === 'pad';
    this.cooldownDial(cx - 36 * s, cy, 22 * s, 1 - g.dashCd / run.s.dashCd, 'wind', pad2 ? 'A' : 'SPACE', '#90e0ef');
    const sp = CHARS.find((c) => c.id === run.char.id)!.special;
    this.cooldownDial(cx + 36 * s, cy, 22 * s, 1 - g.specialCd / (sp.cd * Math.max(0.5, run.s.cooldown)), 'star', pad2 ? 'X' : 'E', run.char.color);

    // fuse warning
    if (g.fuse >= 0) {
      ctx.textAlign = 'center';
      ctx.font = `800 ${22 * s}px ${FONT}`;
      const blink = Math.sin(g.time * 16) > 0;
      ctx.fillStyle = blink ? '#ffd166' : '#ff4d6d';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 4;
      ctx.strokeText(t('SPARK_WARN'), cx, this.H - 120 * s);
      ctx.fillText(t('SPARK_WARN'), cx, this.H - 120 * s);
    }

    // tutorial hints
    if (g.tutorial && g.tutorialStep < 3) {
      if (g.tutorialStep === 0 && g.grid.trail.length > 3) g.tutorialStep = 1;
      const key = g.tutorialStep === 0 ? 'TUT_0' : g.tutorialStep === 1 ? 'TUT_1' : 'TUT_2';
      if (g.tutorialStep === 2) {
        this.tutT = (this.tutT ?? 0) + dt;
        if (this.tutT > 9) g.tutorialStep = 3;
      }
      ctx.textAlign = 'center';
      ctx.font = `600 ${18 * s}px ${FONT}`;
      const msg = t(key as 'TUT_0');
      const w = ctx.measureText(msg).width + 40 * s;
      this.panel(cx - w / 2, this.H * 0.68 - 22 * s, w, 44 * s);
      ctx.fillStyle = '#fff';
      ctx.fillText(msg, cx, this.H * 0.68);
    }
  }
  private tutT = 0;

  private panel(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(14,12,22,0.62)';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
  }

  private bar(x: number, y: number, w: number, h: number, frac: number, col: string, bg: string, edge?: string, pulse = 0) {
    const ctx = this.ctx;
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = col;
      roundRect(ctx, x, y, Math.max(h, w * frac), h, h / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      roundRect(ctx, x + 2, y + 2, Math.max(h - 4, w * frac - 4), h * 0.35, h * 0.2);
      ctx.fill();
    }
    if (edge) {
      ctx.strokeStyle = pulse > 0 ? rgba('#ffffff', 0.5 + pulse * 0.5) : rgba(edge, 0.5);
      ctx.lineWidth = 1.5 + pulse * 2;
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.stroke();
    }
  }

  private iconBadge(x: number, y: number, r: number, icon: string, color: string, level: number, evolved: boolean) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(14,12,22,0.8)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = evolved ? '#ffd166' : color;
    ctx.lineWidth = evolved ? 3 : 2;
    ctx.stroke();
    ctx.save();
    const k = (r * 1.25) / 24;
    ctx.translate(x - 12 * k, y - 12 * k);
    ctx.scale(k, k);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(iconPath(icon));
    ctx.restore();
    if (level > 0) {
      ctx.fillStyle = evolved ? '#ffd166' : '#ffffff';
      ctx.font = `700 ${r * 0.72}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(evolved ? '★' : String(level), x + r * 0.8, y + r * 0.8);
    }
  }

  private cooldownDial(x: number, y: number, r: number, frac: number, icon: string, key: string, color: string) {
    const ctx = this.ctx;
    frac = clamp(frac, 0, 1);
    ctx.fillStyle = 'rgba(14,12,22,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = frac >= 1 ? color : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.stroke();
    ctx.save();
    const k = (r * 1.0) / 24;
    ctx.translate(x - 12 * k, y - 12 * k);
    ctx.scale(k, k);
    ctx.globalAlpha = frac >= 1 ? 1 : 0.4;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke(iconPath(icon));
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.font = `700 ${r * 0.45}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(key, x, y + r + 9);
  }

  private drawAnnounces(dt: number) {
    const ctx = this.ctx;
    const s = clamp(Math.min(this.W / 1280, this.H / 720), 0.62, 1.6);
    let y = this.H * 0.3;
    for (const a of this.announces) {
      a.t += dt;
      const life = 2.6;
      if (a.t > life) continue;
      const inT = Math.min(1, a.t / 0.25);
      const out = a.t > life - 0.5 ? (life - a.t) / 0.5 : 1;
      ctx.globalAlpha = inT * out;
      ctx.textAlign = 'center';
      const sc = 0.8 + 0.2 * inT;
      ctx.font = `800 ${38 * s * sc}px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(10,8,16,0.85)';
      ctx.strokeText(a.text, this.W / 2, y);
      ctx.fillStyle = a.color;
      ctx.fillText(a.text, this.W / 2, y);
      if (a.sub) {
        ctx.font = `600 ${18 * s}px ${FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeText(a.sub, this.W / 2, y + 34 * s);
        ctx.fillStyle = '#fff';
        ctx.fillText(a.sub, this.W / 2, y + 34 * s);
      }
      y += 80 * s;
    }
    ctx.globalAlpha = 1;
    this.announces = this.announces.filter((a) => a.t < 2.6);
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
