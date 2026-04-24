import { useMemo } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import AmtCell from '../components/ui/AmtCell';
import SectionLabel from '../components/ui/SectionLabel';
import CapeUpButton from '../components/ui/CapeUpButton';
import { useJobs } from '../data/useData';

const NOW = () => new Date();

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function fmtTime12(d) {
  const h = d.getHours(), m = d.getMinutes();
  const hh = ((h + 11) % 12) + 1;
  const ap = h < 12 ? 'AM' : 'PM';
  return { time: m === 0 ? `${hh}:00` : `${hh}:${m.toString().padStart(2,'0')}`, period: ap };
}

function dateBrief(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Home() {
  const { T, mode, privacyOn } = useAppTheme();
  const { jobs: allJobs, loading } = useJobs();
  const today = NOW();

  const todayJobs = useMemo(() => {
    return allJobs
      .map(j => {
        const start = new Date(j.scheduled_at);
        const end = new Date(start.getTime() + (j.duration_est || 60) * 60000);
        return { ...j, start, end };
      })
      .filter(j => sameDay(j.start, today) && j.status !== 'Cancelled')
      .sort((a, b) => a.start - b.start);
  }, [allJobs, today]);

  const overdueJobs = useMemo(() => {
    return allJobs
      .filter(j => j.status === 'Completed' && j.payment_status !== 'Paid' && Number(j.total) > 0)
      .map(j => ({ ...j, start: new Date(j.scheduled_at) }))
      .filter(j => (today - j.start) / 86400000 >= 1);
  }, [allJobs, today]);

  const next = todayJobs.find(j => j.end >= today) || todayJobs[0];
  const revenueToday = todayJobs.reduce((s, j) => s + Number(j.total || 0), 0);

  // Tight-gap detection: any consecutive pair within < 60min
  const tightGap = useMemo(() => {
    for (let i = 0; i < todayJobs.length - 1; i++) {
      const a = todayJobs[i], b = todayJobs[i + 1];
      const gapMin = Math.round((b.start - a.end) / 60000);
      if (gapMin < 60 && gapMin >= 0) return { a, b, gapMin };
    }
    return null;
  }, [todayJobs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>

        {/* HERO */}
        <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '13px 15px 15px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -15, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle,rgba(120,60,200,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: T.pinkLabel, marginBottom: 5 }}>
            ✦ Command Brief · {dateBrief(today)}
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, letterSpacing: '-0.5px', color: 'white', lineHeight: 1.15, marginBottom: 4 }}>
            Good morning,<br />Sandra.
          </div>
          <div style={{ fontFamily: T.font, fontSize: 11.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 12 }}>
            {todayJobs.length === 0
              ? 'No jobs scheduled for today.'
              : <>{todayJobs.length} {todayJobs.length === 1 ? 'house' : 'houses'} today{tightGap ? <> · <span style={{ color: T.pinkLabel }}>1 flag needs you</span></> : ''}</>
            }
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: tightGap ? 12 : 0 }}>
            {[
              { n: String(todayJobs.length), l: 'Jobs' },
              { n: privacyOn ? '•••' : `$${revenueToday.toFixed(0)}`, l: 'Today' },
              { n: '—', l: 'Drive' },
            ].map(s => (
              <div key={s.l} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '7px 6px', textAlign: 'center' }}>
                <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: 'white', letterSpacing: '-0.3px' }}>{s.n}</div>
                <div style={{ fontFamily: T.font, fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {tightGap && (
            <div style={{ background: 'rgba(245,158,11,0.11)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 10, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 14 }}>⚠</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: '#FCD34D', marginBottom: 1 }}>Tight gap today</div>
                <div style={{ fontFamily: T.font, fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                  {tightGap.a.client_name} → {tightGap.b.client_name} = {tightGap.gapMin} min
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 13px 0' }}>
          {loading && (
            <div style={{ padding: '12px 0', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>Loading…</div>
          )}

          {!loading && todayJobs.length === 0 && (
            <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '18px 16px', textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginBottom: 4 }}>Nothing scheduled today.</div>
              <div style={{ fontFamily: T.font, fontSize: 12, color: T.inkMuted }}>Tap the pink + button to book a job.</div>
            </div>
          )}

          {next && (
            <>
              <SectionLabel>Opening Act · {next.client_name}</SectionLabel>

              <div style={{ background: T.hero, border: '1.5px solid rgba(233,30,106,0.32)', borderRadius: 14, padding: '11px 12px 12px', position: 'relative', overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ position: 'absolute', top: -20, right: -15, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: T.pinkLabel }}>{next.service_name}</div>
                    <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, letterSpacing: '-0.3px', color: 'white', marginTop: 2 }}>{next.client_name}</div>
                  </div>
                  <span style={{ background: '#E91E6A', color: 'white', borderRadius: 5, padding: '2px 7px', fontFamily: T.font, fontSize: 8.5, fontWeight: 700 }}>NEXT UP</span>
                </div>
                <div style={{ fontFamily: T.font, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 9 }}>
                  {fmtTime12(next.start).time} – {fmtTime12(next.end).time} {fmtTime12(next.end).period}
                </div>

                {next.notes && (
                  <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                    <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: T.pinkLabel, marginBottom: 3 }}>✦ PREP NOTES</div>
                    <div style={{ fontFamily: T.font, fontSize: 11, color: 'rgba(255,255,255,0.68)', lineHeight: 1.5 }}>{next.notes}</div>
                  </div>
                )}

                <CapeUpButton job={{ address: '', driveTime: '—', service: next.service_name }} />

                <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 600, color: T.pinkLabel, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="sm-pulse" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: T.pinkLabel }} />
                  📍 Auto-timer ON · Starts when you arrive
                </div>
              </div>
            </>
          )}

          {todayJobs.length > 0 && (
            <>
              <SectionLabel>Today's Schedule</SectionLabel>

              {todayJobs.map((j, i) => {
                const conflict = (i < todayJobs.length - 1)
                  && Math.round((todayJobs[i + 1].start - j.end) / 60000) < 60;
                const isNext = next && j.id === next.id;
                const border = conflict ? 'rgba(245,158,11,0.35)' : isNext ? 'rgba(233,30,106,0.38)' : T.cardBorder;
                const bg = conflict ? (mode === 'dark' ? 'rgba(245,158,11,0.05)' : '#FFFBEB') : T.card;
                const t = fmtTime12(j.start);
                const e = fmtTime12(j.end);
                const amt = `$${Number(j.total || 0).toFixed(0)}`;

                return (
                  <div key={j.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '9px 11px', marginBottom: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: j.notes ? 7 : 0 }}>
                      <div style={{ width: 44, height: 46, borderRadius: 10, flexShrink: 0, background: conflict ? (mode === 'dark' ? 'rgba(245,158,11,0.12)' : '#FEF3C7') : T.pinkTint, border: `1px solid ${conflict ? 'rgba(245,158,11,0.22)' : T.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 500, color: conflict ? '#F59E0B' : T.pink, lineHeight: 1 }}>{t.time}</div>
                        <div style={{ fontFamily: T.font, fontSize: 7.5, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.3px', marginTop: 2 }}>–{e.time}</div>
                        <div style={{ fontFamily: T.font, fontSize: 7, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.2px' }}>{e.period}</div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, letterSpacing: '-0.2px', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.client_name}</div>
                        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>{j.service_name}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        {conflict && <span style={{ background: '#FEF3C7', borderRadius: 4, padding: '2px 6px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: '#78350F', whiteSpace: 'nowrap' }}>⚠ GAP</span>}
                        {isNext && <span style={{ background: '#E91E6A', borderRadius: 4, padding: '2px 6px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: 'white' }}>UP NEXT</span>}
                        <AmtCell amount={amt} size={13} />
                      </div>
                    </div>

                    {j.notes && (
                      <div style={{ borderTop: `1px dashed ${mode === 'dark' ? 'rgba(255,255,255,0.07)' : '#FFE8F2'}`, paddingTop: 6, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: conflict ? '#F59E0B' : T.pinkLabel, flexShrink: 0, marginTop: 1 }}>✦ NOTES</span>
                        <span style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkSub, lineHeight: 1.45 }}>{j.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {overdueJobs.length > 0 && (
            <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9, marginTop: 4 }}>
              <span style={{ fontSize: 13 }}>💰</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: mode === 'dark' ? '#FCA5A5' : '#B91C1C' }}>
                  {overdueJobs.length} unpaid completed job{overdueJobs.length === 1 ? '' : 's'}
                </div>
                <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted }}>
                  {overdueJobs.slice(0, 2).map(j => j.client_name).join(', ')}{overdueJobs.length > 2 ? '…' : ''}
                </div>
              </div>
              <AmtCell
                amount={`$${overdueJobs.reduce((s, j) => s + Number(j.total || 0), 0).toFixed(0)}`}
                size={12}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
