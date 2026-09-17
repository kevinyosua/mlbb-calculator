import { useEffect, type RefObject } from 'react';
import { Avatar } from './avatar';
import type { Hero, MetaRow } from '../engine/types';
import type { Lang } from '../i18n';
import type { Side } from './theme';

interface FloatingBoardProps {
  allies: string[];
  enemies: string[];
  ourBans: string[];
  enemyBans: string[];
  max: number;
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  removeWord: string;
  onRemove: (side: Side, id: string) => void;
  /**
   * Ref to the outer <aside>. App uses this to publish the rendered height
   * into a CSS var (`--mdc-fb-h`) so HeroRows can apply `scroll-margin-top`
   * equal to the floating board and stay clear of it when scrolled to top.
   */
  rootRef?: RefObject<HTMLElement | null>;
}

// One row of avatars for a "side" (ally or enemy). Shows picks first, then bans,
// filling remaining slots with dashed placeholders up to `max * 2`.
function MiniLine({
  ids,
  banIds,
  side,
  max,
  heroes,
  meta,
  lang,
  removeWord,
  onRemove,
}: {
  ids: string[];
  banIds: string[];
  side: Side;
  max: number;
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  removeWord: string;
  onRemove: (side: Side, id: string) => void;
}) {
  const banSide: Side = side === 'ally' ? 'ourBan' : 'enemyBan';
  const tone = side === 'ally' ? 'mdc-fb-ally' : 'mdc-fb-enemy';
  // Layout: picks fill the first `max` cells (left), bans fill the last `max`
  // cells (right); empty slots pad whichever side still has room.
  const pickEmpties = Math.max(0, max - ids.length);
  const banEmpties = Math.max(0, max - banIds.length);
  return (
    <div className={`mdc-fb-line ${tone}`}>
      {ids.map((id) => (
        <button
          type="button"
          key={`${side}-${id}`}
          className="mdc-avatarbtn"
          onClick={() => onRemove(side, id)}
          aria-label={`${removeWord} ${heroes.find((x) => x.id === id)?.name ?? id}`}
          title={removeWord}
        >
          <Avatar id={id} heroes={heroes} meta={meta} lang={lang} size={28} />
        </button>
      ))}
      {Array.from({ length: pickEmpties }).map((_, i) => (
        <span key={`${side}-pempty-${i}`} className="mdc-fb-empty" aria-hidden />
      ))}
      <span className="mdc-fb-sep" aria-hidden />
      {banIds.map((id) => (
        <button
          type="button"
          key={`${banSide}-${id}`}
          className="mdc-avatarbtn"
          onClick={() => onRemove(banSide, id)}
          aria-label={`${removeWord} ${heroes.find((x) => x.id === id)?.name ?? id}`}
          title={removeWord}
        >
          <Avatar id={id} heroes={heroes} meta={meta} lang={lang} size={28} bannedMark />
        </button>
      ))}
      {Array.from({ length: banEmpties }).map((_, i) => (
        <span key={`${side}-bempty-${i}`} className="mdc-fb-empty" aria-hidden />
      ))}
    </div>
  );
}

// Floating compact DraftBoard: shown when the real DraftBoard scrolls off-screen.
// Two rows (us / them) of up to (max + maxBan) avatars each. No headings, no chrome.
export function FloatingBoard(p: FloatingBoardProps) {
  // Publish rendered height into --mdc-fb-h so HeroRows can offset scrollIntoView.
  // Only meaningful while mounted; unmount sets var back to 0.
  useEffect(() => {
    const el = p.rootRef?.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty('--mdc-fb-h', `${el.offsetHeight}px`);
    };
    publish();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    if (ro) ro.observe(el);
    return () => {
      ro?.disconnect();
      document.documentElement.style.setProperty('--mdc-fb-h', '0px');
    };
  });
  if (p.allies.length === 0 && p.enemies.length === 0 && p.ourBans.length === 0 && p.enemyBans.length === 0) {
    return null;
  }
  return (
    <aside className="mdc-fb" aria-label="Draft summary" ref={p.rootRef}>
      <MiniLine
        ids={p.allies}
        banIds={p.ourBans}
        side="ally"
        max={p.max}
        heroes={p.heroes}
        meta={p.meta}
        lang={p.lang}
        removeWord={p.removeWord}
        onRemove={p.onRemove}
      />
      <MiniLine
        ids={p.enemies}
        banIds={p.enemyBans}
        side="enemy"
        max={p.max}
        heroes={p.heroes}
        meta={p.meta}
        lang={p.lang}
        removeWord={p.removeWord}
        onRemove={p.onRemove}
      />
    </aside>
  );
}
