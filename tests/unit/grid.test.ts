import { Grid, Terrain } from '../../src/game/grid';

function walkPath(g: Grid, pts: [number, number][]) {
  let res: 'none' | 'closed' = 'none';
  for (let k = 1; k < pts.length; k++) {
    res = g.walk(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]);
    if (res === 'closed') return res;
  }
  return res;
}

describe('Grid claiming', () => {
  it('claims a starting disc', () => {
    const g = new Grid(40, 30);
    const cells = g.claimDisc(20, 15, 4);
    expect(cells.length).toBeGreaterThan(40);
    expect(g.ownedCount).toBe(cells.length);
  });

  it('closes a loop and fills the enclosed area', () => {
    const g = new Grid(40, 30);
    g.claimDisc(10, 15, 3); // owned blob around (10,15)
    // leave to the right, go up, across, down, and back into the blob
    const res = walkPath(g, [[12, 15], [20, 15], [20, 5], [10, 5], [10, 13]]);
    expect(res).toBe('closed');
    const r = g.closeTrail();
    expect(r.trailCount).toBeGreaterThan(20);
    expect(r.enclosedCount).toBeGreaterThan(50);
    // a cell inside the rectangle is now owned
    expect(g.owned[g.idx(15, 10)]).toBe(1);
    // a cell outside is not
    expect(g.owned[g.idx(30, 10)]).toBe(0);
    expect(g.trail.length).toBe(0);
    // ordering: distances are non-decreasing
    for (let i = 1; i < r.dist.length; i++) expect(r.dist[i]).toBeGreaterThanOrEqual(r.dist[i - 1]);
  });

  it('does not claim regions that touch the map border', () => {
    const g = new Grid(30, 30);
    g.claimDisc(15, 15, 3);
    // line from blob straight up to row 1 and back: encloses nothing
    const res = walkPath(g, [[15, 12], [15, 1], [16, 1], [16, 12]]);
    expect(res).toBe('closed');
    const r = g.closeTrail();
    expect(r.enclosedCount).toBe(0);
  });

  it('uses rocks as walls for enclosure (walled room with a doorway)', () => {
    const g = new Grid(50, 30);
    // rock ring room x 20..35, y 5..25 with a doorway at x=20, y=14..16
    for (let x = 20; x <= 35; x++) { g.terrain[g.idx(x, 5)] = Terrain.Rock; g.terrain[g.idx(x, 25)] = Terrain.Rock; }
    for (let y = 5; y <= 25; y++) { g.terrain[g.idx(35, y)] = Terrain.Rock; if (y < 14 || y > 16) g.terrain[g.idx(20, y)] = Terrain.Rock; }
    g.recountClaimable();
    g.claimDisc(10, 15, 3);
    // dip into the doorway and back out
    const res = walkPath(g, [[12, 14], [21, 14], [21, 16], [11, 16]]);
    expect(res).toBe('closed');
    const r = g.closeTrail();
    expect(r.enclosedCount).toBeGreaterThan(200);
    expect(g.owned[g.idx(28, 15)]).toBe(1);
    expect(g.owned[g.idx(35, 15)]).toBe(0); // rock never owned
    expect(g.owned[g.idx(40, 15)]).toBe(0); // outside the room
  });

  it('diagonal trails still form a closed barrier', () => {
    const g = new Grid(40, 40);
    g.claimDisc(20, 20, 2);
    const res = walkPath(g, [[20, 18], [26, 12], [32, 18], [26, 24], [21, 20]]);
    expect(res).toBe('closed');
    const r = g.closeTrail();
    expect(g.owned[g.idx(26, 17)]).toBe(1);
    expect(r.enclosedCount).toBeGreaterThan(10);
  });

  it('unclaimDisc removes ownership and counts stay consistent', () => {
    const g = new Grid(40, 40);
    g.claimDisc(20, 20, 8);
    const before = g.ownedCount;
    const lost = g.unclaimDisc(20, 20, 3);
    expect(g.ownedCount).toBe(before - lost.length);
    let count = 0;
    for (let i = 0; i < g.size; i++) count += g.owned[i];
    expect(count).toBe(g.ownedCount);
  });

  it('nearestOwned finds territory', () => {
    const g = new Grid(50, 50);
    g.claimDisc(5, 5, 2);
    const i = g.nearestOwned(30, 30);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(g.owned[i]).toBe(1);
  });

  it('fills 1-cell slivers between territory walls', () => {
    const g = new Grid(40, 30);
    // two owned columns with a one-cell gap at x=11, open at the top
    for (let y = 5; y < 25; y++) {
      g.setOwned(g.idx(10, y), true);
      g.setOwned(g.idx(12, y), true);
    }
    const filled = g.fillSlivers([g.idx(10, 10)]);
    expect(filled.length).toBeGreaterThanOrEqual(18);
    expect(g.owned[g.idx(11, 15)]).toBe(1);
    expect(g.owned[g.idx(20, 15)]).toBe(0);
  });
});
