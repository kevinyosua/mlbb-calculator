import { describe, expect, it } from 'vitest';
import {
  allyWarnings,
  banPriority,
  fallbackBans,
  fallbackPicks,
  metaById,
  metaKey,
  rankList,
  suggestBanIds,
  suggestPickIds,
  teamWeakness,
} from '../src/draft/draft';
import type { CounterRel, Hero, MetaRow, PatchChange, Rec, SynergyRel, Weights } from '../src/engine/types';
import countersJson from '../data/counters.json';
import heroesJson from '../data/heroes.json';
import metaJson from '../data/meta.json';
import patchesJson from '../data/patches.json';
import synergiesJson from '../data/synergies.json';
import weightsJson from '../src/engine/weights.json';

const heroes = heroesJson as Hero[];
const meta = metaJson as MetaRow[];
const counters = countersJson as CounterRel[];
const syn = synergiesJson as SynergyRel[];
const patches = patchesJson as PatchChange[];
const weights = weightsJson as Weights;
const byId = metaById(meta);
const ALL_LANE = 'All Lane';
const ALL_ROLE = 'All Role';
const rec = (hero: string, score: number): Rec => ({
  hero,
  score,
  reasons: [],
  breakdown: { counter: score, meta: 50, comp: 50, mastery: 50 },
});
const base = {
  heroes,
  byId,
  picked: new Set<string>(),
  q: '',
  lane: ALL_LANE,
  allLane: ALL_LANE,
  role: ALL_ROLE,
  allRole: ALL_ROLE,
  tier: null as string | null,
  enemies: [] as string[],
  scoreMap: new Map<string, Rec>(),
};

describe('draft', () => {
  it('empty draft sorts by tier + pick rate desc', () => {
    const list = rankList(base);
    const key = (id: string) => metaKey(byId, id);
    expect(key(list[0].id)).toBe(Math.max(...heroes.map((h) => key(h.id))));
    for (let i = 1; i < list.length; i++) expect(key(list[i - 1].id)).toBeGreaterThanOrEqual(key(list[i].id));
  });
  it('score decides order, unscored name matches still listed', () => {
    const [a, b] = heroes;
    const scoreMap = new Map([
      [a.id, rec(a.id, 10)],
      [b.id, rec(b.id, 90)],
    ]);
    const list = rankList({ ...base, enemies: ['fanny'], scoreMap });
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
    expect(list.length).toBe(heroes.length);
  });
  it('tier filter is strict', () => {
    const list = rankList({ ...base, tier: 'S' });
    expect(list.length).toBeGreaterThan(0);
    for (const h of list) expect(byId.get(h.id)?.tier).toBe('S');
  });
  it('fallbackPicks top3, honors exclude', () => {
    const top = fallbackPicks(heroes, meta, []);
    expect(top).toHaveLength(3);
    expect(fallbackPicks(heroes, meta, [top[0]])).not.toContain(top[0]);
  });
  it('suggestPickIds follows scoreMap, falls back when empty', () => {
    const [a, b, c, d] = heroes;
    const scoreMap = new Map([
      [a.id, rec(a.id, 1)],
      [b.id, rec(b.id, 2)],
      [c.id, rec(c.id, 3)],
      [d.id, rec(d.id, 4)],
    ]);
    expect(suggestPickIds(['fanny'], scoreMap, heroes, meta, [])).toEqual([a.id, b.id, c.id]);
    expect(suggestPickIds([], scoreMap, heroes, meta, [])).toEqual(fallbackPicks(heroes, meta, []));
  });
  it('banPriority blends tier and ban rate (S tier beats A tier at equal ban)', () => {
    const s = banPriority(byId, 'belerick'); // S, 59.37%
    const a = banPriority(byId, 'eudora'); // A, 60.12%
    expect(s).toBeGreaterThan(a);
    expect(banPriority(byId, 'no-such-hero')).toBe(0);
  });
  it('fallbackBans top3 by ban priority desc, honors exclude', () => {
    const top = fallbackBans(heroes, meta, []);
    expect(top).toHaveLength(3);
    for (let i = 1; i < top.length; i++)
      expect(banPriority(byId, top[i - 1])).toBeGreaterThanOrEqual(banPriority(byId, top[i]));
    expect(fallbackBans(heroes, meta, [top[0]])).not.toContain(top[0]);
  });
  it('suggestBanIds falls back on empty draft, 3 bans otherwise', () => {
    const o = { allies: [], enemies: [], bans: [], heroes, counters, syn, meta, patches, weights };
    expect(suggestBanIds(o)).toEqual(fallbackBans(heroes, meta, []));
    const bans = suggestBanIds({ ...o, enemies: ['fanny'] });
    expect(bans).toHaveLength(3);
    for (let i = 1; i < bans.length; i++)
      expect(banPriority(byId, bans[i - 1])).toBeGreaterThanOrEqual(banPriority(byId, bans[i]));
    expect(bans).not.toContain('fanny');
  });
  it('allyWarnings finds anti-synergy both directions', () => {
    const s = [
      { source: 'a', target: 'b', type: 'ANTI_SYNERGY', score: 10, reason: 'clash', sources: ['x'], patch_verified: 'p' },
    ] as SynergyRel[];
    expect(allyWarnings(heroes, s, ['a', 'b'], 'Anti')).toEqual(['Anti: clash']);
    expect(allyWarnings(heroes, s, ['a'], 'Anti')).toEqual([]);
  });
  it('teamWeakness flags empty team fully', () => {
    expect(teamWeakness(heroes, [], { missing: 'Missing', noFrontline: 'NF', noDamage: 'ND' })).toHaveLength(7);
  });
});
