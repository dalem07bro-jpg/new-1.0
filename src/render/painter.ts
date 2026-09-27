// Territory painter: renders owned land as overlapping paint blobs (shadow → rim → fill) into a
// persistent offscreen canvas, updated incrementally as cells are revealed or lost.
import { mixHex } from '../core/math';
import { hash2 } from '../core/rng';
import type { BiomeDef } from '../data/content';
import { CELL, Grid, Terrain } from '../game/grid';

export const TS = 2; // territory canvas pixels per world unit

export class Painter {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  voidCanvas: HTMLCanvasElement;
  mini: HTMLCanvasElement;
  private miniCtx: CanvasRenderingContext2D;
  private miniImg: ImageData;
  vis: Uint8Array;
  private grid: Grid;
  private pal: BiomeDef['pal'];
  private fillCols: string[];
  private colIdx: Uint8Array;
  private stamp: Int32Array;
  private stamp2: Int32Array;
  private gen = 0;
  private landRGB: [number, number, number][];
  private voidRGB: [number, number, number];
  private rockRGB: [number, number, number];

  constructor(grid: Grid, biome: BiomeDef) {
    this.grid = grid;
    this.pal = biome.pal;
    const W = grid.w * CELL, H = grid.h * CELL;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W * TS;
    this.canvas.height = H * TS;
    this.ctx = this.canvas.getContext('2d')!;
    this.vis = new Uint8Array(grid.size);
    this.stamp = new Int32Array(grid.size);
    this.stamp2 = new Int32Array(grid.size);
    // palette: 3 land colours × 3 lightness variants
    this.fillCols = [];
    for (const c of biome.pal.land) {
      this.fillCols.push(mixHex(c, '#000000', 0.07), c, mixHex(c, '#ffffff', 0.1));
    }
    this.colIdx = new Uint8Array(grid.size);
    for (let i = 0; i < grid.size; i++) {
      const x = i % grid.w, y = Math.floor(i / grid.w);
      const n = valueNoise(x / 9, y / 9, 7) * 0.7 + valueNoise(x / 3.5, y / 3.5, 13) * 0.3;
      const base = Math.min(2, Math.floor(n * 3));
      const light = Math.min(2, Math.floor((valueNoise(x / 2.2, y / 2.2, 29) * 0.8 + hash2(x, y, 5) * 0.2) * 3));
      this.colIdx[i] = base * 3 + light;
    }
    const toRgb = (h: string): [number, number, number] => {
      const v = parseInt(h.slice(1), 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    };
    this.landRGB = biome.pal.land.map(toRgb);
    this.voidRGB = toRgb(biome.pal.void2);
    this.rockRGB = toRgb(biome.pal.rock);
    this.voidCanvas = this.buildVoid(biome);
    this.mini = document.createElement('canvas');
    this.mini.width = grid.w;
    this.mini.height = grid.h;
    this.miniCtx = this.mini.getContext('2d')!;
    this.miniImg = this.miniCtx.createImageData(grid.w, grid.h);
    for (let i = 0; i < grid.size; i++) this.setMini(i);
    this.miniCtx.putImageData(this.miniImg, 0, 0);
    this.drawAllRocks();
  }

  private setMini(i: number) {
    const d = this.miniImg.data;
    const o = i * 4;
    let c: [number, number, number];
    if (this.grid.terrain[i] === Terrain.Rock) c = this.rockRGB;
    else if (this.vis[i]) c = this.landRGB[Math.floor(this.colIdx[i] / 3)];
    else c = this.voidRGB;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }

  private buildVoid(biome: BiomeDef): HTMLCanvasElement {
    const g = this.grid;
    const W = g.w * CELL, H = g.h * CELL;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = biome.pal.void;
    ctx.fillRect(0, 0, W, H);
    // soft grey blotches
    for (let k = 0; k < 220; k++) {
      const x = hash2(k, 1, 3) * W, y = hash2(k, 2, 3) * H, r = 20 + hash2(k, 3, 3) * 90;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, biome.pal.void2);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    // canvas grain / cross-hatching (it's a blank canvas after all)
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let k = 0; k < 2500; k++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + hash2(k, 9, 1) * 0.04})`;
      ctx.fillRect(hash2(k, 7, 1) * W, hash2(k, 8, 1) * H, 1.5, 1.5);
    }
    // terrain decals
    for (let i = 0; i < g.size; i++) {
      const t = g.terrain[i];
      if (t === Terrain.Normal || t === Terrain.Rock) continue;
      const x = (i % g.w) * CELL + CELL / 2, y = Math.floor(i / g.w) * CELL + CELL / 2;
      if (t === Terrain.Bog) {
        ctx.fillStyle = 'rgba(20,60,70,0.55)';
        ctx.beginPath();
        ctx.arc(x, y, CELL * 0.85, 0, Math.PI * 2);
        ctx.fill();
        if (hash2(i, 1, 2) < 0.08) {
          ctx.strokeStyle = 'rgba(120,200,210,0.25)';
          ctx.beginPath();
          ctx.ellipse(x, y, 5, 2.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (t === Terrain.Fissure) {
        ctx.fillStyle = 'rgba(90,20,10,0.9)';
        ctx.beginPath();
        ctx.arc(x, y, CELL * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return cv;
  }

  private drawAllRocks() {
    const g = this.grid;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(TS, TS);
    this.rocksIn(ctx, 0, 0, g.w - 1, g.h - 1);
    ctx.restore();
  }

  private rocksIn(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const g = this.grid;
    const dark = mixHex(this.pal.rock, '#000000', 0.35), light = mixHex(this.pal.rock, '#ffffff', 0.18);
    const cells: number[] = [];
    for (let y = Math.max(0, y0); y <= Math.min(g.h - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(g.w - 1, x1); x++) if (g.terrain[y * g.w + x] === Terrain.Rock) cells.push(y * g.w + x);
    if (!cells.length) return;
    const pass = (col: string, r: number, dy: number) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (const i of cells) {
        const x = (i % g.w) * CELL + CELL / 2, y = Math.floor(i / g.w) * CELL + CELL / 2 + dy;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    };
    pass('rgba(0,0,0,0.35)', CELL * 0.85, 3);
    pass(dark, CELL * 0.8, 0);
    pass(this.pal.rock, CELL * 0.68, -1);
    ctx.fillStyle = light;
    ctx.beginPath();
    for (const i of cells) {
      if (hash2(i, 3, 3) > 0.35) continue;
      const x = (i % g.w) * CELL + CELL / 2 - 2, y = Math.floor(i / g.w) * CELL + CELL / 2 - 3;
      ctx.moveTo(x + 2, y);
      ctx.arc(x, y, 2, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  /** Reveal (paint) a set of cells. */
  paint(cells: number[]) {
    if (!cells.length) return;
    const g = this.grid;
    for (const i of cells) {
      this.vis[i] = 1;
      this.setMini(i);
    }
    const gen = ++this.gen;
    const rimSet: number[] = [];
    const fillSet: number[] = [];
    for (const i of cells) {
      const cx = i % g.w, cy = Math.floor(i / g.w);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
          const n = y * g.w + x;
          if (!this.vis[n]) continue;
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && this.stamp[n] !== gen) {
            rimSet.push(n);
            this.stamp[n] = gen;
          }
          if (this.stamp2[n] !== gen) {
            fillSet.push(n);
            this.stamp2[n] = gen;
          }
        }
      }
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(TS, TS);
    this.layer(ctx, cells, 'shadow');
    this.layer(ctx, rimSet, 'rim');
    this.layer(ctx, fillSet, 'fill');
    ctx.restore();
    this.miniCtx.putImageData(this.miniImg, 0, 0);
  }

  /** Remove paint for cells that lost ownership; repaint the neighbourhood. */
  erase(cells: number[]) {
    if (!cells.length) return;
    const g = this.grid;
    const ctx = this.ctx;
    for (const i of cells) {
      this.vis[i] = 0;
      this.setMini(i);
    }
    ctx.save();
    ctx.scale(TS, TS);
    // clip to the union of affected squares (cell ± 1.2 cells)
    ctx.beginPath();
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const i of cells) {
      const cx = i % g.w, cy = Math.floor(i / g.w);
      ctx.rect((cx - 1.2) * CELL, (cy - 1.2) * CELL, CELL * 3.4, CELL * 3.4);
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
    }
    ctx.clip();
    ctx.clearRect((x0 - 2) * CELL, (y0 - 2) * CELL, (x1 - x0 + 5) * CELL, (y1 - y0 + 5) * CELL);
    const gen = ++this.gen;
    const around: number[] = [];
    for (const i of cells) {
      const cx = i % g.w, cy = Math.floor(i / g.w);
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
          const n = y * g.w + x;
          if (this.vis[n] && this.stamp[n] !== gen) {
            this.stamp[n] = gen;
            around.push(n);
          }
        }
    }
    this.layer(ctx, around, 'shadow');
    this.layer(ctx, around, 'rim');
    this.layer(ctx, around, 'fill');
    this.rocksIn(ctx, x0 - 2, y0 - 2, x1 + 2, y1 + 2);
    ctx.restore();
    this.miniCtx.putImageData(this.miniImg, 0, 0);
  }

  private layer(ctx: CanvasRenderingContext2D, cells: number[], kind: 'shadow' | 'rim' | 'fill') {
    const g = this.grid;
    if (kind === 'shadow') {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      const r = CELL * 1.02;
      for (const i of cells) {
        const x = (i % g.w) * CELL + CELL / 2, y = Math.floor(i / g.w) * CELL + CELL / 2 + 2.5;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      return;
    }
    if (kind === 'rim') {
      ctx.fillStyle = this.pal.edge;
      ctx.beginPath();
      const r = CELL * 0.9;
      for (const i of cells) {
        const x = (i % g.w) * CELL + CELL / 2, y = Math.floor(i / g.w) * CELL + CELL / 2;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      return;
    }
    // fill grouped by palette index
    const r = CELL * 0.74;
    for (let c = 0; c < this.fillCols.length; c++) {
      ctx.fillStyle = this.fillCols[c];
      ctx.beginPath();
      let any = false;
      for (const i of cells) {
        if (this.colIdx[i] !== c) continue;
        any = true;
        const x = (i % g.w) * CELL + CELL / 2, y = Math.floor(i / g.w) * CELL + CELL / 2;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      if (any) ctx.fill();
    }
    // decorations: flowers, tufts, dots (deterministic per cell)
    for (const i of cells) {
      const cx = i % g.w, cy = Math.floor(i / g.w);
      const h = hash2(cx, cy, 99);
      if (h > 0.2) continue;
      const x = cx * CELL + CELL / 2 + (hash2(cx, cy, 3) - 0.5) * 2, y = cy * CELL + CELL / 2 + (hash2(cx, cy, 4) - 0.5) * 2;
      const col = this.pal.decor[Math.floor(hash2(cx, cy, 5) * this.pal.decor.length)];
      if (h < 0.05) {
        // flower
        ctx.fillStyle = col;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fff8e1';
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (h < 0.12) {
        // tuft
        ctx.strokeStyle = mixHex(this.fillCols[this.colIdx[i]], '#000000', 0.25);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - 1.5, y + 1.5); ctx.lineTo(x - 2, y - 1.5);
        ctx.moveTo(x, y + 1.5); ctx.lineTo(x, y - 2.3);
        ctx.moveTo(x + 1.5, y + 1.5); ctx.lineTo(x + 2, y - 1.5);
        ctx.stroke();
      } else {
        ctx.fillStyle = mixHex(this.fillCols[this.colIdx[i]], '#ffffff', 0.35);
        ctx.beginPath();
        ctx.arc(x, y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function valueNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
