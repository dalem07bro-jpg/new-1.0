// Territory grid: ownership, terrain, the player's trail, and the loop-closing claim algorithm.
// Pure logic (no rendering) so it can be unit-tested headless.

export const CELL = 10; // world units per cell

export const enum Terrain {
  Normal = 0,
  Rock = 1, // impassable, never claimable, acts as a wall for enclosures
  Bog = 2, // slows movement
  Fissure = 3, // erupts periodically (Ember Canyon)
}

export interface ClaimResult {
  /** All newly owned cells (trail + enclosed), ordered by distance from the trail (reveal wave). */
  cells: number[];
  /** Parallel to `cells`: BFS distance (in cells) from the closing trail. */
  dist: number[];
  maxDist: number;
  trailCount: number;
  enclosedCount: number;
}

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly size: number;
  readonly owned: Uint8Array;
  readonly terrain: Uint8Array;
  /** index into `trail` for trail cells, -1 otherwise */
  readonly trailIdx: Int32Array;
  trail: number[] = [];
  ownedCount = 0;
  claimable = 0;
  /** cells whose ownership changed (consumed by the renderer / systems) */
  changed: number[] = [];

  private stamp: Int32Array;
  private stampGen = 1;
  private queue: Int32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.size = w * h;
    this.owned = new Uint8Array(this.size);
    this.terrain = new Uint8Array(this.size);
    this.trailIdx = new Int32Array(this.size).fill(-1);
    this.stamp = new Int32Array(this.size);
    this.queue = new Int32Array(this.size);
    this.claimable = this.size;
  }

  idx(x: number, y: number) {
    return y * this.w + x;
  }
  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  cellAtWorld(wx: number, wy: number): number {
    const x = Math.floor(wx / CELL), y = Math.floor(wy / CELL);
    if (!this.inBounds(x, y)) return -1;
    return y * this.w + x;
  }
  isRockAt(x: number, y: number) {
    if (!this.inBounds(x, y)) return true;
    return this.terrain[y * this.w + x] === Terrain.Rock;
  }
  recountClaimable() {
    let c = 0;
    for (let i = 0; i < this.size; i++) if (this.terrain[i] !== Terrain.Rock) c++;
    this.claimable = c;
  }
  get percent() {
    return this.claimable > 0 ? this.ownedCount / this.claimable : 0;
  }

  setOwned(i: number, v: boolean) {
    const cur = this.owned[i] === 1;
    if (cur === v) return;
    if (v && this.terrain[i] === Terrain.Rock) return;
    this.owned[i] = v ? 1 : 0;
    this.ownedCount += v ? 1 : -1;
    this.changed.push(i);
  }

  /** Claim a filled disc (starting area, abilities). Returns newly owned cells. */
  claimDisc(cx: number, cy: number, r: number): number[] {
    const out: number[] = [];
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, Math.ceil(cx + r)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * this.w + x;
        if (this.owned[i] || this.terrain[i] === Terrain.Rock) continue;
        if (this.trailIdx[i] >= 0) continue;
        this.setOwned(i, true);
        out.push(i);
      }
    }
    return out;
  }

  /** Remove ownership in a disc (boss erasers etc). Returns cells lost. */
  unclaimDisc(cx: number, cy: number, r: number): number[] {
    const out: number[] = [];
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, Math.ceil(cx + r)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * this.w + x;
        if (!this.owned[i]) continue;
        this.setOwned(i, false);
        out.push(i);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- trail

  /** Try adding a single cell to the trail. Returns 'closed' if it touched owned land with an open trail. */
  stepInto(i: number): 'none' | 'added' | 'closed' {
    if (i < 0) return 'none';
    if (this.owned[i]) return this.trail.length > 0 ? 'closed' : 'none';
    if (this.terrain[i] === Terrain.Rock) return 'none';
    if (this.trailIdx[i] >= 0) return 'none';
    this.trailIdx[i] = this.trail.length;
    this.trail.push(i);
    return 'added';
  }

  /**
   * Walk an 8-connected line from cell a to cell b (exclusive of a) and feed each cell to stepInto.
   * Stops early and returns 'closed' as soon as the loop closes.
   */
  walk(ax: number, ay: number, bx: number, by: number, onAdded?: (i: number) => void): 'none' | 'closed' {
    let x = ax, y = ay;
    const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx + dy;
    let guard = 0;
    while (!(x === bx && y === by) && guard++ < 4096) {
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if (!this.inBounds(x, y)) return 'none';
      const i = y * this.w + x;
      const r = this.stepInto(i);
      if (r === 'closed') return 'closed';
      if (r === 'added' && onAdded) onAdded(i);
    }
    return 'none';
  }

  clearTrail(): number[] {
    const old = this.trail;
    for (const i of old) this.trailIdx[i] = -1;
    this.trail = [];
    return old;
  }

  /**
   * Close the current trail: trail cells become owned, and every 4-connected region of unowned,
   * non-rock cells that is adjacent to the trail and does NOT touch the map border becomes owned too.
   */
  closeTrail(): ClaimResult {
    const trail = this.trail;
    const res: ClaimResult = { cells: [], dist: [], maxDist: 0, trailCount: trail.length, enclosedCount: 0 };
    if (trail.length === 0) return res;
    const { w, h } = this;

    for (const i of trail) {
      this.trailIdx[i] = -1;
      this.setOwned(i, true);
    }
    this.trail = [];

    const gen = ++this.stampGen;
    const stamp = this.stamp;
    const q = this.queue;
    const toClaim: number[] = [];

    for (const t of trail) {
      const tx = t % w, ty = (t / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = tx + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = ty + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const s = ny * w + nx;
        if (stamp[s] === gen || this.owned[s] || this.terrain[s] === Terrain.Rock) continue;
        // flood this component
        let head = 0, tail = 0;
        q[tail++] = s;
        stamp[s] = gen;
        let touchesBorder = false;
        const start = toClaim.length;
        while (head < tail) {
          const c = q[head++];
          const cx = c % w, cy = (c / w) | 0;
          if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) touchesBorder = true;
          toClaim.push(c);
          if (cx + 1 < w) { const n = c + 1; if (stamp[n] !== gen && !this.owned[n] && this.terrain[n] !== Terrain.Rock) { stamp[n] = gen; q[tail++] = n; } }
          if (cx > 0) { const n = c - 1; if (stamp[n] !== gen && !this.owned[n] && this.terrain[n] !== Terrain.Rock) { stamp[n] = gen; q[tail++] = n; } }
          if (cy + 1 < h) { const n = c + w; if (stamp[n] !== gen && !this.owned[n] && this.terrain[n] !== Terrain.Rock) { stamp[n] = gen; q[tail++] = n; } }
          if (cy > 0) { const n = c - w; if (stamp[n] !== gen && !this.owned[n] && this.terrain[n] !== Terrain.Rock) { stamp[n] = gen; q[tail++] = n; } }
        }
        if (touchesBorder) toClaim.length = start; // discard: open to the outside
      }
    }

    for (const c of toClaim) this.setOwned(c, true);
    res.enclosedCount = toClaim.length;

    // Multi-source BFS from the trail over the newly owned set → reveal-wave ordering.
    const gen2 = ++this.stampGen;
    const member = ++this.stampGen; // mark set membership with a different generation
    for (const c of toClaim) stamp[c] = member;
    let head = 0, tail = 0;
    const d = new Int32Array(trail.length + toClaim.length);
    for (const t of trail) {
      stamp[t] = gen2;
      q[tail] = t;
      d[tail] = 0;
      tail++;
    }
    while (head < tail) {
      const c = q[head];
      const cd = d[head];
      head++;
      res.cells.push(c);
      res.dist.push(cd);
      if (cd > res.maxDist) res.maxDist = cd;
      const cx = c % w, cy = (c / w) | 0;
      const nbs = [cx + 1 < w ? c + 1 : -1, cx > 0 ? c - 1 : -1, cy + 1 < h ? c + w : -1, cy > 0 ? c - w : -1];
      for (const n of nbs) {
        if (n >= 0 && stamp[n] === member) {
          stamp[n] = gen2;
          q[tail] = n;
          d[tail] = cd + 1;
          tail++;
        }
      }
    }
    // Any enclosed cell unreachable by 4-adjacency from the trail (shouldn't happen) still gets revealed.
    for (const c of toClaim) {
      if (stamp[c] === member) {
        res.cells.push(c);
        res.dist.push(res.maxDist);
      }
    }
    return res;
  }

  /** Is cell i on the edge of the territory (owned with at least one unowned 4-neighbour)? */
  isEdge(i: number): boolean {
    if (!this.owned[i]) return false;
    const x = i % this.w, y = (i / this.w) | 0;
    if (x === 0 || y === 0 || x === this.w - 1 || y === this.h - 1) return true;
    return !this.owned[i + 1] || !this.owned[i - 1] || !this.owned[i + this.w] || !this.owned[i - this.w];
  }

  /** Find nearest owned cell to (cx,cy) within radius (cells) using ring search. */
  nearestOwned(cx: number, cy: number, maxR = 60): number {
    const x0 = Math.floor(cx), y0 = Math.floor(cy);
    if (this.inBounds(x0, y0) && this.owned[this.idx(x0, y0)]) return this.idx(x0, y0);
    let best = -1, bestD = Infinity;
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = x0 + dx, y = y0 + dy;
          if (!this.inBounds(x, y)) continue;
          const i = y * this.w + x;
          if (!this.owned[i]) continue;
          const dd = dx * dx + dy * dy;
          if (dd < bestD) { bestD = dd; best = i; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Nearest trail cell to a world position (linear scan; trails are short). */
  nearestTrail(wx: number, wy: number): number {
    let best = -1, bestD = Infinity;
    const w = this.w;
    for (let k = 0; k < this.trail.length; k += 2) {
      const c = this.trail[k];
      const x = (c % w) * CELL + CELL / 2, y = ((c / w) | 0) * CELL + CELL / 2;
      const dd = (x - wx) ** 2 + (y - wy) ** 2;
      if (dd < bestD) { bestD = dd; best = k; }
    }
    return best;
  }
}
