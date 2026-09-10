import type { CounterRel, Hero, MetaRow, PatchChange, SynergyRel, Weights } from './types';

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export function counterScore(heroId: string, enemies: string[], counters: CounterRel[]): { score: number; reasons: string[] } {
  if (enemies.length === 0) return { score: 0, reasons: [] };
  const hits = counters.filter((c) => c.source === heroId && c.type === 'COUNTER' && enemies.includes(c.target));
  if (hits.length === 0) return { score: 0, reasons: [] };
  const covered = new Set(hits.map((h) => h.target));
  const avg = hits.reduce((s, h) => s + h.score, 0) / hits.length;
  const coverage = covered.size / enemies.length;
  const score = clamp(avg * 10 * (0.6 + 0.4 * coverage));
  const reasons = [...hits].sort((a, b) => b.score - a.score).slice(0, 3).map((h) => h.reason);
  return { score, reasons };
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

export function compScore(hero: Hero, allies: string[], enemies: string[], pool: Hero[], counters: CounterRel[], syn: SynergyRel[]): { score: number; reasons: string[] } {
  let s = 50;
  const reasons: string[] = [];
  const allyHeroes = pool.filter((h) => allies.includes(h.id));
  const hasFrontline = allyHeroes.some((h) => h.tags.includes('Frontline') || h.roles.includes('Tank'));
  if (!hasFrontline && (hero.tags.includes('Frontline') || hero.roles.includes('Tank'))) {
    s += 25; reasons.push('Fills missing frontline.');
  }
  const hasDamage = allyHeroes.some((h) => h.roles.includes('Marksman') || h.roles.includes('Mage') || h.roles.includes('Assassin'));
  if (!hasDamage && hero.scores.burst >= 7) {
    s += 25; reasons.push('Fills missing damage.');
  }
  const dashEnemies = enemies.filter((e) => {
    const h = pool.find((p) => p.id === e);
    return h && (h.tags.includes('High Mobility') || h.tags.includes('Dash'));
  });
  if (dashEnemies.length >= 1 && (hero.tags.includes('Anti Dash') || hero.tags.includes('Suppression') || hero.tags.includes('Hard CC'))) {
    s += 15; reasons.push('Punishes enemy mobility.');
  }
  const sameRole = allyHeroes.filter((h) => h.roles.some((r) => hero.roles.includes(r))).length;
  if (allyHeroes.length > 0 && sameRole >= 1 && hero.roles.every((r) => allyHeroes.some((h) => h.roles.includes(r)))) {
    s -= 20; reasons.push('Role overlaps with ally.');
  }
  for (const a of allies) {
    const anti = syn.find((x) => x.type === 'ANTI_SYNERGY' && ((x.source === hero.id && x.target === a) || (x.source === a && x.target === hero.id)));
    if (anti) { s -= anti.score; reasons.push('Anti-synergy: ' + anti.reason); break; }
  }
  for (const a of allies) {
    const good = syn.find((x) => x.type === 'SYNERGY' && ((x.source === hero.id && x.target === a) || (x.source === a && x.target === hero.id)));
    if (good) { s += good.score; reasons.push('Synergy: ' + good.reason); break; }
  }
  void counters;
  return { score: clamp(s), reasons };
}

export function finalScore(b: { counter: number; meta: number; comp: number; mastery: number }, w: Weights): number {
  return clamp(b.counter * w.counter + b.meta * w.meta + b.comp * w.comp + b.mastery * w.mastery);
}
