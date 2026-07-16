import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppTheme } from '../context/AppThemeContext';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { useSearchJobs } from '../data/useData';

// Month/day/year parts for the date chip. The old fmtDate returned
// "Mon, Jul 14" and the chip split on spaces — rendering "MON," + "Jul"
// and dropping the day number entirely.
function dateParts(s) {
  if (!s) return { mon: '—', day: '', yr: null };
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return { mon: '—', day: '', yr: null };
  return { mon: dt.toLocaleDateString('en-US', { month: 'short' }), day: String(d), yr: y };
}

export default function Search() {
  const { T, mode } = useAppTheme();
  const navigate = useNavigate();
  const { openJob } = useJobDetailSheet();
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [submitted, setSubmitted] = useState({ q: '', dateFrom: '', dateTo: '' });

  const { results, loading } = useSearchJobs(submitted.q, submitted.dateFrom, submitted.dateTo);
  const hasQuery = !!(submitted.q || submitted.dateFrom || submitted.dateTo);

  const handleSearch = (e) => {
    e.preventDefault();
    setSubmitted({ q: q.trim(), dateFrom, dateTo });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none', color: T.ink,
              fontSize: 20, cursor: 'pointer', padding: '4px 0', lineHeight: 1,
            }}
          >‹</button>
          <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: T.ink }}>Search Jobs</div>
        </div>

        <form onSubmit={handleSearch}>
          <div style={{
            background: T.card, border: `1.5px solid ${T.cardBorder}`,
            borderRadius: 16, padding: '12px 14px', marginBottom: 12,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                placeholder="Service name, notes…"
                value={q}
                onChange={e => setQ(e.target.value)}
                style={{
                  width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 9, paddingBottom: 9,
                  borderRadius: 10, border: `1.5px solid ${T.cardBorder}`,
                  background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                  fontFamily: T.font, fontSize: 14, color: T.ink,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 600, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>From</div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 10,
                    border: `1.5px solid ${T.cardBorder}`,
                    background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    fontFamily: T.font, fontSize: 13, color: T.ink, boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 600, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>To</div>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 10,
                    border: `1.5px solid ${T.cardBorder}`,
                    background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    fontFamily: T.font, fontSize: 13, color: T.ink, boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <button
              type="submit"
              style={{
                background: T.pink, border: 'none', borderRadius: 12,
                padding: '11px 0', fontFamily: T.font, fontSize: 14, fontWeight: 700, color: 'white',
                cursor: 'pointer', width: '100%',
              }}
            >Search</button>
          </div>
        </form>

        {loading && (
          <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: T.font, fontSize: 14, color: T.inkMuted }}>
            Searching…
          </div>
        )}

        {!loading && hasQuery && results.length === 0 && (
          <div style={{
            background: T.card, border: `1.5px dashed ${T.cardBorder}`,
            borderRadius: 16, padding: '32px 20px', textAlign: 'center',
            fontFamily: T.font, fontSize: 13, color: T.inkMuted,
          }}>
            No jobs found.
          </div>
        )}

        {!loading && results.length > 0 && (
          <div>
            <div style={{ fontFamily: T.font, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: T.inkMuted, marginBottom: 8 }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map(j => {
                const dp = dateParts(j.scheduled_date);
                return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => openJob(j.id)}
                  style={{
                    background: T.card, border: `1.5px solid ${T.cardBorder}`,
                    borderRadius: 13, padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', width: '100%', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 50, flexShrink: 0, textAlign: 'center',
                    background: T.cardBorder, borderRadius: 10, padding: '6px 0',
                  }}>
                    <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 900, color: T.inkSub, textTransform: 'uppercase', lineHeight: 1 }}>
                      {dp.mon}
                    </div>
                    <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 700, color: T.inkSub, marginTop: 1 }}>
                      {dp.day}
                    </div>
                    {dp.yr != null && dp.yr !== new Date().getFullYear() && (
                      <div style={{ fontFamily: T.font, fontSize: 8.5, fontWeight: 700, color: T.inkMuted, marginTop: 1 }}>
                        {dp.yr}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.service_name}
                    </div>
                    <div style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkMuted, marginTop: 2 }}>
                      {j.client_name || 'Unknown client'}
                    </div>
                  </div>
                  <span style={{
                    background: j.job_status === 'Completed' ? T.greenBg : T.pinkTint,
                    color: j.job_status === 'Completed' ? T.greenFg : T.pink,
                    borderRadius: 5, padding: '2px 7px',
                    fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                    flexShrink: 0,
                  }}>{j.job_status || 'Scheduled'}</span>
                </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
