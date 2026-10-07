import fs from 'node:fs';
import { ppToScore, isValidCounter, isValidSlug, counterKey, isScrapedRow, dedupeCounters, sortCounters } from './parse.mjs';
import { fetchWithUA } from './http.mjs';
import { resolvePatch } from './patch-source.mjs';

// pnpm counters:update [patch] — pull /counter/<slug> from mlbbhub for every hero.
// Proven counters (measured +pp) -> COUNTER (score = min(10, round(5 + pp))).
// Strong-against -> COUNTERED_BY, victim-first (source = hero that loses,
// target = hero that wins) to match hand-written rows, e.g. page franco
// listing fanny becomes {source: fanny, target: franco} — franco beats fanny.
// Hand-written rows win conflicts (the M1 seed data is preserved).
// Patch label via resolvePatch (cli/env/hub/existing/fallback), same as
// data-update — never hardcoded, so scraped rows carry current patch.

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    process.stderr.write(`gagal baca ${p}\n`);
    process.exit(1);
  }
}

const { patch, source } = await resolvePatch({ fetcher: fetchWithUA });
process.stdout.write(`patch source: ${source} -> ${patch}\n`);
const heroes = readJson('./data/heroes.json');
const stored = readJson('./data/counters.json');
// Rebuild scraped rows fresh each run: seed is hand rows only. Old scraped
// rows are dropped, so re-scraping the same matchup is an update, not a
// conflict (previously every re-run hit skip-konflik ~1879 on stale rows).
const manual = stored.filter((c) => !isScrapedRow(c));
const rebuilt = stored.length - manual.length;
const seen = new Set(manual.map(counterKey));

// Guard: scraped ids only enter the dataset when they name a known hero.
const heroIds = new Set(heroes.map((h) => h.id));
const isKnownHero = (slug) => isValidSlug(slug) && heroIds.has(slug);

const rows = [...manual];
let prov = 0,
  sa = 0,
  skipped = 0;
const fail = [];
for (const h of heroes) {
  const slug = h.id;
  try {
    const html = await (await fetchWithUA(`https://mlbbhub.com/counter/${slug}`)).text();
    if (!html.includes('Proven Counters')) {
      fail.push(`${slug}(no-page)`);
      continue;
    }
    const pSec = html.slice(html.indexOf('Proven Counters'), html.includes('Kit Matchups') ? html.indexOf('Kit Matchups') : undefined);
    const hits = [...pSec.matchAll(/href="\/counter\/([a-z0-9-]+)">[\s\S]{0,2500}?holds a measured \+([0-9.]+) pp/g)];
    for (const m of hits) {
      if (!isKnownHero(m[1])) continue;
      const key = `${m[1]}>${slug}:COUNTER`;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      const pp = parseFloat(m[2]);
      rows.push({
        source: m[1],
        target: slug,
        type: 'COUNTER',
        score: ppToScore(pp),
        tags: ['measured'],
        reason: `+${pp} pp ranked edge vs ${h.name} (mlbbhub measured).`,
        sources: [`https://mlbbhub.com/counter/${slug}`],
        patch_verified: patch,
      });
      prov++;
    }
    if (html.includes('Strong Against')) {
      const sSec = html.slice(html.indexOf('Strong Against'), html.includes('Game Phase') ? html.indexOf('Game Phase') : undefined);
      const targets = [...sSec.matchAll(/href="\/counter\/([a-z0-9-]+)"/g)].map((m) => m[1]);
      for (const t of targets) {
        if (!isKnownHero(t)) continue;
        const key = `${t}>${slug}:COUNTERED_BY`;
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        rows.push({
          source: t,
          target: slug,
          type: 'COUNTERED_BY',
          score: 6,
          tags: ['measured'],
          reason: `${t} lemah lawan ${h.name} (mlbbhub strong-against). Hindari pick ${t}.`,
          sources: [`https://mlbbhub.com/counter/${slug}`],
          patch_verified: patch,
        });
        sa++;
      }
    }
  } catch {
    fail.push(slug);
  }
  await new Promise((r) => setTimeout(r, 150));
}
// Guard: drop invalid rows before writing (never poison the data).
// Restructure every write: dedupe then stable sort by key, pretty-printed
// so git diff stays line-oriented instead of one 500KB line.
const valid = rows.filter(isValidCounter);
const deduped = dedupeCounters(valid);
const clean = sortCounters(deduped);
process.stdout.write(`drop invalid: ${rows.length - valid.length}, drop duplikat: ${valid.length - deduped.length}\n`);
fs.writeFileSync('./data/counters.json', JSON.stringify(clean));
process.stdout.write(
  `rows: ${clean.length} (manual ${manual.length} + proven ${prov} + strong-against ${sa}, skip-konflik ${skipped}, rebuild buang ${rebuilt})\n`,
);
process.stdout.write(`gagal/tanpa-halaman: ${fail.join(',') || 'none'}\n`);
