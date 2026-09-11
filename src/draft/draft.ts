import { recommend } from '../engine/recommend';
import type { CounterRel, Hero, MetaRow, PatchChange, Rec, SynergyRel, Weights } from '../engine/types';

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
    .sort((a, b) =>
      o.enemies.length === 0
        ? metaKey(o.byId, b.id) - metaKey(o.byId, a.id)
        : (o.scoreMap.get(b.id)?.score ?? -1) - (o.scoreMap.get(a.id)?.score ?? -1),
    );
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

// Bans answer the mirrored draft (our picks as their enemies), ban_rate breaks ties.
export function suggestBanIds(o: BanOpts): string[] {
  if (o.allies.length === 0 && o.enemies.length === 0) return fallbackPicks(o.heroes, o.meta, [...o.allies, ...o.enemies, ...o.bans]);
  const r = recommend({
    allies: o.enemies,
    enemies: o.allies,
    bans: [...o.allies, ...o.enemies, ...o.bans],
    pool: o.heroes,
    counters: o.counters,
    syn: o.syn,
    meta: o.meta,
    patches: o.patches,
    weights: o.weights,
    limit: 10,
  });
  const byId = metaById(o.meta);
  return [...r]
    .sort((a, b) => b.score + (byId.get(b.hero)?.ban_rate ?? 0) - (a.score + (byId.get(a.hero)?.ban_rate ?? 0)))
    .slice(0, 3)
    .map((x) => x.hero);
}

export function suggestPickIds(
  enemies: string[],
  scoreMap: Map<string, Rec>,
  heroes: Hero[],
  meta: MetaRow[],
  exclude: string[],
): string[] {
  if (enemies.length === 0) return fallbackPicks(heroes, meta, exclude);
  return [...scoreMap.keys()].slice(0, 3);
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
