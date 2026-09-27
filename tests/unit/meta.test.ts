import { freshSave } from '../../src/core/storage';
import { atelierCost, buyAtelier, checkCharUnlocks, mix, starCount, awardStars } from '../../src/game/meta';
import { ATELIER } from '../../src/data/content';
import { Run } from '../../src/game/run';

describe('meta progression', () => {
  it('atelier purchases spend pigment and cap at max level', () => {
    const s = freshSave('en');
    s.pigments.crimson = 10_000;
    const def = ATELIER.find((a) => a.id === 'vitality')!;
    for (let i = 0; i < def.max + 2; i++) buyAtelier(s, 'vitality');
    expect(s.atelier.vitality).toBe(def.max);
    const spent = Array.from({ length: def.max }, (_, l) => atelierCost(def, l).crimson ?? 0).reduce((a, b) => a + b, 0);
    expect(s.pigments.crimson).toBe(10_000 - spent);
  });

  it('mixing converts 5+5 primaries into 2 secondary', () => {
    const s = freshSave('en');
    s.pigments.crimson = 12;
    s.pigments.azure = 30;
    expect(mix(s, 'violet', 10)).toBe(2);
    expect(s.pigments.violet).toBe(4);
    expect(s.pigments.crimson).toBe(2);
  });

  it('stars count once per challenge and unlock characters by stats', () => {
    const s = freshSave('en');
    awardStars(s, 'meadows', [true, false, true, false, false]);
    expect(awardStars(s, 'meadows', [true, true, false, false, false])).toEqual([1]);
    expect(starCount(s)).toBe(3);
    s.stats.captures = 300;
    expect(checkCharUnlocks(s)).toContain('vera');
  });

  it('run offers valid cards and applies them', () => {
    const s = freshSave('en');
    const run = new Run(s, 'pip', 0, 'journey', 123);
    for (let i = 0; i < 40; i++) {
      const cards = run.offer(3);
      expect(cards.length).toBe(3);
      run.applyCard(cards[0]);
    }
    expect(run.weapons.length).toBeLessThanOrEqual(5);
    expect(run.passives.size).toBeLessThanOrEqual(6);
    for (const w of run.weapons) expect(w.level).toBeLessThanOrEqual(5);
    expect(run.s.maxHp).toBeGreaterThan(0);
  });
});
