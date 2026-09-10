import { useCallback, useMemo, useState } from 'react';
import { loadAll, type GameData } from './data/load';
import { recommend } from './engine/recommend';
import { STR, type Lang } from './i18n';

const ROLE_COLORS: Record<string, string> = {
  Tank: '#3b82f6',
  Fighter: '#f97316',
  Assassin: '#a855f7',
  Mage: '#22d3ee',
  Marksman: '#ef4444',
  Support: '#22c55e',
};

let data: GameData;
try {
  data = loadAll();
} catch (e) {
  console.error('loadAll failed', e);
  data = { heroes: [], counters: [], syn: [], meta: [], patches: [], weights: { counter: 0.5, meta: 0.3, comp: 0.15, mastery: 0.05 } };
}

const MAX_LINE = 5;
// Slot placeholders rendered for empty draft slots. Used as list keys so they stay
// content-derived rather than index-derived.
const SLOTS = Array.from({ length: MAX_LINE }, (_, i) => i + 1);

export default function App() {
  const [lang, setLang] = useState<Lang>('id');
  const [allies, setAllies] = useState<string[]>([]);
  const [enemies, setEnemies] = useState<string[]>([]);
  const [ourBans, setOurBans] = useState<string[]>([]);
  const [enemyBans, setEnemyBans] = useState<string[]>([]);
  const bans = useMemo(() => [...ourBans, ...enemyBans], [ourBans, enemyBans]);

  const [q, setQ] = useState('');
  const ALL_LANE = 'All Lane';
  const ALL_ROLE = 'All Role';
  const [lane, setLane] = useState(ALL_LANE);
  const [role, setRole] = useState(ALL_ROLE);
  const [tier, setTier] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [openHero, setOpenHero] = useState<string | null>(null);
  const t = STR[lang];

  const lanes = [ALL_LANE, ...new Set(data.heroes.map((h) => h.lane))];
  const roles = [ALL_ROLE, ...new Set(data.heroes.flatMap((h) => h.roles))];
  // Search list: heroes already placed on any line (ally/enemy/ban) are hidden.
  const picked = new Set([...allies, ...enemies, ...bans]);
  const list = data.heroes.filter(
    (h) =>
      !picked.has(h.id) &&
      h.name.toLowerCase().includes(q.toLowerCase()) &&
      (lane === ALL_LANE || h.lane === lane) &&
      (role === ALL_ROLE || h.roles.includes(role as never)) &&
      (!tier || data.meta.find((m) => m.hero === h.id)?.tier === tier),
  );
  const dirty = q !== '' || lane !== ALL_LANE || role !== ALL_ROLE || tier !== null;
  const recs = useMemo(() => {
    try {
      if (enemies.length === 0 || data.heroes.length === 0) return [];
      return recommend({
        allies,
        enemies,
        bans,
        pool: data.heroes,
        counters: data.counters,
        syn: data.syn,
        meta: data.meta,
        patches: data.patches,
        weights: data.weights,
      });
    } catch (e) {
      console.error('recommend failed', e);
      return [];
    }
  }, [allies, enemies, bans]);
  // Exclusive pick: a hero lives on exactly one line (ally/enemy/ourBan/enemyBan).
  const clearOthers = (id: string, keep: string) => {
    if (keep !== 'ally') setAllies((v) => v.filter((x) => x !== id));
    if (keep !== 'enemy') setEnemies((v) => v.filter((x) => x !== id));
    if (keep !== 'ourBan') setOurBans((v) => v.filter((x) => x !== id));
    if (keep !== 'enemyBan') setEnemyBans((v) => v.filter((x) => x !== id));
  };
  const addSide = (side: 'ally' | 'enemy' | 'ourBan' | 'enemyBan', id: string) => {
    if (side === 'ally') {
      if (allies.length >= MAX_LINE && !allies.includes(id)) return;
      clearOthers(id, 'ally');
      if (!allies.includes(id)) setAllies([...allies, id]);
    } else if (side === 'enemy') {
      if (enemies.length >= MAX_LINE && !enemies.includes(id)) return;
      clearOthers(id, 'enemy');
      if (!enemies.includes(id)) setEnemies([...enemies, id]);
    } else if (side === 'ourBan') {
      if (ourBans.length >= MAX_LINE && !ourBans.includes(id)) return;
      clearOthers(id, 'ourBan');
      if (!ourBans.includes(id)) setOurBans([...ourBans, id]);
    } else {
      if (enemyBans.length >= MAX_LINE && !enemyBans.includes(id)) return;
      clearOthers(id, 'enemyBan');
      if (!enemyBans.includes(id)) setEnemyBans([...enemyBans, id]);
    }
  };
  const removeSide = (side: 'ally' | 'enemy' | 'ourBan' | 'enemyBan', id: string) => {
    if (side === 'ally') setAllies(allies.filter((x) => x !== id));
    else if (side === 'enemy') setEnemies(enemies.filter((x) => x !== id));
    else if (side === 'ourBan') setOurBans(ourBans.filter((x) => x !== id));
    else setEnemyBans(enemyBans.filter((x) => x !== id));
  };
  // Anti-synergy warnings between allies (reads synergies.json only).
  const allyWarnings = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < allies.length; i++)
      for (let j = i + 1; j < allies.length; j++) {
        const hit = data.syn.find(
          (x) =>
            x.type === 'ANTI_SYNERGY' &&
            ((x.source === allies[i] && x.target === allies[j]) || (x.source === allies[j] && x.target === allies[i])),
        );
        if (hit) out.push(`${t.antiSyn}: ${hit.reason}`);
      }
    return [...new Set(out)];
  }, [allies, t.antiSyn]);
  // Weakness: lanes and roles still missing from the ally team.
  const weakness = useMemo(() => {
    const out: string[] = [];
    const allyH = data.heroes.filter((h) => allies.includes(h.id));
    for (const l of ['Exp', 'Jungle', 'Mid', 'Gold', 'Roam']) {
      if (!allyH.some((h) => h.lane === l)) out.push(`${t.missing} ${l}`);
    }
    if (!allyH.some((h) => h.roles.includes('Tank') || h.tags.includes('Frontline'))) out.push(t.noFrontline);
    if (!allyH.some((h) => h.roles.includes('Marksman') || h.roles.includes('Mage') || h.roles.includes('Assassin'))) out.push(t.noDamage);
    return [...new Set(out)];
  }, [allies, t.noFrontline, t.noDamage, t.missing]);
  // Suggestions follow the draft. Empty draft -> highest tier + ban rate.
  const metaFallback = useCallback((exclude: string[]) => {
    const out = new Set(exclude);
    return [...data.heroes]
      .filter((h) => !out.has(h.id))
      .sort((a, b) => {
        const ma = data.meta.find((m) => m.hero === a.id);
        const mb = data.meta.find((m) => m.hero === b.id);
        return (mb?.tier_score ?? 0) * 10 + (mb?.ban_rate ?? 0) - ((ma?.tier_score ?? 0) * 10 + (ma?.ban_rate ?? 0));
      })
      .slice(0, 3)
      .map((h) => h.id);
  }, []);
  const banSug = useMemo(() => {
    if (allies.length === 0 && enemies.length === 0) return metaFallback([...allies, ...enemies, ...bans]);
    const r = recommend({
      allies: enemies,
      enemies: allies,
      bans: [...allies, ...enemies, ...bans],
      pool: data.heroes,
      counters: data.counters,
      syn: data.syn,
      meta: data.meta,
      patches: data.patches,
      weights: data.weights,
      limit: 10,
    });
    return [...r]
      .sort((a, b) => {
        const ba = data.meta.find((m) => m.hero === a.hero)?.ban_rate ?? 0;
        const bb = data.meta.find((m) => m.hero === b.hero)?.ban_rate ?? 0;
        return b.score + bb - (a.score + ba);
      })
      .slice(0, 3)
      .map((x) => x.hero);
  }, [allies, enemies, bans, metaFallback]);
  const pickSug = useMemo(() => {
    if (enemies.length === 0) return metaFallback([...allies, ...enemies, ...bans]);
    return recs.slice(0, 3).map((x) => x.hero);
  }, [recs, allies, enemies, bans, metaFallback]);

  const [imgOk, setImgOk] = useState<Record<string, boolean>>({});
  // Tier colours: S gold (OP/ban), A green (strong), B blue (situational), C grey (weak), D red (avoid).
  const TIER_RING: Record<string, string> = { S: '#fbbf24', A: '#22c55e', B: '#3b82f6', C: '#aab4c8', D: '#ef4444' };
  // Tier ring colours (this patch's distribution: S 12 · A 21 · B 41 · C 39 · D 20).
  const TIER_INFO: Record<Lang, Record<string, string>> = {
    id: {
      S: 'OP — prioritas pick/ban',
      A: 'Kuat — pick aman',
      B: 'Situasional — ikut komposisi',
      C: 'Lemah — hindari kecuali counter',
      D: 'Jangan pick',
    },
    en: {
      S: 'OP — priority pick/ban',
      A: 'Strong — safe pick',
      B: 'Situational — comp-dependent',
      C: 'Weak — avoid unless counter',
      D: 'Do not pick',
    },
  };
  const avatar = (id: string, size = 36, bannedMark = false) => {
    const h = data.heroes.find((x) => x.id === id);
    if (!h) return null;
    const c = ROLE_COLORS[h.roles[0]] ?? '#888';
    const tier = data.meta.find((m) => m.hero === id)?.tier;
    const tinfo = tier ? TIER_INFO[lang][tier] : undefined;
    const ring = tier ? `2px solid ${TIER_RING[tier] ?? '#2a3552'}` : '2px solid #2a3552';
    const circle: React.CSSProperties = {
      width: size,
      height: size,
      borderRadius: '50%',
      background: c,
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: size * 0.4,
      overflow: 'hidden',
      flexShrink: 0,
      border: ring,
    };
    const face =
      h.icon && imgOk[id] !== false ? (
        <img
          src={h.icon}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          style={{ objectFit: 'cover' }}
          onError={() => setImgOk((m) => ({ ...m, [id]: false }))}
        />
      ) : (
        h.name.slice(0, 1)
      );
    const label = tinfo ? `${h.name} — Tier ${tier}: ${tinfo}` : h.name;
    if (!bannedMark)
      return (
        <span title={label} style={circle}>
          {face}
        </span>
      );
    return (
      <span title={label} style={{ position: 'relative', display: 'inline-flex' }}>
        <span style={{ ...circle, opacity: 0.55 }}>{face}</span>
        <span
          style={{ position: 'absolute', left: -2, right: -2, top: '50%', height: 2, background: '#ef4444', transform: 'rotate(-20deg)' }}
        />
      </span>
    );
  };

  return (
    <div
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100svh',
        maxWidth: 640,
        margin: '0 auto',
        padding: '12px 12px calc(16px + env(safe-area-inset-bottom))',
        fontFamily: 'system-ui',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1
          className="mdc-goldnum"
          style={{ fontSize: 19, margin: 0, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          {t.title}
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="mdc-muted">
            {t.patch} {data.heroes[0]?.patch}
          </span>
          <button
            type="button"
            onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
            aria-label={lang === 'id' ? 'Ganti ke English' : 'Switch to Indonesian'}
            title={lang === 'id' ? 'Ganti ke English' : 'Switch to Indonesian'}
          >
            {lang.toUpperCase()}
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <section className="mdc-card mdc-side-blue" aria-label={t.allies}>
          <h2 style={{ fontSize: 13, margin: '0 0 6px' }}>
            {t.allies} ({allies.length}/{MAX_LINE})
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 44 }}>
            {allies.map((id) => (
              <button
                type="button"
                key={id}
                className="mdc-avatarbtn"
                onClick={() => removeSide('ally', id)}
                aria-label={`${t.remove} ${data.heroes.find((x) => x.id === id)?.name}`}
                title={t.remove}
              >
                {avatar(id)}
              </button>
            ))}
            {SLOTS.slice(allies.length).map((n) => (
              <span key={n} className="mdc-slot" aria-hidden>
                {n}
              </span>
            ))}
          </div>
        </section>
        <section className="mdc-card mdc-side-red" aria-label={t.enemies}>
          <h2 style={{ fontSize: 13, margin: '0 0 6px' }}>
            {t.enemies} ({enemies.length}/{MAX_LINE})
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 44 }}>
            {enemies.map((id) => (
              <button
                type="button"
                key={id}
                className="mdc-avatarbtn"
                onClick={() => removeSide('enemy', id)}
                aria-label={`${t.remove} ${data.heroes.find((x) => x.id === id)?.name}`}
                title={t.remove}
              >
                {avatar(id)}
              </button>
            ))}
            {SLOTS.slice(enemies.length).map((n) => (
              <span key={n} className="mdc-slot" aria-hidden>
                {n}
              </span>
            ))}
          </div>
        </section>
        <section className="mdc-card mdc-side-blue" aria-label={t.ourBans}>
          <h2 style={{ fontSize: 13, margin: '0 0 6px' }}>
            {t.ourBans} ({ourBans.length}/{MAX_LINE})
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 44 }}>
            {ourBans.map((id) => (
              <button
                type="button"
                key={id}
                className="mdc-avatarbtn"
                onClick={() => removeSide('ourBan', id)}
                aria-label={`${t.remove} ${data.heroes.find((x) => x.id === id)?.name}`}
                title={t.remove}
              >
                {avatar(id, 36, true)}
              </button>
            ))}
            {SLOTS.slice(ourBans.length).map((n) => (
              <span key={n} className="mdc-slot" aria-hidden>
                ✕
              </span>
            ))}
          </div>
        </section>
        <section className="mdc-card mdc-side-red" aria-label={t.enemyBans}>
          <h2 style={{ fontSize: 13, margin: '0 0 6px' }}>
            {t.enemyBans} ({enemyBans.length}/{MAX_LINE})
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 44 }}>
            {enemyBans.map((id) => (
              <button
                type="button"
                key={id}
                className="mdc-avatarbtn"
                onClick={() => removeSide('enemyBan', id)}
                aria-label={`${t.remove} ${data.heroes.find((x) => x.id === id)?.name}`}
                title={t.remove}
              >
                {avatar(id, 36, true)}
              </button>
            ))}
            {SLOTS.slice(enemyBans.length).map((n) => (
              <span key={n} className="mdc-slot" aria-hidden>
                ✕
              </span>
            ))}
          </div>
        </section>
      </div>
      <section className="mdc-card" style={{ marginTop: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <p className="mdc-title">{t.suggestPicks}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pickSug.map((id) => {
                const h = data.heroes.find((x) => x.id === id);
                if (!h) return null;
                const m = data.meta.find((x) => x.hero === id);
                return (
                  <button
                    type="button"
                    key={id}
                    className="mdc-press"
                    onClick={() => addSide('ally', id)}
                    title={m ? `Tier ${m.tier}: ${TIER_INFO[lang][m.tier]}` : ''}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--card2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 6,
                      textAlign: 'left',
                    }}
                  >
                    {avatar(id, 28)}
                    <span style={{ flex: 1, fontSize: 13 }}>
                      {h.name}
                      <br />
                      <span className="mdc-muted">
                        {m ? (
                          <>
                            <span className={`mdc-chip mdc-tier${m.tier}`}>{m.tier}</span> {m.ban_rate}% ban
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
          </div>
          <div>
            <p className="mdc-title" style={{ color: 'var(--red)' }}>
              {t.suggestBans}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {banSug.map((id) => {
                const h = data.heroes.find((x) => x.id === id);
                if (!h) return null;
                const m = data.meta.find((x) => x.hero === id);
                return (
                  <button
                    type="button"
                    key={id}
                    className="mdc-press"
                    onClick={() => addSide('ourBan', id)}
                    title={m ? `Tier ${m.tier}: ${TIER_INFO[lang][m.tier]}` : ''}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--card2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 6,
                      textAlign: 'left',
                    }}
                  >
                    {avatar(id, 28)}
                    <span style={{ flex: 1, fontSize: 13 }}>
                      {h.name}
                      <br />
                      <span className="mdc-muted">
                        {m ? (
                          <>
                            <span className={`mdc-chip mdc-tier${m.tier}`}>{m.tier}</span> {m.ban_rate}% ban
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
          </div>
        </div>
        <div className="mdc-legend" style={{ marginTop: 8 }}>
          {(['S', 'A', 'B', 'C', 'D'] as const).map((tr) => (
            <span key={tr} title={TIER_INFO[lang][tr]}>
              <i style={{ background: TIER_RING[tr] }} />
              {tr} {TIER_INFO[lang][tr]}
            </span>
          ))}
        </div>
      </section>
      {(allyWarnings.length > 0 || (allies.length > 0 && weakness.length > 0)) && (
        <section className="mdc-card" style={{ marginTop: 8, fontSize: 13 }} role="status">
          {allyWarnings.length > 0 && (
            <>
              <b style={{ color: 'var(--gold)' }}>{t.warnings}</b>
              <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                {allyWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
          {allies.length > 0 && (
            <>
              <b style={{ color: 'var(--gold)' }}>{t.weakness}</b>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {weakness.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }} aria-label={t.search}>
        <label style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} htmlFor="mdc-q">
          {t.search}
        </label>
        <input id="mdc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} style={{ flex: '1 1 140px' }} />
        <label style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} htmlFor="mdc-lane">
          Lane
        </label>
        <select id="mdc-lane" value={lane} onChange={(e) => setLane(e.target.value)} aria-label="Lane">
          {lanes.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <label style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} htmlFor="mdc-role">
          Role
        </label>
        <select id="mdc-role" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </section>

      <fieldset
        style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 8px', overflowX: 'auto', border: 0, padding: 0 }}
        aria-label="Tier filter"
      >
        {(['S', 'A', 'B', 'C', 'D'] as const).map((tr) => (
          <button
            type="button"
            key={tr}
            onClick={() => setTier(tier === tr ? null : tr)}
            aria-pressed={tier === tr}
            title={TIER_INFO[lang][tr]}
            className={`mdc-chip mdc-tier${tr}`}
            style={{
              minHeight: 44,
              padding: '6px 14px',
              fontSize: 13,
              background: tier === tr ? '#1a2340' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {tr}
          </button>
        ))}
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setLane(ALL_LANE);
              setRole(ALL_ROLE);
              setTier(null);
            }}
            style={{ minHeight: 44, flexShrink: 0 }}
          >
            ✕
          </button>
        )}
      </fieldset>
      <p className="mdc-muted" style={{ margin: '0 0 6px' }}>
        {list.length} hero{list.length === 0 ? ` — ${lang === 'id' ? 'tidak ada hasil, ubah filter' : 'no results, adjust filters'}` : ''}
      </p>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="hero list">
        {list.map((h) => {
          const where = allies.includes(h.id)
            ? 'ally'
            : enemies.includes(h.id)
              ? 'enemy'
              : ourBans.includes(h.id)
                ? 'ourBan'
                : enemyBans.includes(h.id)
                  ? 'enemyBan'
                  : null;
          const full = (s: string) =>
            s === 'ally'
              ? allies.length >= MAX_LINE
              : s === 'enemy'
                ? enemies.length >= MAX_LINE
                : s === 'ourBan'
                  ? ourBans.length >= MAX_LINE
                  : enemyBans.length >= MAX_LINE;
          const act = (s: 'ally' | 'enemy' | 'ourBan' | 'enemyBan', label: string) => (
            <button
              type="button"
              key={s}
              onClick={() => {
                addSide(s, h.id);
                setOpenHero(null);
              }}
              disabled={where === s || (!where && full(s))}
              style={{ flex: '1 1 100px' }}
            >
              {label}
              {where === s ? ' ✓' : ''}
            </button>
          );
          const expanded = openHero === h.id;
          return (
            <div key={h.id} className="mdc-card" style={{ padding: 6 }}>
              <button
                type="button"
                className="mdc-press"
                onClick={() => setOpenHero(expanded ? null : h.id)}
                aria-expanded={expanded}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: 2,
                  textAlign: 'left',
                }}
              >
                {avatar(h.id, 30)}
                <span style={{ flex: 1, fontSize: 14 }}>
                  {h.name} {(() => {
                    const mt = data.meta.find((m) => m.hero === h.id)?.tier;
                    return mt ? (
                      <span className={`mdc-chip mdc-tier${mt}`} title={`Tier ${mt}: ${TIER_INFO[lang][mt]}`}>
                        {mt}
                      </span>
                    ) : null;
                  })()} <span className="mdc-chip">{h.lane}</span> <span className="mdc-muted">{h.roles.join('/')}</span>
                </span>
                <span aria-hidden style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {expanded ? '▲' : '▼'}
                </span>
              </button>
              {expanded && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {act('ally', t.addAlly)}
                  {act('enemy', t.addEnemy)}
                  {act('ourBan', t.addOurBan)}
                  {act('enemyBan', t.addEnemyBan)}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section
        style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '8px 0 calc(8px + env(safe-area-inset-bottom))' }}
        aria-label={t.results}
      >
        <h2 style={{ fontSize: 14, color: 'var(--gold)', margin: '0 0 6px' }}>{t.results}</h2>
        {enemies.length === 0 && <p style={{ fontSize: 13 }}>{t.needEnemy}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50svh', overflowY: 'auto' }}>
          {recs.map((r, i) => {
            const h = data.heroes.find((x) => x.id === r.hero);
            if (!h) return null;
            const inAlly = allies.includes(r.hero);
            const allyFull = allies.length >= MAX_LINE;
            return (
              <div key={r.hero} className="mdc-card">
                <button
                  type="button"
                  className="mdc-press"
                  onClick={() => setOpen(open === r.hero ? null : r.hero)}
                  aria-expanded={open === r.hero}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                  }}
                >
                  {avatar(r.hero, 32)}
                  <span style={{ flex: 1 }}>
                    <b>
                      #{i + 1} {h.name}
                    </b>
                    <br />
                    <span className="mdc-muted">
                      {(() => {
                        const m = data.meta.find((x) => x.hero === r.hero);
                        return m ? (
                          <>
                            <span className={`mdc-chip mdc-tier${m.tier}`} title={`Tier ${m.tier}: ${TIER_INFO[lang][m.tier]}`}>
                              {m.tier}
                            </span>{' '}
                            {m.win_rate}% WR
                          </>
                        ) : (
                          'no meta'
                        );
                      })()}
                    </span>
                  </span>
                  <b className="mdc-goldnum" style={{ fontSize: 20 }}>
                    {r.score}
                  </b>
                </button>
                <div
                  className="mdc-score"
                  role="progressbar"
                  aria-valuenow={Math.round(r.score)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${h.name} score`}
                >
                  <i style={{ width: `${Math.round(r.score)}%` }} />
                </div>
                <ul style={{ fontSize: 13, margin: '6px 0 0', paddingLeft: 18 }}>
                  {[...new Set(r.reasons)].map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => addSide('ally', r.hero)}
                  disabled={inAlly || allyFull}
                  style={{ width: '100%', marginTop: 6 }}
                >
                  {inAlly ? `${t.addAlly} ✓` : allyFull ? t.full : t.addAlly}
                </button>
                {open === r.hero && (
                  <div className="mdc-muted" style={{ marginTop: 4 }}>
                    counter {Math.round(r.breakdown.counter)} · meta {Math.round(r.breakdown.meta)} · comp {Math.round(r.breakdown.comp)} ·
                    mastery {Math.round(r.breakdown.mastery)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
