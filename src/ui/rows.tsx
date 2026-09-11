import type { CSSProperties } from 'react';
import { Avatar } from './avatar';
import type { Hero, MetaRow, Rec } from '../engine/types';
import type { Lang } from '../i18n';
import { TIER_INFO, TIER_RING, type Side } from './theme';

interface SuggestPairProps {
  pickSug: string[];
  banSug: string[];
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  titles: { picks: string; bans: string };
  onPick: (id: string) => void;
  onBan: (id: string) => void;
}

function SuggestCol({
  ids,
  heroes,
  meta,
  lang,
  rate,
  onPick,
}: {
  ids: string[];
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  rate: 'pick_rate' | 'ban_rate';
  onPick: (id: string) => void;
}) {
  const word = rate === 'pick_rate' ? 'pick' : 'ban';
  return (
    <div className="mdc-col8">
      {ids.map((id) => {
        const h = heroes.find((x) => x.id === id);
        if (!h) return null;
        const m = meta.find((x) => x.hero === id);
        return (
          <button
            type="button"
            key={id}
            className="mdc-press mdc-suggest"
            onClick={() => onPick(id)}
            title={m ? `Tier ${m.tier}: ${TIER_INFO[lang][m.tier]}` : ''}
          >
            <Avatar id={id} heroes={heroes} meta={meta} lang={lang} size={28} />
            <span className="mdc-sub">
              {h.name}
              <br />
              <span className="mdc-muted">
                {m ? (
                  <>
                    <span className={`mdc-chip mdc-tier${m.tier}`}>{m.tier}</span> {m[rate]}% {word}
                  </>
                ) : (
                  ''
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SuggestPair(p: SuggestPairProps) {
  return (
    <section className="mdc-card mdc-mt8">
      <div className="mdc-grid2">
        <div>
          <p className="mdc-title">{p.titles.picks}</p>
          <SuggestCol ids={p.pickSug} heroes={p.heroes} meta={p.meta} lang={p.lang} rate="pick_rate" onPick={p.onPick} />
        </div>
        <div>
          <p className="mdc-title mdc-title-red">{p.titles.bans}</p>
          <SuggestCol ids={p.banSug} heroes={p.heroes} meta={p.meta} lang={p.lang} rate="ban_rate" onPick={p.onBan} />
        </div>
      </div>
      <div className="mdc-legend mdc-mt8">
        {(['S', 'A', 'B', 'C', 'D'] as const).map((tr) => {
          // ponytail: dot color dynamic from data — keep CSS var, map to class when palette fixed.
          const dot = { '--dot': TIER_RING[tr] } as CSSProperties;
          return (
            <span key={tr} title={TIER_INFO[p.lang][tr]}>
              <i className="mdc-dot" style={dot} />
              {tr} {TIER_INFO[p.lang][tr]}
            </span>
          );
        })}
      </div>
    </section>
  );
}

interface HeroRowsProps {
  list: Hero[];
  allies: string[];
  enemies: string[];
  ourBans: string[];
  enemyBans: string[];
  max: number;
  scoreMap: Map<string, Rec>;
  metaById: Map<string, MetaRow>;
  openHero: string | null;
  showScore: boolean;
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  labels: { addAlly: string; addEnemy: string; addOurBan: string; addEnemyBan: string };
  onToggle: (id: string) => void;
  onAdd: (side: Side, id: string) => void;
}

export function HeroRows(p: HeroRowsProps) {
  return (
    <section className="mdc-col8" aria-label="hero list">
      {p.list.map((h, i) => {
        const where: Side | null = p.allies.includes(h.id)
          ? 'ally'
          : p.enemies.includes(h.id)
            ? 'enemy'
            : p.ourBans.includes(h.id)
              ? 'ourBan'
              : p.enemyBans.includes(h.id)
                ? 'enemyBan'
                : null;
        const full = (s: Side) =>
          s === 'ally'
            ? p.allies.length >= p.max
            : s === 'enemy'
              ? p.enemies.length >= p.max
              : s === 'ourBan'
                ? p.ourBans.length >= p.max
                : p.enemyBans.length >= p.max;
        const act = (s: Side, label: string) => (
          <button type="button" key={s} onClick={() => p.onAdd(s, h.id)} disabled={where === s || (!where && full(s))} className="mdc-act">
            {label}
            {where === s ? ' ✓' : ''}
          </button>
        );
        const expanded = p.openHero === h.id;
        const rec = p.scoreMap.get(h.id);
        // ponytail: bar width dynamic per score — keep CSS var, switch to attr() when supported.
        const bar = { '--bar': `${Math.round(rec?.score ?? 0)}%` } as CSSProperties;
        const mt = p.metaById.get(h.id)?.tier;
        const m = p.metaById.get(h.id);
        return (
          <div key={h.id} className="mdc-card mdc-rowcard">
            <button type="button" className="mdc-press mdc-rowbtn" onClick={() => p.onToggle(h.id)} aria-expanded={expanded}>
              <Avatar id={h.id} heroes={p.heroes} meta={p.meta} lang={p.lang} size={30} />
              <span className="mdc-uname">
                <b>
                  #{i + 1} {h.name}
                </b>{' '}
                {mt ? (
                  <span className={`mdc-chip mdc-tier${mt}`} title={`Tier ${mt}: ${TIER_INFO[p.lang][mt]}`}>
                    {mt}
                  </span>
                ) : null}{' '}
                <span className="mdc-chip">{h.lane}</span> <span className="mdc-muted">{h.roles.join('/')}</span>
                <br />
                <span className="mdc-muted">{m ? `${m.win_rate}% WR · ${m.pick_rate}% pick` : 'no meta'}</span>
              </span>
              {p.showScore && rec ? <b className="mdc-goldnum mdc-bignum">{rec.score}</b> : null}
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className="mdc-chev">
                <path
                  d={expanded ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4'}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {p.showScore && rec ? (
              <div
                className="mdc-score mdc-mt6"
                role="progressbar"
                aria-valuenow={Math.round(rec.score)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${h.name} score`}
              >
                <i className="mdc-bar" style={bar} />
              </div>
            ) : null}
            {expanded && (
              <>
                {rec && rec.reasons.length > 0 && (
                  <ul className="mdc-reasons">
                    {[...new Set(rec.reasons)].map((x: string) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
                {rec && (
                  <div className="mdc-muted mdc-mt4">
                    counter {Math.round(rec.breakdown.counter)} · meta {Math.round(rec.breakdown.meta)} · comp{' '}
                    {Math.round(rec.breakdown.comp)} · mastery {Math.round(rec.breakdown.mastery)}
                  </div>
                )}
                <div className="mdc-actions">
                  {act('ally', p.labels.addAlly)}
                  {act('enemy', p.labels.addEnemy)}
                  {act('ourBan', p.labels.addOurBan)}
                  {act('enemyBan', p.labels.addEnemyBan)}
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
