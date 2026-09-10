import fs from 'node:fs';
import { ppToScore, isValidCounter } from './parse.mjs';

// pnpm counters:update [patch] — tarik /counter/<slug> mlbbhub untuk semua hero.
// Proven counters (+pp terukur) -> COUNTER (score = min(10, round(5 + pp))).
// Strong-against -> COUNTERED_BY (score 6).
// Manual menang bila konflik (data tangan M1 dipertahankan).
// Patch label dari argumen, default 2.1.95a.

const patch = process.argv[2] ?? '2.1.95a';
const heroes = JSON.parse(fs.readFileSync('./data/heroes.json', 'utf8'));
const manual = JSON.parse(fs.readFileSync('./data/counters.json', 'utf8'));
const manualKey = new Set(manual.map((c) => `${c.source}>${c.target}:${c.type}`));

const rows = [...manual];
let prov = 0, sa = 0, skipped = 0;
const fail = [];
for (const h of heroes) {
  const slug = h.id;
  try {
    const html = await (await fetch(`https://mlbbhub.com/counter/${slug}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    if (!html.includes('Proven Counters')) { fail.push(slug + '(no-page)'); continue; }
    const pSec = html.slice(html.indexOf('Proven Counters'), html.includes('Kit Matchups') ? html.indexOf('Kit Matchups') : undefined);
    const hits = [...pSec.matchAll(/href="\/counter\/([a-z0-9-]+)">[\s\S]{0,2500}?holds a measured \+([0-9.]+) pp/g)];
    for (const m of hits) {
      const key = `${m[1]}>${slug}:COUNTER`;
      if (manualKey.has(key)) { skipped++; continue; }
      const pp = parseFloat(m[2]);
      rows.push({
        source: m[1], target: slug, type: 'COUNTER',
        score: ppToScore(pp),
        tags: ['measured'], reason: `+${pp} pp ranked edge vs ${h.name} (mlbbhub measured).`,
        sources: [`https://mlbbhub.com/counter/${slug}`], patch_verified: patch,
      });
      prov++;
    }
    if (html.includes('Strong Against')) {
      const sSec = html.slice(html.indexOf('Strong Against'), html.includes('Game Phase') ? html.indexOf('Game Phase') : undefined);
      const targets = [...sSec.matchAll(/href="\/counter\/([a-z0-9-]+)"/g)].map((m) => m[1]);
      for (const t of targets) {
        const key = `${slug}>${t}:COUNTERED_BY`;
        if (manualKey.has(key)) { skipped++; continue; }
        rows.push({
          source: slug, target: t, type: 'COUNTERED_BY',
          score: 6, tags: ['measured'],
          reason: `${h.name} kuat lawan ${t} (mlbbhub strong-against). Hindari pick ${t}.`,
          sources: [`https://mlbbhub.com/counter/${slug}`], patch_verified: patch,
        });
        sa++;
      }
    }
  } catch { fail.push(slug); }
  await new Promise((r) => setTimeout(r, 150));
}
// Guard: buang row invalid sebelum tulis (jangan racuni data).
const clean = rows.filter(isValidCounter);
console.log(`drop invalid: ${rows.length - clean.length}`);
fs.writeFileSync('./data/counters.json', JSON.stringify(clean));
console.log(`rows: ${rows.length} (manual ${manual.length} + proven ${prov} + strong-against ${sa}, skip-konflik ${skipped})`);
console.log('gagal/tanpa-halaman:', fail.join(',') || 'none');
