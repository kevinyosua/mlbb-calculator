import type { CounterRel, Hero, MetaRow, PatchChange, SynergyRel, Weights } from './types';

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export function counterScore(
  heroId: string,
  enemies: string[],
  counters: CounterRel[],
): { score: number; reasons: string[]; counters: string[] } {
  if (enemies.length === 0) return { score: 0, reasons: [], counters: [] };
  // COUNTER: source beats target. COUNTERED_BY: source loses to target
  // (victim-first, matches hand-written rows). Both forms count when the
  // candidate beats the enemy.
  const hits = counters.filter(
    (c) =>
      (c.type === 'COUNTER' && c.source === heroId && enemies.includes(c.target)) ||
      (c.type === 'COUNTERED_BY' && c.target === heroId && enemies.includes(c.source)),
  );
  if (hits.length === 0) return { score: 0, reasons: [], counters: [] };
  const best = new Map<string, number>();
  for (const h of hits) {
    const enemy = h.type === 'COUNTER' ? h.target : h.source;
    const prev = best.get(enemy) ?? -1;
    if (h.score > prev) best.set(enemy, h.score);
  }
  const covered = [...best.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
  const avg = hits.reduce((s, h) => s + h.score, 0) / hits.length;
  const coverage = covered.length / enemies.length;
  const score = clamp(avg * 10 * (0.6 + 0.4 * coverage));
  const reasons = [...hits]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((h) => h.reason);
  return { score, reasons, counters: covered };
}

export function synergyScore(heroId: string, allies: string[], syn: SynergyRel[]): { score: number; allies: string[] } {
  if (allies.length === 0) return { score: 0, allies: [] };
  const best = new Map<string, number>();
  for (const a of allies) {
    const hit = syn.find(
      (x) => x.type === 'SYNERGY' && ((x.source === heroId && x.target === a) || (x.source === a && x.target === heroId)),
    );
    if (hit) best.set(a, hit.score);
  }
  if (best.size === 0) return { score: 0, allies: [] };
  const matched = [...best.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const avg = matched.reduce((s, id) => s + (best.get(id) ?? 0), 0) / matched.length;
  return { score: clamp(avg * 10), allies: matched };
}

export function metaScore(heroId: string, meta: MetaRow[], patches: PatchChange[]): number {
  const row = meta.find((m) => m.hero === heroId);
  if (!row) return 50;
  const tierScaled = clamp(row.tier_score * 10);
  const winScaled = clamp((row.win_rate - 45) * 10);
  const impact = patches.filter((p) => p.hero === heroId).reduce((s, p) => s + p.impact, 0);
  const impactScaled = clamp(50 + impact * 5);
  return clamp(tierScaled * 0.5 + winScaled * 0.3 + impactScaled * 0.2);
}

export function compScore(
  hero: Hero,
  allies: string[],
  enemies: string[],
  pool: Hero[],
  counters: CounterRel[],
  syn: SynergyRel[],
): { score: number; reasons: string[] } {
  let s = 50;
  const reasons: string[] = [];
  const allyHeroes = pool.filter((h) => allies.includes(h.id));
  const hasFrontline = allyHeroes.some((h) => h.tags.includes('Frontline') || h.roles.includes('Tank'));
  if (!hasFrontline && (hero.tags.includes('Frontline') || hero.roles.includes('Tank'))) {
    s += 25;
    reasons.push('Fills missing frontline.');
  }
  const hasDamage = allyHeroes.some((h) => h.roles.includes('Marksman') || h.roles.includes('Mage') || h.roles.includes('Assassin'));
  if (!hasDamage && hero.scores.burst >= 7) {
    s += 25;
    reasons.push('Fills missing damage.');
  }
  const dashEnemies = enemies.filter((e) => {
    const h = pool.find((p) => p.id === e);
    return h && (h.tags.includes('High Mobility') || h.tags.includes('Dash'));
  });
  if (dashEnemies.length >= 1 && (hero.tags.includes('Anti Dash') || hero.tags.includes('Suppression') || hero.tags.includes('Hard CC'))) {
    s += 15;
    reasons.push('Punishes enemy mobility.');
  }
  const sameRole = allyHeroes.filter((h) => h.roles.some((r) => hero.roles.includes(r))).length;
  if (allyHeroes.length > 0 && sameRole >= 1 && hero.roles.every((r) => allyHeroes.some((h) => h.roles.includes(r)))) {
    s -= 20;
    reasons.push('Role overlaps with ally.');
  }
  for (const a of allies) {
    const anti = syn.find(
      (x) => x.type === 'ANTI_SYNERGY' && ((x.source === hero.id && x.target === a) || (x.source === a && x.target === hero.id)),
    );
    if (anti) {
      s -= anti.score;
      reasons.push(`Anti-synergy: ${anti.reason}`);
      break;
    }
  }
  for (const a of allies) {
    const good = syn.find(
      (x) => x.type === 'SYNERGY' && ((x.source === hero.id && x.target === a) || (x.source === a && x.target === hero.id)),
    );
    if (good) {
      s += good.score;
      reasons.push(`Synergy: ${good.reason}`);
      break;
    }
  }
  void counters;
  return { score: clamp(s), reasons };
}

export function finalScore(b: { counter: number; meta: number; comp: number; mastery: number }, w: Weights): number {
  return clamp(b.counter * w.counter + b.meta * w.meta + b.comp * w.comp + b.mastery * w.mastery);
}

// Win probability from two 0-100 ratings. Sigmoid: equal ratings -> 50%.
// `k` is the steepness. k=1.5: +10 rating -> ~57%, +25 -> ~70%, +50 -> ~88%.
export function winProbability(ally: number, enemy: number, k = 1.5): number {
  // Guard: empty side (rating 0) makes the rating difference meaningless.
  // Without a baseline we can't say anything — return 50 as "no info".
  if (ally <= 0 || enemy <= 0) return 50;
  const z = (k * (ally - enemy)) / 50;
  const p = 1 / (1 + Math.exp(-z));
  return Math.round(p * 1000) / 10; // 1 decimal, like teamRating
}

// Same input shape as the old teamRating. Returns the rating AND the per-axis
// average breakdown so callers can render "why" without recomputing.
export interface RatedTeam {
  score: number;
  breakdown: { counter: number; meta: number; comp: number; mastery: number };
}

export function rateTeam(
  team: string[],
  opp: string[],
  pool: Hero[],
  counters: CounterRel[],
  syn: SynergyRel[],
  meta: MetaRow[],
  patches: PatchChange[],
  w: Weights,
): RatedTeam {
  const empty: RatedTeam = { score: 0, breakdown: { counter: 0, meta: 0, comp: 0, mastery: 0 } };
  if (team.length === 0) return empty;
  const byId = new Map(pool.map((h) => [h.id, h] as const));
  let total = 0;
  let n = 0;
  const acc = { counter: 0, meta: 0, comp: 0, mastery: 0 };
  for (const id of team) {
    const hero = byId.get(id);
    if (!hero) continue;
    const mates = team.filter((x) => x !== id);
    const c = counterScore(id, opp, counters).score;
    const m = metaScore(id, meta, patches);
    const cp = compScore(hero, mates, opp, pool, counters, syn).score;
    const b = { counter: c, meta: m, comp: cp, mastery: 50 };
    total += finalScore(b, w);
    acc.counter += c;
    acc.meta += m;
    acc.comp += cp;
    acc.mastery += 50;
    n++;
  }
  if (n === 0) return empty;
  const score = Math.round((total / n) * 10) / 10;
  const breakdown = {
    counter: Math.round((acc.counter / n) * 10) / 10,
    meta: Math.round((acc.meta / n) * 10) / 10,
    comp: Math.round((acc.comp / n) * 10) / 10,
    mastery: Math.round((acc.mastery / n) * 10) / 10,
  };
  return { score, breakdown };
}

// Back-compat shim: old callers (tests) want a plain number.
export function teamRating(
  team: string[],
  opp: string[],
  pool: Hero[],
  counters: CounterRel[],
  syn: SynergyRel[],
  meta: MetaRow[],
  patches: PatchChange[],
  w: Weights,
): number {
  return rateTeam(team, opp, pool, counters, syn, meta, patches, w).score;
}
