import { useState, type CSSProperties } from 'react';
import type { Hero, MetaRow } from '../engine/types';
import type { Lang } from '../i18n';
import { ROLE_COLORS, TIER_INFO, TIER_RING } from './theme';

interface AvatarProps {
  id: string;
  heroes: Hero[];
  meta: MetaRow[];
  lang: Lang;
  size?: number;
  bannedMark?: boolean;
}

export function Avatar({ id, heroes, meta, lang, size = 36, bannedMark = false }: AvatarProps) {
  const [fail, setFail] = useState(false);
  const h = heroes.find((x) => x.id === id);
  if (!h) return null;
  const c = ROLE_COLORS[h.roles[0]] ?? '#888';
  const tier = meta.find((m) => m.hero === id)?.tier;
  const tinfo = tier ? TIER_INFO[lang][tier] : undefined;
  // ponytail: ring/size stay as CSS vars (few dynamic values) — full class map when palette stabilizes.
  const vars = {
    '--av-size': `${size}px`,
    '--av-fs': `${Math.round(size * 0.4)}px`,
    '--av-bg': c,
    '--av-ring': tier ? `2px solid ${TIER_RING[tier] ?? '#2a3552'}` : '2px solid #2a3552',
  } as CSSProperties;
  const face =
    h.icon && !fail ? (
      <img src={h.icon} alt="" width={size} height={size} loading="lazy" className="mdc-avatar-img" onError={() => setFail(true)} />
    ) : (
      h.name.slice(0, 1)
    );
  const label = tinfo ? `${h.name} — Tier ${tier}: ${tinfo}` : h.name;
  if (!bannedMark)
    return (
      <span title={label} className="mdc-avatar" style={vars}>
        {face}
      </span>
    );
  return (
    <span title={label} className="mdc-banwrap">
      <span className="mdc-avatar mdc-avatar-dim" style={vars}>
        {face}
      </span>
      <span className="mdc-banline" />
    </span>
  );
}
