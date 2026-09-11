import type { Lang } from '../i18n';

export type Side = 'ally' | 'enemy' | 'ourBan' | 'enemyBan';

export const MAX_LINE = 5;
// Slot placeholders rendered for empty draft slots. Used as list keys so they stay
// content-derived rather than index-derived.
export const SLOTS = Array.from({ length: MAX_LINE }, (_, i) => i + 1);

export const ALL_LANE = 'All Lane';
export const ALL_ROLE = 'All Role';

export const ROLE_COLORS: Record<string, string> = {
  Tank: '#3b82f6',
  Fighter: '#f97316',
  Assassin: '#a855f7',
  Mage: '#22d3ee',
  Marksman: '#ef4444',
  Support: '#22c55e',
};

// Tier colours: S gold (OP/ban), A green (strong), B blue (situational), C grey (weak), D red (avoid).
export const TIER_RING: Record<string, string> = { S: '#fbbf24', A: '#22c55e', B: '#3b82f6', C: '#aab4c8', D: '#ef4444' };

// Tier ring colours (this patch's distribution: S 12 · A 21 · B 41 · C 39 · D 20).
export const TIER_INFO: Record<Lang, Record<string, string>> = {
  id: {
    S: 'OP — prioritas pick/ban',
    A: 'Kuat — pick aman',
    B: 'Situasional — ikut komposisi',
    C: 'Lemah — hindari kecuali counter',
    D: 'Jangan pick',
  },
  en: {
    S: 'OP — priority pick/ban',
    A: 'Strong — safe pick',
    B: 'Situational — comp-dependent',
    C: 'Weak — avoid unless counter',
    D: 'Do not pick',
  },
};
