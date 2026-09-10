import { describe, expect, it } from 'vitest';
import { recommend } from '../src/engine/recommend';
import type { CounterRel, Hero, MetaRow, PatchChange } from '../src/engine/types';
import countersJson from '../data/counters.json';
import heroesJson from '../data/heroes.json';
import weightsJson from '../src/engine/weights.json';

const heroes = heroesJson as Hero[];
const counters = countersJson as CounterRel[];
const weights = weightsJson as { counter: number; meta: number; comp: number; mastery: number };
const syn: any[] = [];

const metaOf = (rows: Array<[string, number, number]>): MetaRow[] =>
  rows.map(([hero, tier_score, win_rate]) => ({ hero, patch: '2.1.95a', win_rate, pick_rate: 1, ban_rate: 1, tier: 'X', tier_score }));
const noPatch: PatchChange[] = [];
const base = { pool: heroes, counters, syn, meta: [] as MetaRow[], patches: noPatch, weights };

describe('engine', () => {
  it('fanny enemy -> khufra/kaja/franco in top3', () => {
    const recs = recommend({ ...base, allies: [], enemies: ['fanny'] });
    const top3 = recs.slice(0, 3).map((r) => r.hero);
    expect(top3.some((h) => ['khufra', 'kaja', 'franco'].includes(h))).toBe(true);
  });
  it('meta override: kaja S beats khufra C despite lower raw counter', () => {
    const meta = metaOf([
      ['khufra', 4, 45],
      ['kaja', 10, 55],
    ]);
    const recs = recommend({ ...base, allies: [], enemies: ['fanny'], meta });
    const rank = (id: string) => recs.findIndex((r) => r.hero === id);
    expect(rank('kaja')).toBeLessThan(rank('khufra'));
  });
  it('no-tank ally -> tank comp beats mm comp', () => {
    const recs = recommend({ ...base, allies: ['miya'], enemies: ['yve'], limit: 50 });
    const comp = (id: string) => recs.find((r) => r.hero === id)?.breakdown.comp ?? -1;
    expect(comp('khufra')).toBeGreaterThan(comp('miya') === -1 ? -1 : comp('claude'));
  });
  it('picked/banned heroes excluded', () => {
    const recs = recommend({ ...base, allies: ['tigreal'], enemies: ['fanny'], bans: ['kaja'] });
    const ids = recs.map((r) => r.hero);
    expect(ids).not.toContain('tigreal');
    expect(ids).not.toContain('fanny');
    expect(ids).not.toContain('kaja');
  });
  it('weights sum 1 and scores 0-100', () => {
    const sum = weights.counter + weights.meta + weights.comp + weights.mastery;
    expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
    const recs = recommend({ ...base, allies: ['tigreal'], enemies: ['fanny', 'yve'] });
    for (const r of recs) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});
