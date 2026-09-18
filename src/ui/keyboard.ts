import { useEffect } from 'react';

/**
 * Height (px) the virtual keyboard currently covers at the bottom of the
 * *layout* viewport. Derived from `visualViewport`, which shrinks when the
 * keyboard opens even on iOS Safari where the layout viewport does not.
 *
 * `offsetTop` must be added: iOS Safari pans the visual viewport upward when
 * focusing a field near the bottom (offsetTop > 0), so `height` alone
 * under-reports the covered region.
 */
export function keyboardInset(vv: { height: number; offsetTop: number } | null, layoutHeight: number): number {
  if (!vv) return 0;
  if (!Number.isFinite(vv.height) || !Number.isFinite(layoutHeight)) return 0;
  // Nothing is covering the viewport unless it actually shrank. This keeps a
  // stray pan offset from lifting the bar when the keyboard is closed.
  if (vv.height >= layoutHeight) return 0;
  return Math.max(0, Math.round(layoutHeight - (vv.height + vv.offsetTop)));
}

/**
 * Publishes the keyboard inset into `--mdc-kb` on <html> so sticky bottom
 * chrome (filter bar) can sit above the keyboard instead of behind it.
 *
 * Chrome Android with `interactive-widget=resizes-content` shrinks the layout
 * viewport itself, so the inset resolves to 0 and the var is inert there —
 * the plain `bottom` sticky already clears the keyboard.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let prev = -1;
    const update = () => {
      const px = keyboardInset(vv, window.innerHeight);
      // visualViewport 'scroll' fires per frame; skip no-op writes.
      if (px === prev) return;
      prev = px;
      root.style.setProperty('--mdc-kb', `${px}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
      root.style.removeProperty('--mdc-kb');
    };
  }, []);
}
