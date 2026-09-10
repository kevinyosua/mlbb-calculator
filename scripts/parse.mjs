// Pure parsing logic (no fetch/fs) — unit-tested via tests/scripts.test.ts.
export const TIER_SCORE = { S: 10, A: 8, B: 6, C: 4, D: 2 };
export const LANE_FIX = { EXP: 'Exp', Ranked: 'Mid', Conceal: 'Roam' };
export const VALID_LANES = ['Exp', 'Jungle', 'Mid', 'Gold', 'Roam'];
export const VALID_ROLES = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];

export const heroNameFallback = (slug) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Slugs come from a remote API/scraped HTML and end up in file paths and URLs:
// restrict them to the shape the source actually uses so they can never carry a
// path separator, a shell metacharacter or an unexpected host.
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const isValidSlug = (slug) => typeof slug === 'string' && SLUG_RE.test(slug);

// Icon bytes are fetched from URLs scraped out of remote HTML; only the image
// proxy we expect is accepted (no arbitrary host, no http://).
export const ICON_HOST = 'https://wsrv.nl/';
export const isAllowedIconUrl = (url) => typeof url === 'string' && url.startsWith(ICON_HOST);

export const normalizeLane = (raw) => (VALID_LANES.includes(raw) ? raw : (LANE_FIX[raw] ?? 'Exp'));

export const normalizeRole = (raw) => {
  if (!raw) return 'Fighter';
  const r = raw[0].toUpperCase() + raw.slice(1);
  return VALID_ROLES.includes(r) ? r : 'Fighter';
};

// Guard: name is valid when non-empty and not a navigation word (the "Heroes" bug).
const NAV_WORDS = new Set(['Heroes', 'Build', 'Guide', 'Counter']);
export const isValidHeroName = (name) => typeof name === 'string' && name.trim().length > 1 && !NAV_WORDS.has(name.trim());

export function parseHeroPage(html, slug) {
  const titleM = html.match(/<title>MLBB (.+?) Build,/);
  const rawName = titleM ? titleM[1].trim() : heroNameFallback(slug);
  const name = isValidHeroName(rawName) ? rawName : heroNameFallback(slug);
  const roleM = html.match(/href="\/roles\/([a-z]+)"/);
  const role = normalizeRole(roleM?.[1]);
  const laneM = html.match(/How to Build [^<]*? in Mobile Legends: (\w+)/);
  const lane = normalizeLane(laneM?.[1] ?? 'Exp');
  const iconM = html.match(/https:\/\/wsrv\.nl\/\?url=https[^"'\s]*?100_[a-f0-9]+\.png[^"'\s]*/);
  const icon = iconM ? iconM[0].replace(/&amp;/g, '&').replace('w=256', 'w=64') : undefined;
  return { name, role, lane, icon };
}

export const tierScore = (tier) => TIER_SCORE[tier] ?? 5;

// Guard: counter row is valid (score 0-100, known type, non-empty sources).
const REL_TYPES = new Set(['COUNTER', 'COUNTERED_BY', 'SYNERGY', 'ANTI_SYNERGY']);
export const isValidCounter = (c) =>
  c &&
  typeof c.source === 'string' &&
  typeof c.target === 'string' &&
  c.source !== c.target &&
  REL_TYPES.has(c.type) &&
  typeof c.score === 'number' &&
  c.score >= 0 &&
  c.score <= 100 &&
  Array.isArray(c.sources) &&
  c.sources.length > 0 &&
  Array.isArray(c.tags) &&
  c.tags.length > 0;

// Proven +pp -> score 0-100.
export const ppToScore = (pp) => Math.min(10, Math.round(5 + pp));

// Guard: meta row is valid.
export const isValidMeta = (m) =>
  m &&
  typeof m.hero === 'string' &&
  typeof m.win_rate === 'number' &&
  m.win_rate >= 0 &&
  m.win_rate <= 100 &&
  typeof m.tier_score === 'number' &&
  m.tier_score >= 0 &&
  m.tier_score <= 10;
