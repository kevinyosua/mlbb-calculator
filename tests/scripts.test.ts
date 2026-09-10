import { describe, expect, it } from 'vitest';
import {
  parseHeroPage, normalizeLane, normalizeRole, heroNameFallback,
  isValidHeroName, tierScore, ppToScore, isValidCounter, isValidMeta,
} from '../scripts/parse.mjs';
import countersJson from '../data/counters.json';
import heroesJson from '../data/heroes.json';
import metaJson from '../data/meta.json';

describe('scripts/parse', () => {
  it('nama dari <title>, bukan breadcrumb Heroes (regresi bug import)', () => {
    const html = '<html><head><title>MLBB Rafaela Build, Guide</title></head><body><a href="/heroes">Heroes</a><a href="/roles/support">x</a>How to Build Rafaela in Mobile Legends: Roam</body></html>';
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
