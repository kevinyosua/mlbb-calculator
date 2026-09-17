import { describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { parsePatchFromHtml, fetchPatchFromHub, resolvePatch, readExistingPatch, PATCH_RE, STATS_URL } from '../scripts/patch-source.mjs';

describe('scripts/patch-source', () => {
  describe('parsePatchFromHtml', () => {
    it('extracts quoted patch label from mlbbhub RSC payload', () => {
      const html = '<html>...{"patch":"Patch 2.2.16"}]\\n18:["$","main"</html>';
      expect(parsePatchFromHtml(html)).toBe('2.2.16');
    });

    it('handles escaped trailing quote (current upstream format)', () => {
      // Real mlbbhub payload: "Patch 2.2.16\" (backslash-escaped quote)
      const html = '...["Patch 2.2.16\\"]...';
      expect(parsePatchFromHtml(html)).toBe('2.2.16');
    });

    it('accepts trailing letter suffix (e.g. 2.1.95a)', () => {
      const html = '["Patch 2.1.95a"]';
      expect(parsePatchFromHtml(html)).toBe('2.1.95a');
    });

    it('falls back to unquoted form when no quoted label is present', () => {
      // The unquoted PATCH_RE matches any version-shaped token. In real
      // mlbbhub HTML there are SVG path coordinates that look version-like,
      // but those never win over the quoted form because the regex finds
      // the FIRST version-shaped token. This test only checks behavior when
      // only unquoted tokens exist.
      const html = 'version 2.1.96 release notes';
      expect(parsePatchFromHtml(html)).toBe('2.1.96');
    });

    it('prefers quoted form over earlier unquoted version-shaped tokens', () => {
      // Regression: mlbbhub statistics page contains SVG path coordinates
      // (e.g. `198.373.292`) that match the unquoted PATCH_RE. The quoted
      // `"Patch X.Y.Z"` form appears later in the document but is
      // semantically correct, so the function must check quoted first.
      const html = '<svg><path d="M198.373.292 1.707 1.293"/></svg>' + '["Patch 2.2.16"]';
      expect(parsePatchFromHtml(html)).toBe('2.2.16');
    });

    it('falls back to unquoted form when only unquoted tokens exist', () => {
      // See comment above: unquoted PATCH_RE is a permissive fallback.
      // Numbers like 12.34.567 match because the regex cannot tell them
      // apart from real version labels without the "Patch " prefix.
      const html = 'Latest build: 12.34.567';
      expect(parsePatchFromHtml(html)).toBe('12.34.567');
    });

    it('returns null on empty input', () => {
      expect(parsePatchFromHtml('')).toBeNull();
      expect(parsePatchFromHtml(null)).toBeNull();
      expect(parsePatchFromHtml(undefined)).toBeNull();
    });

    it('returns null when no patch-shaped token is present', () => {
      expect(parsePatchFromHtml('<html></html>')).toBeNull();
    });
  });

  describe('fetchPatchFromHub', () => {
    it('returns parsed patch on 200 response', async () => {
      const fakeFetcher = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('["Patch 2.2.16"]'),
      });
      const result = await fetchPatchFromHub(fakeFetcher);
      expect(result).toBe('2.2.16');
      expect(fakeFetcher).toHaveBeenCalledWith(STATS_URL);
    });

    it('returns null on non-2xx response', async () => {
      const fakeFetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      expect(await fetchPatchFromHub(fakeFetcher)).toBeNull();
    });

    it('returns null on network error', async () => {
      const fakeFetcher = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      expect(await fetchPatchFromHub(fakeFetcher)).toBeNull();
    });

    it('returns null when response body has no patch token', async () => {
      const fakeFetcher = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html>no patch here</html>'),
      });
      expect(await fetchPatchFromHub(fakeFetcher)).toBeNull();
    });
  });

  describe('readExistingPatch', () => {
    it('returns patch from data/heroes.json when present', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-src-'));
      try {
        fs.writeFileSync(path.join(dir, 'heroes.json'), JSON.stringify([{ patch: '2.2.16' }]));
        expect(readExistingPatch([path.join(dir, 'heroes.json')])).toBe('2.2.16');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('falls through to meta.json when heroes.json is missing', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-src-'));
      try {
        fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify([{ patch: '2.1.95a' }]));
        expect(readExistingPatch([path.join(dir, 'heroes.json'), path.join(dir, 'meta.json')])).toBe('2.1.95a');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('returns null when no data file has a valid patch field', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-src-'));
      try {
        fs.writeFileSync(path.join(dir, 'heroes.json'), JSON.stringify([]));
        expect(readExistingPatch([path.join(dir, 'heroes.json')])).toBeNull();
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('returns null when no file exists', () => {
      expect(readExistingPatch(['/nonexistent/heroes.json'])).toBeNull();
    });
  });

  describe('resolvePatch', () => {
    it('uses CLI argument when provided (priority 1)', async () => {
      const result = await resolvePatch({
        argv: ['node', 'script', '2.3.0'],
        env: { PATCH_LABEL: 'should-be-ignored' },
        fetcher: vi.fn(),
      });
      expect(result).toEqual({ patch: '2.3.0', source: 'cli' });
    });

    it('uses PATCH_LABEL env when CLI is empty (priority 2)', async () => {
      const result = await resolvePatch({
        argv: ['node', 'script'],
        env: { PATCH_LABEL: '2.1.96' },
        fetcher: vi.fn(),
      });
      expect(result).toEqual({ patch: '2.1.96', source: 'env' });
    });

    it('scrapes mlbbhub when CLI and env are empty (priority 3)', async () => {
      const result = await resolvePatch({
        argv: ['node', 'script'],
        env: {},
        fetcher: vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('["Patch 2.2.16"]'),
        }),
      });
      expect(result).toEqual({ patch: '2.2.16', source: 'mlbbhub' });
    });

    it('returns existing patch when hub fetch fails (priority 4)', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-src-'));
      try {
        fs.writeFileSync(path.join(dir, 'heroes.json'), JSON.stringify([{ patch: '2.1.95a' }]));
        const result = await resolvePatch({
          argv: ['node', 'script'],
          env: {},
          existingPaths: [path.join(dir, 'heroes.json')],
          fetcher: vi.fn().mockRejectedValue(new Error('offline')),
        });
        expect(result).toEqual({ patch: '2.1.95a', source: 'existing' });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('falls back to 2.1.95a when nothing else resolves (priority 5)', async () => {
      const result = await resolvePatch({
        argv: ['node', 'script'],
        env: {},
        existingPaths: ['/nonexistent/heroes.json'],
        fetcher: vi.fn().mockRejectedValue(new Error('offline')),
      });
      expect(result).toEqual({ patch: '2.1.95a', source: 'fallback' });
    });

    it('honors custom fallback', async () => {
      const result = await resolvePatch({
        argv: ['node', 'script'],
        env: {},
        existingPaths: ['/nonexistent/heroes.json'],
        fetcher: vi.fn().mockRejectedValue(new Error('offline')),
        fallback: '0.0.1',
      });
      expect(result).toEqual({ patch: '0.0.1', source: 'fallback' });
    });
  });

  describe('PATCH_RE', () => {
    it('matches clean version-shaped tokens', () => {
      expect('2.2.16'.match(PATCH_RE)?.[1]).toBe('2.2.16');
      expect('2.1.95a'.match(PATCH_RE)?.[1]).toBe('2.1.95a');
    });

    it('does not match when preceded by another digit/dot', () => {
      // `12.34.567` would be matched as a standalone version, but
      // `1234.567` (no dot between 1 and 2) is not a version at all.
      expect('x1234.567'.match(PATCH_RE)).toBeNull();
    });
  });
});
