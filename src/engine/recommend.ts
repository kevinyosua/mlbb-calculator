import { compScore, counterScore, finalScore, metaScore } from './score';
import type { CounterRel, Hero, MetaRow, PatchChange, Rec, SynergyRel, Weights } from './types';

export interface RecommendInput {
  allies: string[];
  enemies: string[];
  bans?: string[];
  pool: Hero[];
  counters: CounterRel[];
  syn: SynergyRel[];
  meta: MetaRow[];
  patches: PatchChange[];
  weights: Weights;
  mastery?: Record<string, number>;
  limit?: number;
}

export function recommend(inp: RecommendInput): Rec[] {
  const bans = new Set(inp.bans ?? []);
  const mastery = inp.mastery ?? {};
  const limit = inp.limit ?? 5;
  return inp.pool
    .filter((h) => !inp.allies.includes(h.id) && !inp.enemies.includes(h.id) && !bans.has(h.id))
    .map((h) => {
      const c = counterScore(h.id, inp.enemies, inp.counters);
      const m = metaScore(h.id, inp.meta, inp.patches);
      const cp = compScore(h, inp.allies, inp.enemies, inp.pool, inp.counters, inp.syn);
      const b = { counter: c.score, meta: m, comp: cp.score, mastery: mastery[h.id] ?? 50 };
      const score = Math.round(finalScore(b, inp.weights) * 10) / 10;
      const reasons = [...c.reasons, ...cp.reasons].slice(0, 3);
      return { hero: h.id, score, reasons, breakdown: b };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
