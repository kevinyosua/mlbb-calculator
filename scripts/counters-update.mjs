import fs from 'node:fs';
import { ppToScore, isValidCounter, isValidSlug } from './parse.mjs';
import { fetchWithUA } from './http.mjs';

// pnpm counters:update [patch] — pull /counter/<slug> from mlbbhub for every hero.
// Proven counters (measured +pp) -> COUNTER (score = min(10, round(5 + pp))).
// Strong-against -> COUNTERED_BY (score 6).
// Hand-written rows win conflicts (the M1 seed data is preserved).
// Patch label comes from the argument, default 2.1.95a.

const patch = process.argv[2] ?? '2.1.95a';
const heroes = JSON.parse(fs.readFileSync('./data/heroes.json', 'utf8'));
const manual = JSON.parse(fs.readFileSync('./data/counters.json', 'utf8'));
const manualKey = new Set(manual.map((c) => `${c.source}>${c.target}:${c.type}`));

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
      if (manualKey.has(key)) {
        skipped++;
        continue;
      }
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
        const key = `${slug}>${t}:COUNTERED_BY`;
        if (manualKey.has(key)) {
          skipped++;
          continue;
        }
        rows.push({
          source: slug,
          target: t,
          type: 'COUNTERED_BY',
          score: 6,
          tags: ['measured'],
          reason: `${h.name} kuat lawan ${t} (mlbbhub strong-against). Hindari pick ${t}.`,
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
const clean = rows.filter(isValidCounter);
console.log(`drop invalid: ${rows.length - clean.length}`);
fs.writeFileSync('./data/counters.json', JSON.stringify(clean));
console.log(`rows: ${rows.length} (manual ${manual.length} + proven ${prov} + strong-against ${sa}, skip-konflik ${skipped})`);
console.log('gagal/tanpa-halaman:', fail.join(',') || 'none');
