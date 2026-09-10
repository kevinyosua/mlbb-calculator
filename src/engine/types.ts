export type Role = 'Tank' | 'Fighter' | 'Assassin' | 'Mage' | 'Marksman' | 'Support';

export interface HeroScores {
  mobility: number;
  cc: number;
  burst: number;
  sustain: number;
  range: number;
}

export interface Hero {
  id: string;
  name: string;
  roles: Role[];
  lane: string;
  difficulty: number;
  scores: HeroScores;
  tags: string[];
  patch: string;
  icon?: string;
}

export type RelType = 'COUNTER' | 'COUNTERED_BY' | 'SYNERGY' | 'ANTI_SYNERGY';

export interface CounterRel {
  source: string;
  target: string;
  type: RelType;
  score: number;
  tags: string[];
  reason: string;
  sources: string[];
  patch_verified: string;
}

export interface SynergyRel {
  source: string;
  target: string;
  type: 'SYNERGY' | 'ANTI_SYNERGY';
  score: number;
  reason: string;
  sources: string[];
  patch_verified: string;
}

export interface MetaRow {
  hero: string;
  patch: string;
  win_rate: number;
  pick_rate: number;
  ban_rate: number;
  tier: string;
  tier_score: number;
}

export interface PatchChange {
  hero: string;
  patch: string;
  change: string;
  impact: number;
  note: string;
  source_url: string;
}

export interface Weights {
  counter: number;
  meta: number;
  comp: number;
  mastery: number;
}

export interface Breakdown {
  counter: number;
  meta: number;
  comp: number;
  mastery: number;
}

export interface Rec {
  hero: string;
  score: number;
  reasons: string[];
  breakdown: Breakdown;
}
