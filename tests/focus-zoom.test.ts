import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

/**
 * iOS Safari auto-zooms when a focused input/select has a used font-size below
 * 16px, and does not zoom back out. `addSide` in App.tsx focuses the search
 * input on every pick/ban click, so any sub-16px control in the filter bar
 * turns each tap into a permanent page zoom.
 */
describe('iOS focus-zoom guard', () => {
  it('no input/select rule sets font-size below 16px', () => {
    // Every `input`/`select` selector block that declares font-size.
    const blocks = css.match(/(?:^|\n)([^{}\n][^{}]*?)\{([^{}]*)\}/g) ?? [];
    const offenders: string[] = [];
    for (const block of blocks) {
      const [selectorRaw, body] = block.split('{');
      const selector = selectorRaw.trim().replace(/^\n/, '');
      if (!/(^|[\s,>+~])(input|select|textarea)\b/.test(selector)) continue;
      const m = body.match(/font-size:\s*([^;]+);/);
      if (!m) continue;
      const value = m[1].trim();
      // Accept only explicit values that can never resolve below 16px.
      const px = /^(\d*\.?\d+)px$/.exec(value);
      const rem = /^(\d*\.?\d+)rem$/.exec(value);
      const em = /(\d*\.?\d+)em$/.exec(value);
      const okPx = px ? Number(px[1]) >= 16 : false;
      const okRem = rem ? Number(rem[1]) >= 1 : false;
      // em resolves against the parent (16px default, but unproven) -> reject.
      const ok = okPx || okRem;
      if (!ok && !/^(inherit|unset|revert)$/.test(value)) {
        offenders.push(`${selector} -> font-size: ${value}${em ? ' (em-based, unproven)' : ''}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('root element declares no font-size that could shrink the em basis', () => {
    const rootBlocks = css.match(/(?:^|\n)(html|:root|body)\s*\{([^{}]*)\}/g) ?? [];
    for (const block of rootBlocks) {
      expect(/font-size/.test(block)).toBe(false);
    }
  });
});
