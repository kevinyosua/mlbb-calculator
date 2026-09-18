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

const filterTsx = fs.readFileSync(new URL('../src/ui/filter.tsx', import.meta.url), 'utf8');

/**
 * The filter bar floats above the bottom edge, so any bottom margin on the bar
 * itself reads as a dead gap under the sticky chrome. The app's own
 * padding-bottom is the only bottom spacing it gets.
 */
describe('filter bar sits flush to the bottom', () => {
  // Fixed pattern: selector is a literal, so no dynamic regex is built.
  const blockAfter = (haystack: string, literals: string[]) => {
    for (const lit of literals) {
      const at = haystack.indexOf(`${lit} {`);
      if (at === -1) continue;
      const open = haystack.indexOf('{', at);
      const close = haystack.indexOf('}', open);
      if (open !== -1 && close !== -1) return haystack.slice(open + 1, close);
    }
    return '';
  };

  it('.mdc-filterbar declares no bottom margin', () => {
    const body = blockAfter(css, ['.mdc-filterbar']);
    expect(body).not.toBe('');
    // `margin: <top> <sides> <bottom>` shorthand must end in 0 / 0px.
    const shorthand = /margin:\s*([^;]+);/.exec(body)?.[1].trim();
    if (shorthand) {
      const parts = shorthand.split(/\s+/);
      const bottom = parts[2] ?? parts[0];
      expect(['0', '0px']).toContain(bottom);
    }
    const mb = /margin-bottom:\s*([^;]+);/.exec(body)?.[1].trim();
    if (mb) expect(['0', '0px']).toContain(mb);
  });

  it('.mdc-filter-closed declares no bottom margin', () => {
    const body = blockAfter(css, ['.mdc-filter-closed']);
    expect(body).not.toBe('');
    const mb = /margin-bottom:\s*([^;]+);/.exec(body)?.[1].trim();
    if (mb) expect(['0', '0px']).toContain(mb);
  });
});

/**
 * Regression: `Lane: All Lane` / `Role: All Role` measured ~116px at 16px,
 * overflowing the ~115px slot each select gets at a 390px viewport — that was
 * the "squeezed" text, not the font size. The empty option now names the field
 * alone and the accessible name lives on aria-label / a visually-hidden label.
 */
describe('filter option labels stay short', () => {
  it('no option text re-states the field name as a colon prefix', () => {
    expect(filterTsx).not.toMatch(/[`'"]Lane: /);
    expect(filterTsx).not.toMatch(/[`'"]Role: /);
  });

  it('every select keeps an accessible name', () => {
    const ids = ['mdc-lane', 'mdc-role', 'mdc-tier'];
    for (const id of ids) {
      // Fixed scan: locate the literal id, then look for aria-label nearby.
      const at = filterTsx.indexOf(`id="${id}"`);
      expect(at, `select #${id} not found`).toBeGreaterThan(-1);
      const slice = filterTsx.slice(at, at + 400);
      expect(slice.includes('aria-label="'), `select #${id} has no aria-label`).toBe(true);
    }
  });
});
