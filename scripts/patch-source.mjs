// Patch label resolution for data:update.
//
// Pure async functions, no top-level side effects, safe to import from tests.
// Inputs are intentionally injectable so tests can mock network calls
// without monkey-patching global fetch.
//
// Sources, in priority order:
//   1. CLI argument (process.argv[2]).
//   2. PATCH_LABEL environment variable.
//   3. mlbbhub.com /statistics page (scraped).
//   4. Last patch label written into data/heroes.json by the previous run.
//   5. Hard fallback `'2.1.95a'`.

import fs from 'node:fs';

export const STATS_URL = 'https://mlbbhub.com/statistics';

// Patch label is a version-like token: digits + dots + optional single
// trailing letter. Anchored so it cannot match arbitrary numbers in HTML
// (e.g. SVG path coordinates like `198.373.292a`).
export const PATCH_RE = /(?<![0-9.])([0-9]+\.[0-9]+\.[0-9]+[a-z]?)(?![0-9.])/;

export function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function readExistingPatch(paths = ['./data/heroes.json', './data/meta.json', './data/patches.json']) {
  for (const p of paths) {
    const data = readJsonSafe(p);
    if (Array.isArray(data) && data.length > 0 && typeof data[0]?.patch === 'string') {
      return data[0].patch;
    }
  }
  return null;
}

// Test seam: pass a custom fetcher so unit tests can return canned HTML
// without touching the network. The signature mirrors global fetch.
export async function fetchPatchFromHub(fetcher = fetch) {
  try {
    const res = await fetcher(STATS_URL);
    if (!res?.ok) return null;
    const html = await res.text();
    return parsePatchFromHtml(html);
  } catch {
    return null;
  }
}

export function parsePatchFromHtml(html) {
  if (typeof html !== 'string' || html.length === 0) return null;
  // The statistics page embeds the active patch label in the Next.js RSC
  // payload as `"Patch 2.2.16\"` (note the escaped trailing quote). Match
  // the quoted form first so SVG path numbers like `1.414.586` never
  // get picked up. Accept both forms of trailing quote because the
  // upstream escape has changed at least once.
  const quoted = html.match(/"Patch\s+([0-9]+\.[0-9]+\.[0-9]+[a-z]?)(?:\\"|")/i);
  if (quoted) return quoted[1];
  // Fallback: any version-shaped token not surrounded by digits/dots.
  const any = html.match(PATCH_RE);
  return any ? any[1] : null;
}

export const DEFAULT_FALLBACK_PATCH = '2.1.95a';

export async function resolvePatch({
  argv = process.argv,
  env = process.env,
  fetcher,
  existingPaths,
  fallback = DEFAULT_FALLBACK_PATCH,
} = {}) {
  const cliArg = argv[2];
  if (cliArg) return { patch: cliArg, source: 'cli' };

  const envArg = env.PATCH_LABEL;
  if (envArg) return { patch: envArg, source: 'env' };

  const fromHub = await fetchPatchFromHub(fetcher);
  if (fromHub) return { patch: fromHub, source: 'mlbbhub' };

  const existing = readExistingPatch(existingPaths);
  if (existing) return { patch: existing, source: 'existing' };

  return { patch: fallback, source: 'fallback' };
}
