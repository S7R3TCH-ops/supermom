import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppTheme } from '../context/AppThemeContext';
import { useNewClientSheet } from '../context/NewClientSheetContext';
import AmtCell from '../components/ui/AmtCell';
import { useClients } from '../data/useData';
import { EmptyClients, NoResults } from '../components/ui/Illustrations';

const filters = ['All', 'Owes $', 'VIP', 'Active', 'Leads'];

const ClientCard = memo(function ClientCard({ c, T, onPress }) {
  return (
    <div
      onClick={() => onPress(c.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPress(c.id); }}
      style={{
        background: T.card, border: `1.5px solid ${c.owed ? 'rgba(233,30,106,0.35)' : T.cardBorder}`,
        borderRadius: 13, padding: '10px 12px', marginBottom: 7, cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: `${c.color}22`, border: `1.5px solid ${c.color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: c.color,
        }}>{c.init}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, letterSpacing: '-0.2px', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
            {c.vip && <span style={{ background: '#FCD34D', borderRadius: 4, padding: '1px 5px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: '#78350F', whiteSpace: 'nowrap' }}>VIP ★</span>}
          </div>
          <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginBottom: 4 }}>
            {c.service !== '—' ? `${c.service} · Last: ${c.last}` : 'No jobs yet'}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {c.tags.map(tag => {
              const isOverdue = tag.toLowerCase().includes('overdue');
              const isLead = tag === 'Lead';
              return (
                <span key={tag} style={{
                  background: isOverdue ? '#FEF3C7' : isLead ? '#F3F0FF' : T.pinkTint,
                  border: `1px solid ${isOverdue ? '#F59E0B40' : isLead ? '#7C3AED30' : T.cardBorder}`,
                  borderRadius: 4, padding: '2px 6px',
                  fontFamily: T.font, fontSize: 8.5, fontWeight: 700,
                  color: isOverdue ? '#78350F' : isLead ? '#5B21B6' : T.inkMuted,
                  letterSpacing: '0.3px', textTransform: 'uppercase',
                }}>{tag}</span>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          {c.owed && c.amt && <AmtCell amount={c.amt} size={13} />}
          {c.next !== '—' && (
            <div style={{ fontFamily: T.font, fontSize: 9, color: T.inkMuted, textAlign: 'right' }}>Next: {c.next}</div>
          )}
          {c.tags.includes('Lead') && (
            <button
              onClick={(e) => { e.stopPropagation(); onPress(c.id); }}
              style={{ background: T.pink, color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontFamily: T.font, fontSize: 9, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Book</button>
          )}
        </div>
      </div>
    </div>
  );
});

export default function Clients() {
  const { T, mode, privacyOn } = useAppTheme();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const { open } = useNewClientSheet();
  const navigate = useNavigate();
  const { clients, loading, error, refresh } = useClients();
  const handleClientPress = useCallback((id) => navigate(`/clients/${id}`), [navigate]);

  const filtered = useMemo(() => clients.filter(c => {
    // Search filter
    if (search) {
      const s = search.toLowerCase();
      const match = c.name.toLowerCase().includes(s) || c.address.toLowerCase().includes(s);
      if (!match) return false;
    }

    // Category filter
    if (filter === 'Owes $') return c.owed;
    if (filter === 'VIP') return c.vip;
    if (filter === 'Active') return c.last !== '—';
    if (filter === 'Leads') return c.tags.includes('Lead');
    return true;
  }), [clients, filter, search]);

  const totalOwed = clients.reduce((s, c) => s + (c.owed ? Number((c.amt || '$0').replace(/[^0-9.]/g, '')) : 0), 0);
  const vipCount = clients.filter(c => c.vip).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      {/* Hero */}
      <div style={{ 
        background: T.hero, 
        borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none', 
        padding: '12px 14px 14px', 
        position: 'relative', 
        overflow: 'hidden', 
        flexShrink: 0 
      }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 130, height: 130, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 5 }}>✦ Client Roster</div>
            <div style={{ fontFamily: T.serif, fontSize: 21, fontWeight: 500, letterSpacing: '-0.4px', color: mode === 'dark' ? 'white' : T.ink, marginBottom: 10 }}>Your people.</div>
          </div>
          <button
            onClick={() => open(() => refresh())}
            aria-label="Add client"
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: T.pink, color: 'white', border: 'none',
              fontFamily: T.font, fontSize: 22, fontWeight: 400, lineHeight: 1,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(233,30,106,0.35)',
            }}
          >+</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[
            { n: String(clients.length), l: 'Total' },
            { n: privacyOn ? '•••' : `$${totalOwed.toFixed(0)}`, l: 'Outstanding' },
            { n: String(vipCount), l: 'VIP' },
          ].map(s => (
            <div key={s.l} style={{ 
              background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.4)', 
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)'}`, 
              borderRadius: 9, padding: '7px 5px', textAlign: 'center' 
            }}>
              <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: mode === 'dark' ? 'white' : T.ink, letterSpacing: '-0.3px' }}>{s.n}</div>
              <div style={{ fontFamily: T.font, fontSize: 8, fontWeight: 600, color: mode === 'dark' ? 'rgba(255,255,255,0.38)' : T.inkMuted, letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ 
          background: mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.5)', 
          border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`, 
          borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4.5" stroke={mode === 'dark' ? 'rgba(255,255,255,0.4)' : T.inkMuted} strokeWidth="1.4" />
            <path d="M9 9l3 3" stroke={mode === 'dark' ? 'rgba(255,255,255,0.4)' : T.inkMuted} strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              fontFamily: T.font, fontSize: 11.5, color: mode === 'dark' ? 'white' : T.ink,
              outline: 'none', padding: 0,
            }}
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="sm-scroll" style={{ display: 'flex', gap: 6, padding: '10px 13px 6px', overflowX: 'auto', flexShrink: 0, background: T.bg }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} style={{
            background: filter === f ? '#E91E6A' : T.card,
            border: `1px solid ${filter === f ? '#E91E6A' : T.cardBorder}`,
            borderRadius: 20, padding: '5px 12px', whiteSpace: 'nowrap',
            fontFamily: T.font, fontSize: 10.5, fontWeight: 600,
            color: filter === f ? 'white' : T.inkMuted, cursor: 'pointer',
          }}>{f}</button>
        ))}
      </div>

      {/* Status row */}
      {loading && <div style={{ padding: '12px 16px', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>Loading clients…</div>}
      {error && (
        <div style={{ margin: '8px 13px', padding: 10, borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 12, color: T.ink }}>
          {error.message}
        </div>
      )}

      {/* Empty state: No clients at all */}
      {!loading && !error && clients.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <EmptyClients size={100} />
          <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, maxWidth: 220, lineHeight: 1.5 }}>
            No clients yet. Tap <strong style={{ color: T.pink }}>+</strong> above to add your first VIP.
          </div>
        </div>
      )}

      {/* Empty state: No search/filter results */}
      {!loading && !error && clients.length > 0 && filtered.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <NoResults size={100} />
          <div style={{ fontFamily: T.font, fontSize: 13, color: T.inkMuted, maxWidth: 220, lineHeight: 1.5 }}>
            No matches found for "{search || filter}".
          </div>
        </div>
      )}

      {/* Client list */}
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 13px 80px', contain: 'layout style paint' }}>
        {filtered.map((c, i) => (
          <ClientCard key={c.id || i} c={c} T={T} onPress={handleClientPress} />
        ))}
      </div>
    </div>
  );
}
