// Pooled particles and floating texts (struct-of-arrays for speed).
import { TAU } from '../core/math';

export const MAX_PARTICLES = 2400;

export class Particles {
  x = new Float32Array(MAX_PARTICLES);
  y = new Float32Array(MAX_PARTICLES);
  vx = new Float32Array(MAX_PARTICLES);
  vy = new Float32Array(MAX_PARTICLES);
  life = new Float32Array(MAX_PARTICLES);
  max = new Float32Array(MAX_PARTICLES);
  size = new Float32Array(MAX_PARTICLES);
  drag = new Float32Array(MAX_PARTICLES);
  grav = new Float32Array(MAX_PARTICLES);
  kind = new Uint8Array(MAX_PARTICLES); // 0 dot, 1 streak, 2 square confetti, 3 sparkle
  color: string[] = new Array(MAX_PARTICLES).fill('#fff');
  count = 0;
  budget = 1; // scales spawn counts down on low-end machines

  spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, kind = 0, drag = 3, grav = 0) {
    let i: number;
    if (this.count < MAX_PARTICLES) i = this.count++;
    else i = (Math.random() * MAX_PARTICLES) | 0; // overwrite a random one when full
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.color[i] = color; this.kind[i] = kind; this.drag[i] = drag; this.grav[i] = grav;
  }

  burst(x: number, y: number, n: number, color: string, speed = 120, life = 0.5, size = 3, kind = 0) {
    const m = Math.max(1, Math.round(n * this.budget));
    for (let k = 0; k < m; k++) {
      const a = Math.random() * TAU;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, kind);
    }
  }

  update(dt: number) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.count;
        if (i !== j) {
          this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
          this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j];
          this.color[i] = this.color[j]; this.kind[i] = this.kind[j]; this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j];
        }
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= d;
      this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      i++;
    }
  }
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
  vy: number;
}

export class Texts {
  list: FloatText[] = [];
  add(x: number, y: number, text: string, color = '#fff', size = 14, life = 0.8, vy = -40) {
    if (this.list.length > 160) this.list.shift();
    this.list.push({ x, y, text, color, life, max: life, size, vy });
  }
  update(dt: number) {
    for (const t of this.list) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 1 - 2 * dt;
    }
    this.list = this.list.filter((t) => t.life > 0);
  }
}
