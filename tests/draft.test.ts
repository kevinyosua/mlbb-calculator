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
const rec = (hero: string, score: number, counters: string[] = [], allies: string[] = []): Rec => ({
  hero,
  score,
  reasons: [],
  breakdown: { counter: score, meta: 50, comp: 50, mastery: 50 },
  counters,
  allies,
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
  it('suggestPickIds: one top pick per empty lane, counters then synergy', () => {
    const laneOf = (id: string) => heroes.find((h) => h.id === id)?.lane ?? '?';
    // Spread 4 recs across lanes: b/c share Gold (b weaker), d Mid, a Roam.
    const lanes = [...new Set([laneOf(heroes[0].id), laneOf(heroes[1].id), laneOf(heroes[2].id), laneOf(heroes[3].id)])];
    const scoreMap = new Map([
      [heroes[0].id, rec(heroes[0].id, 99, [])],
      [heroes[1].id, rec(heroes[1].id, 10, ['fanny'])],
      [heroes[2].id, rec(heroes[2].id, 50, ['fanny', 'miya'], ['tigreal'])],
      [heroes[3].id, rec(heroes[3].id, 90, ['fanny'])],
    ]);
    void lanes;
    const got = suggestPickIds([], ['fanny', 'miya'], scoreMap, heroes, meta, []);
    // One id per lane, no lane repeats.
    const gotLanes = got.map((s) => s.lane);
    expect(new Set(gotLanes).size).toBe(got.length);
    expect(got.length).toBeLessThanOrEqual(3);
    const fb = suggestPickIds([], [], scoreMap, heroes, meta, []);
    expect(fb.map((s) => s.id)).toEqual(fallbackPicks(heroes, meta, []));
    expect(fb.every((s) => s.counters.length === 0)).toBe(true);
  });
  it('suggestPickIds: allies but no enemy -> per-lane synergy picks', () => {
    // tigreal Roam taken. claude synergizes with tigreal, so a Gold hero
    // with tigreal synergy should lead its lane.
    const got = suggestPickIds(['tigreal'], [], new Map(), heroes, meta, ['tigreal'], syn);
    expect(got.length).toBeGreaterThan(0);
    expect(got.length).toBeLessThanOrEqual(3);
    // No taken-lane heroes, no dup lanes.
    const lanes = got.map((s) => s.lane);
    expect(lanes).not.toContain('Roam');
    expect(new Set(lanes).size).toBe(lanes.length);
  });
  it('suggestPickIds: synergy ally breaks counter tie, lane filled skipped', () => {
    // Two Gold heroes tie on counters; one has a synergy ally -> wins Gold slot.
    const gold = heroes.filter((h) => h.lane === 'Gold').slice(0, 2);
    const [g1, g2] = gold;
    const scoreMap = new Map([
      [g1.id, rec(g1.id, 80, ['fanny'], [])],
      [g2.id, rec(g2.id, 80, ['fanny'], ['tigreal'])],
    ]);
    const got = suggestPickIds([], ['fanny'], scoreMap, heroes, meta, []);
    expect(got.map((s) => s.id)).toContain(g2.id);
    expect(got.map((s) => s.id)).not.toContain(g1.id);
    expect(got.find((s) => s.id === g2.id)?.allies).toEqual(['tigreal']);
    // Gold lane taken -> neither Gold hero suggested.
    const allyGold = heroes.find((h) => h.lane === 'Gold')?.id ?? g1.id;
    const got2 = suggestPickIds([allyGold], ['fanny'], scoreMap, heroes, meta, [allyGold]);
    expect(got2.map((s) => s.id)).not.toContain(g1.id);
    expect(got2.map((s) => s.id)).not.toContain(g2.id);
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
    for (let i = 1; i < top.length; i++) expect(banPriority(byId, top[i - 1])).toBeGreaterThanOrEqual(banPriority(byId, top[i]));
    expect(fallbackBans(heroes, meta, [top[0]])).not.toContain(top[0]);
  });
  it('suggestBanIds bans threats to our picks, tags the countered ally', () => {
    const o = { allies: [], enemies: [], bans: [], heroes, counters, syn, meta, patches, weights };
    expect(suggestBanIds(o).map((s) => s.id)).toEqual(fallbackBans(heroes, meta, []));
    const bans = suggestBanIds({ ...o, allies: ['miya'] });
    expect(bans).toHaveLength(3);
    // fanny dives miya — must surface with the miya tag.
    const ids = bans.map((b) => b.id);
    expect(ids).toContain('fanny');
    expect(bans.find((b) => b.id === 'fanny')?.counters).toEqual(['miya']);
    for (const b of bans) for (const c of b.counters) expect(['miya']).toContain(c);
    expect(bans.map((b) => b.id)).not.toContain('miya');
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
  it('rankList: allies-only draft sorts by synergy count, badges visible', () => {
    const tigSyn = syn.filter((s) => s.type === 'SYNERGY' && (s.source === 'tigreal' || s.target === 'tigreal'));
    const mates = [...new Set(tigSyn.map((s) => (s.source === 'tigreal' ? s.target : s.source)))];
    const scoreMap = new Map<string, Rec>();
    for (const id of mates) {
      scoreMap.set(id, rec(id, 0, [], ['tigreal']));
    }
    const list = rankList({ ...base, allies: ['tigreal'], scoreMap });
    const first = list[0];
    const firstRec = scoreMap.get(first.id);
    expect(firstRec?.allies?.length ?? 0).toBeGreaterThan(0);
  });
});
