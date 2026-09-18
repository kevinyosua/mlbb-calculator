import { describe, expect, it } from 'vitest';
import { keyboardInset } from '../src/ui/keyboard';

describe('keyboardInset', () => {
  it('returns 0 with no visualViewport (desktop / unsupported)', () => {
    expect(keyboardInset(null, 800)).toBe(0);
  });

  it('returns 0 when visual viewport fills the layout viewport (keyboard closed)', () => {
    expect(keyboardInset({ height: 800, offsetTop: 0 }, 800)).toBe(0);
  });

  it('reports the covered height when the keyboard shrinks the visual viewport', () => {
    // 800px layout viewport, keyboard leaves 500px visible.
    expect(keyboardInset({ height: 500, offsetTop: 0 }, 800)).toBe(300);
  });

  it('adds offsetTop so iOS panning does not under-report the inset', () => {
    // iOS Safari pans up: height shrinks AND offsetTop grows.
    expect(keyboardInset({ height: 500, offsetTop: 120 }, 800)).toBe(180);
  });

  it('never returns a negative inset (visual viewport larger than layout)', () => {
    expect(keyboardInset({ height: 900, offsetTop: 0 }, 800)).toBe(0);
  });

  it('rounds to whole pixels', () => {
    expect(keyboardInset({ height: 499.4, offsetTop: 0 }, 800)).toBe(301);
  });

  it('ignores non-finite measurements', () => {
    expect(keyboardInset({ height: Number.NaN, offsetTop: 0 }, 800)).toBe(0);
    expect(keyboardInset({ height: 500, offsetTop: 0 }, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
