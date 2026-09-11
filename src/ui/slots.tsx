import { Avatar } from './avatar';
import type { Hero, MetaRow } from '../engine/types';
import type { Lang } from '../i18n';
import { SLOTS, type Side } from './theme';

interface SlotsProps {
  title: string;
  ids: string[];
  side: Side;
  max: number;
  emptyMark: string | number;
  banned?: boolean;
  removeWord: string;
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  onRemove: (side: Side, id: string) => void;
}

function DraftSlots({ title, ids, side, max, emptyMark, banned, removeWord, heroes, meta, lang, onRemove }: SlotsProps) {
  const tone = side === 'ally' || side === 'ourBan' ? 'mdc-side-blue' : 'mdc-side-red';
  return (
    <section className={`mdc-card ${tone}`} aria-label={title}>
      <h2 className="mdc-sec-h">
        {title} ({ids.length}/{max})
      </h2>
      <div className="mdc-wrap44">
        {ids.map((id) => (
          <button
            type="button"
            key={id}
            className="mdc-avatarbtn"
            onClick={() => onRemove(side, id)}
            aria-label={`${removeWord} ${heroes.find((x) => x.id === id)?.name}`}
            title={removeWord}
          >
            <Avatar id={id} heroes={heroes} meta={meta} lang={lang} bannedMark={banned} />
          </button>
        ))}
        {SLOTS.slice(ids.length).map((n) => (
          <span key={n} className="mdc-slot" aria-hidden>
            {typeof emptyMark === 'number' ? n : emptyMark}
          </span>
        ))}
      </div>
    </section>
  );
}

interface BoardProps {
  allies: string[];
  enemies: string[];
  ourBans: string[];
  enemyBans: string[];
  max: number;
  titles: { allies: string; enemies: string; ourBans: string; enemyBans: string };
  removeWord: string;
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  onRemove: (side: Side, id: string) => void;
}

export function DraftBoard(p: BoardProps) {
  return (
    <div className="mdc-grid2">
      <DraftSlots
        title={p.titles.allies}
        ids={p.allies}
        side="ally"
        max={p.max}
        emptyMark={0}
        removeWord={p.removeWord}
        heroes={p.heroes}
        meta={p.meta}
        lang={p.lang}
        onRemove={p.onRemove}
      />
      <DraftSlots
        title={p.titles.enemies}
        ids={p.enemies}
        side="enemy"
        max={p.max}
        emptyMark={0}
        removeWord={p.removeWord}
        heroes={p.heroes}
        meta={p.meta}
        lang={p.lang}
        onRemove={p.onRemove}
      />
      <DraftSlots
        title={p.titles.ourBans}
        ids={p.ourBans}
        side="ourBan"
        max={p.max}
        emptyMark="✕"
        banned
        removeWord={p.removeWord}
        heroes={p.heroes}
        meta={p.meta}
        lang={p.lang}
        onRemove={p.onRemove}
      />
      <DraftSlots
        title={p.titles.enemyBans}
        ids={p.enemyBans}
        side="enemyBan"
        max={p.max}
        emptyMark="✕"
        banned
        removeWord={p.removeWord}
        heroes={p.heroes}
        meta={p.meta}
        lang={p.lang}
        onRemove={p.onRemove}
      />
    </div>
  );
}
