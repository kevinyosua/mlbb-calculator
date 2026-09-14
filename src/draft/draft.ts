import { counterScore, synergyScore } from '../engine/score';
import type { CounterRel, Hero, MetaRow, PatchChange, Rec, SynergyRel, Weights } from '../engine/types';

// Rank comparator shared by list + suggest. Heroes with badges (counter
// or synergy) float to the top. Primary: total badges. Secondary: more
// counter badges, then more synergy badges, then effectiveness, then score.
export const rankCmp = (a: Rec, b: Rec) => {
  const aBadges = a.counters.length + (a.allies?.length ?? 0);
  const bBadges = b.counters.length + (b.allies?.length ?? 0);
  return (
    bBadges - aBadges ||
    b.counters.length - a.counters.length ||
    (b.allies?.length ?? 0) - (a.allies?.length ?? 0) ||
    b.breakdown.counter - a.breakdown.counter ||
    b.score - a.score
  );
};

// Draft knowledge module: ranking, suggestions, warnings, weakness.
// App passes draft state in and renders what comes back.

export const metaById = (meta: MetaRow[]): Map<string, MetaRow> => new Map(meta.map((m) => [m.hero, m]));

export const metaKey = (byId: Map<string, MetaRow>, id: string): number =>
  (byId.get(id)?.tier_score ?? 0) * 10 + (byId.get(id)?.pick_rate ?? 0);

export interface RankOpts {
  heroes: Hero[];
  byId: Map<string, MetaRow>;
  picked: Set<string>;
  q: string;
  lane: string;
  allLane: string;
  role: string;
  allRole: string;
  tier: string | null;
  enemies: string[];
  scoreMap: Map<string, Rec>;
}

// Name match always passes; score only decides order. Lane/role/tier strict.
export function rankList(o: RankOpts): Hero[] {
  const q = o.q.toLowerCase();
  return o.heroes
    .filter(
      (h) =>
        !o.picked.has(h.id) &&
        h.name.toLowerCase().includes(q) &&
        (o.lane === o.allLane || h.lane === o.lane) &&
        (o.role === o.allRole || h.roles.includes(o.role as never)) &&
        (!o.tier || o.byId.get(h.id)?.tier === o.tier),
    )
    .sort((a, b) => {
      const ra = o.scoreMap.get(a.id);
      const rb = o.scoreMap.get(b.id);
      // scoreMap has entries -> rank by badges (counter+synergy).
      if (ra && rb) return rankCmp(ra, rb);
      if (ra) return -1;
      if (rb) return 1;
      // No scoreMap (empty draft) -> tier + pick rate.
      return metaKey(o.byId, b.id) - metaKey(o.byId, a.id);
    });
}

// Empty draft: highest tier + pick rate, first 3.
export function fallbackPicks(heroes: Hero[], meta: MetaRow[], exclude: string[]): string[] {
  const out = new Set(exclude);
  const byId = metaById(meta);
  return [...heroes]
    .filter((h) => !out.has(h.id))
    .sort((a, b) => metaKey(byId, b.id) - metaKey(byId, a.id))
    .slice(0, 3)
    .map((h) => h.id);
}

export interface BanOpts {
  allies: string[];
  enemies: string[];
  bans: string[];
  heroes: Hero[];
  counters: CounterRel[];
  syn: SynergyRel[];
  meta: MetaRow[];
  patches: PatchChange[];
  weights: Weights;
}

// Ban priority (0-100): tier sets the floor, ban_rate the crowd signal.
// tier_score (2-10) is scaled x10 so both terms share the 0-100 range, then
// blended 50/50. Keeps an S-tier ban above a merely high-ban-rate lower tier,
// e.g. belerick (S, 59.37%) over eudora (A, 60.12%).
const TIER_W = 0.5;
const BAN_W = 0.5;
export const banPriority = (byId: Map<string, MetaRow>, id: string): number => {
  const m = byId.get(id);
  if (!m) return 0;
  return m.tier_score * 10 * TIER_W + m.ban_rate * BAN_W;
};

// Empty draft: highest ban priority first — the ban column reads tier + ban_rate.
export function fallbackBans(heroes: Hero[], meta: MetaRow[], exclude: string[]): string[] {
  const out = new Set(exclude);
  const byId = metaById(meta);
  return [...heroes]
    .filter((h) => !out.has(h.id))
    .sort((a, b) => banPriority(byId, b.id) - banPriority(byId, a.id))
    .slice(0, 3)
    .map((h) => h.id);
}

// Ban list: heroes that counter OUR picks (allies). More covered allies ranks
// higher; threat score breaks ties, then global ban priority (tier+ban_rate).
// No allies yet -> global OP bans (fallbackBans).
export interface SuggestItem {
  id: string;
  counters: string[];
  allies?: string[];
  lane?: string;
}

