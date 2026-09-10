import fs from 'node:fs';
import { parseHeroPage, normalizeLane, heroNameFallback } from './parse.mjs';

// pnpm data:update — sinkronisasi data dari mlbbhub (sumber komunitas).
// 1. Hero baru di API -> tambah ke heroes.json (nama/role/lane/icon dari scrape halaman hero).
// 2. Tulis ulang meta.json untuk semua hero.
// Hero baru dapat tags NoData (scores netral, counter 0) — counter diisi manual bertahap.
// Patch label diambil dari argumen: pnpm data:update 2.1.96

const API = 'https://mlbbhub.com/api/stats';

const patch = process.argv[2] ?? '2.1.95a';
const heroes = JSON.parse(fs.readFileSync('./data/heroes.json', 'utf8'));
const have = new Set(heroes.map((h) => h.id));

const res = await fetch(API, { headers: { 'User-Agent': 'mlbb-draft/1.0' } });
if (!res.ok) throw new Error('api fetch failed: ' + res.status);
const json = await res.json();
const bySlug = new Map(json.heroes.map((h) => [h.slug, h]));

// 1. Hero baru
const missing = [...bySlug.keys()].filter((s) => !have.has(s));
let added = 0, iconOk = 0;
const fail = [];
const newSlugs = [];
for (const slug of missing) {
  try {
    const html = await (await fetch(`https://mlbbhub.com/heroes/${slug}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    const { name, role, lane, icon } = parseHeroPage(html, slug);
    if (icon) iconOk++;
    heroes.push({ id: slug, name, roles: [role], lane, difficulty: 5, scores: { mobility: 5, cc: 5, burst: 5, sustain: 5, range: 5 }, tags: ['NoData'], patch, ...(icon ? { icon } : {}) });
    if (icon) newSlugs.push(slug);
    added++;
  } catch { fail.push(slug); }
  await new Promise((r) => setTimeout(r, 200));
}
for (const h of heroes) h.patch = patch;
fs.writeFileSync('./data/heroes.json', JSON.stringify(heroes));

// Cache ikon hero baru ke lokal (tanpa hotlink CDN).
if (newSlugs.length > 0) {
  const { execSync } = await import('node:child_process');
  execSync(`node ./scripts/cache-icons.mjs ${newSlugs.join(' ')}`, { stdio: 'inherit' });
}

// 2. Meta ulang
const rows = [];
const noMeta = [];
for (const h of heroes) {
  const s = bySlug.get(h.id);
  if (!s) { noMeta.push(h.id); continue; }
  rows.push({ hero: h.id, patch, win_rate: s.winRate, pick_rate: s.pickRate, ban_rate: s.banRate, tier: s.tier, tier_score: tierScore(s.tier) });
}
fs.writeFileSync('./data/meta.json', JSON.stringify(rows));

console.log(`heroes: ${heroes.length} (+${added} baru, ikon ${iconOk}) patch: ${patch}`);
console.log('scrape gagal:', fail.join(',') || 'none');
console.log(`meta rows: ${rows.length}`);
console.log('tanpa meta (fallback 50):', noMeta.join(',') || 'none');
