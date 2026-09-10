import type { CounterRel, Hero, MetaRow, PatchChange, SynergyRel, Weights } from '../engine/types';
import countersJson from '../../data/counters.json';
import heroesJson from '../../data/heroes.json';
import metaJson from '../../data/meta.json';
import patchesJson from '../../data/patches.json';
import synergiesJson from '../../data/synergies.json';
import weightsJson from '../engine/weights.json';

export interface GameData { heroes: Hero[]; counters: CounterRel[]; syn: SynergyRel[]; meta: MetaRow[]; patches: PatchChange[]; weights: Weights }

export function loadAll(): GameData {
  const heroes = heroesJson as Hero[];
  const counters = countersJson as CounterRel[];
  const syn = synergiesJson as SynergyRel[];
  const meta = metaJson as MetaRow[];
  const patches = patchesJson as PatchChange[];
  const weights = weightsJson as Weights;
  const sum = weights.counter + weights.meta + weights.comp + weights.mastery;
  if (Math.abs(sum - 1) > 1e-6) throw new Error('weights must sum to 1, got ' + sum);
  for (const h of heroes) for (const k of Object.values(h.scores)) {
    if (!Number.isInteger(k) || k < 0 || k > 10) throw new Error('hero score out of range: ' + h.id);
  }
  return { heroes, counters, syn, meta, patches, weights };
}