export function suggestBanIds(o: BanOpts): SuggestItem[] {
  const exclude = [...o.allies, ...o.enemies, ...o.bans];
  if (o.allies.length === 0) return fallbackBans(o.heroes, o.meta, exclude).map((id) => ({ id, counters: [] }));
  const byId = metaById(o.meta);
  const taken = new Set(exclude);
  return [...o.heroes]
    .filter((h) => !taken.has(h.id))
    .map((h) => {
      const c = counterScore(h.id, o.allies, o.counters);
      return { id: h.id, counters: c.counters, threat: c.score, pri: banPriority(byId, h.id) };
    })
    .sort((a, b) => b.counters.length - a.counters.length || b.threat - a.threat || b.pri - a.pri)
    .slice(0, 3)
    .map(({ id, counters }) => ({ id, counters }));
}

// Per-lane fallback: top hero per empty lane by synergy count, then meta.
// Used when scoreMap is empty (no enemy yet) so allies-only drafts still
// get lane + synergy suggestions.
export function suggestLanePicks(allies: string[], heroes: Hero[], meta: MetaRow[], syn: SynergyRel[], exclude: string[]): SuggestItem[] {
  const out = new Set(exclude);
  const takenLanes = new Set(heroes.filter((h) => allies.includes(h.id)).map((h) => h.lane));
  const byId = metaById(meta);
  const byLane = new Map<string, { h: Hero; mates: string[] }[]>();
  for (const h of heroes) {
    if (out.has(h.id) || takenLanes.has(h.lane)) continue;
    const mates = synergyScore(h.id, allies, syn).allies;
    const arr = byLane.get(h.lane) ?? [];
    arr.push({ h, mates });
    byLane.set(h.lane, arr);
  }
  const rank = (a: { h: Hero; mates: string[] }, b: { h: Hero; mates: string[] }) =>
    b.mates.length - a.mates.length || metaKey(byId, b.h.id) - metaKey(byId, a.h.id);
  return [...byLane.values()]
    .map((arr) => arr.sort(rank)[0])
    .sort(rank)
    .slice(0, 3)
    .map(({ h, mates }) => ({ id: h.id, counters: [], allies: mates, lane: h.lane }));
}

// Pick list: one top hero per empty lane. Rank inside each lane by covered
// enemies, then synergy allies, then counter effectiveness, then score.
// No draft at all -> global top picks (fallbackPicks). Empty scoreMap
// (allies but no enemy) -> per-lane synergy fallback above.
export function suggestPickIds(
  allies: string[],
  enemies: string[],
  scoreMap: Map<string, Rec>,
  heroes: Hero[],
  meta: MetaRow[],
  exclude: string[],
  syn: SynergyRel[] = [],
): SuggestItem[] {
  if (allies.length === 0 && enemies.length === 0) return fallbackPicks(heroes, meta, exclude).map((id) => ({ id, counters: [] }));
  if (scoreMap.size === 0) return suggestLanePicks(allies, heroes, meta, syn, exclude);
  const out = new Set(exclude);
  const takenLanes = new Set(heroes.filter((h) => allies.includes(h.id)).map((h) => h.lane));
  const byId = new Map(heroes.map((h) => [h.id, h] as const));
  const byLane = new Map<string, { r: Rec; hero: Hero }[]>();
  for (const r of scoreMap.values()) {
    if (out.has(r.hero)) continue;
    const hero = byId.get(r.hero);
    if (!hero || takenLanes.has(hero.lane)) continue;
    const arr = byLane.get(hero.lane) ?? [];
    arr.push({ r, hero });
    byLane.set(hero.lane, arr);
  }
  return [...byLane.entries()]
    .map(([, arr]) => arr.sort((a, b) => rankCmp(a.r, b.r))[0])
    .sort((a, b) => rankCmp(a.r, b.r))
    .slice(0, 3)
    .map(({ r, hero }) => ({ id: r.hero, counters: r.counters, allies: r.allies, lane: hero.lane }));
}

// Anti-synergy warnings between allies (reads synergies only).
export function allyWarnings(heroes: Hero[], syn: SynergyRel[], allies: string[], label: string): string[] {
  void heroes;
  const out: string[] = [];
  for (let i = 0; i < allies.length; i++)
    for (let j = i + 1; j < allies.length; j++) {
      const hit = syn.find(
        (x) =>
          x.type === 'ANTI_SYNERGY' &&
          ((x.source === allies[i] && x.target === allies[j]) || (x.source === allies[j] && x.target === allies[i])),
      );
      if (hit) out.push(`${label}: ${hit.reason}`);
    }
  return [...new Set(out)];
}

export interface WeaknessLabels {
  missing: string;
  noFrontline: string;
  noDamage: string;
}

// Weakness: lanes and roles still missing from the ally team.
export function teamWeakness(heroes: Hero[], allies: string[], t: WeaknessLabels): string[] {
  const out: string[] = [];
  const allyH = heroes.filter((h) => allies.includes(h.id));
  for (const l of ['Exp', 'Jungle', 'Mid', 'Gold', 'Roam']) {
    if (!allyH.some((h) => h.lane === l)) out.push(`${t.missing} ${l}`);
  }
  if (!allyH.some((h) => h.roles.includes('Tank') || h.tags.includes('Frontline'))) out.push(t.noFrontline);
  if (!allyH.some((h) => h.roles.includes('Marksman') || h.roles.includes('Mage') || h.roles.includes('Assassin'))) out.push(t.noDamage);
  return [...new Set(out)];
}
