import fs from 'node:fs';
import { parseHeroPage, isValidSlug } from './parse.mjs';
import { fetchWithUA } from './http.mjs';
import { cacheIcons } from './cache-icons.mjs';

// pnpm data:update — sync data from mlbbhub (community source).
// 1. Heroes new to the API -> append to heroes.json (name/role/lane/icon scraped from the hero page).
// 2. Rewrite meta.json for every hero.
// New heroes get the NoData tag (neutral scores, no counters) — counters are filled in by hand over time.
// Patch label comes from the argument: pnpm data:update 2.1.96

const API = 'https://mlbbhub.com/api/stats';

const patch = process.argv[2] ?? '2.1.95a';
const heroes = JSON.parse(fs.readFileSync('./data/heroes.json', 'utf8'));
const have = new Set(heroes.map((h) => h.id));

const res = await fetchWithUA(API);
if (!res.ok) throw new Error(`api fetch failed: ${res.status}`);
const json = await res.json();
const bySlug = new Map(json.heroes.map((h) => [h.slug, h]));

// 1. New heroes
// Guard: the API is remote data and the slug ends up in a URL, a filename and a
// hero id, so anything that is not a plain slug is skipped (never fetched).
const missing = [...bySlug.keys()].filter((s) => !have.has(s) && isValidSlug(s));
const rejected = [...bySlug.keys()].filter((s) => !have.has(s) && !isValidSlug(s));
let added = 0,
  iconOk = 0;
const fail = [];
const newSlugs = [];
for (const slug of missing) {
  try {
    const html = await (await fetchWithUA(`https://mlbbhub.com/heroes/${slug}`)).text();
    const { name, role, lane, icon } = parseHeroPage(html, slug);
    if (icon) iconOk++;
    heroes.push({
      id: slug,
      name,
      roles: [role],
      lane,
      difficulty: 5,
      scores: { mobility: 5, cc: 5, burst: 5, sustain: 5, range: 5 },
      tags: ['NoData'],
      patch,
      ...(icon ? { icon } : {}),
    });
    if (icon) newSlugs.push(slug);
    added++;
  } catch {
    fail.push(slug);
  }
  await new Promise((r) => setTimeout(r, 200));
}
for (const h of heroes) h.patch = patch;
fs.writeFileSync('./data/heroes.json', JSON.stringify(heroes));

// Cache new hero icons locally (no CDN hotlinking). In-process call: the slug
// list is remote data and must never reach a shell command line.
if (newSlugs.length > 0) {
  await cacheIcons({ only: newSlugs });
}

// 2. Refresh meta
const rows = [];
const noMeta = [];
for (const h of heroes) {
  const s = bySlug.get(h.id);
  if (!s) {
    noMeta.push(h.id);
    continue;
  }
  rows.push({
    hero: h.id,
    patch,
    win_rate: s.winRate,
    pick_rate: s.pickRate,
    ban_rate: s.banRate,
    tier: s.tier,
    tier_score: tierScore(s.tier),
  });
}
fs.writeFileSync('./data/meta.json', JSON.stringify(rows));

console.log(`heroes: ${heroes.length} (+${added} baru, ikon ${iconOk}) patch: ${patch}`);
console.log('scrape gagal:', fail.join(',') || 'none');
console.log('slug ditolak (bukan pola slug):', rejected.join(',') || 'none');
console.log(`meta rows: ${rows.length}`);
console.log('tanpa meta (fallback 50):', noMeta.join(',') || 'none');
