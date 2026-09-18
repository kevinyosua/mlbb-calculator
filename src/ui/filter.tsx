import { useEffect, useRef, type RefObject } from 'react';
import type { Lang } from '../i18n';
import { ALL_LANE, ALL_ROLE } from './theme';

interface FilterProps {
  open: boolean;
  q: string;
  lane: string;
  role: string;
  tier: string | null;
  lanes: string[];
  roles: string[];
  dirty: boolean;
  lang: Lang;
  labels: Record<string, string>;
  qRef: RefObject<HTMLInputElement | null>;
  onQ: (v: string) => void;
  onLane: (v: string) => void;
  onRole: (v: string) => void;
  onTier: (tr: string) => void;
  onReset: () => void;
  onOpen: () => void;
  onClose: () => void;
}

export function FilterBar(p: FilterProps) {
  const rootRef = useRef<HTMLElement>(null);
  // Keep scroll padding in sync with the sticky bar height (auto-scroll clears it).
  useEffect(() => {
    const set = () => {
      const h = rootRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty('--mdc-scroll-pad', `${h}px`);
    };
    set();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(set);
    if (ro && rootRef.current) ro.observe(rootRef.current);
    window.addEventListener('resize', set);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', set);
    };
  }, []);
  if (!p.open)
    return (
      <div className="mdc-filter-closed" ref={rootRef as RefObject<HTMLDivElement>}>
        <button
          type="button"
          onClick={p.onOpen}
          aria-expanded={false}
          aria-controls="mdc-filter"
          title={p.labels.filters}
          className="mdc-fabbtn"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>{' '}
          {p.labels.filters}
          {p.dirty ? ` (${p.labels.activeFilter})` : ''}
        </button>
      </div>
    );
  return (
    <section id="mdc-filter" ref={rootRef as RefObject<HTMLElement>} aria-label={p.labels.filters} className="mdc-filterbar">
      <div className="mdc-row mdc-frow">
        <label className="mdc-sr" htmlFor="mdc-q">
          {p.labels.search}
        </label>
        <input
          ref={p.qRef}
          id="mdc-q"
          value={p.q}
          onChange={(e) => p.onQ(e.target.value)}
          placeholder={p.labels.search}
          enterKeyHint="search"
          className="mdc-grow"
        />
        {p.dirty && (
          <button
            type="button"
            className="mdc-iconbtn"
            onClick={() => {
              p.onReset();
              p.qRef.current?.focus();
            }}
            aria-label={p.labels.resetFilter}
            title={p.labels.resetFilter}
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="mdc-iconbtn"
          onClick={p.onClose}
          aria-expanded
          aria-controls="mdc-filter"
          aria-label={p.labels.hideFilter}
          title={p.labels.hideFilter}
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="mdc-row mdc-frow">
        <label className="mdc-sr" htmlFor="mdc-lane">
          Lane
        </label>
        <select id="mdc-lane" value={p.lane} onChange={(e) => p.onLane(e.target.value)} aria-label="Lane" className="mdc-grow">
          {p.lanes.map((r) => (
            <option key={r} value={r}>
              {r === ALL_LANE ? 'Lane' : r}
            </option>
          ))}
        </select>
        <label className="mdc-sr" htmlFor="mdc-role">
          Role
        </label>
        <select id="mdc-role" value={p.role} onChange={(e) => p.onRole(e.target.value)} aria-label="Role" className="mdc-grow">
          {p.roles.map((r) => (
            <option key={r} value={r}>
              {r === ALL_ROLE ? 'Role' : r}
            </option>
          ))}
        </select>
        <label className="mdc-sr" htmlFor="mdc-tier">
          Tier
        </label>
        <select
          id="mdc-tier"
          value={p.tier ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              if (p.tier) p.onTier(p.tier);
            } else p.onTier(v);
          }}
          aria-label="Tier"
          className={`mdc-grow${p.tier ? ` mdc-tier${p.tier}` : ''}`}
        >
          <option value="">Tier</option>
          {(['S', 'A', 'B', 'C', 'D'] as const).map((tr) => (
            <option key={tr} value={tr}>
              {`Tier ${tr}`}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
