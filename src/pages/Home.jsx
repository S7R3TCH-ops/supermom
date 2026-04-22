import { useAppTheme } from '../context/AppThemeContext';
import AmtCell from '../components/ui/AmtCell';
import SectionLabel from '../components/ui/SectionLabel';
import CapeUpButton from '../components/ui/CapeUpButton';

const scheduleJobs = [
  {
    time: '9:00', end: '11:30', period: 'AM', name: 'Anne K.', service: 'Deep Clean',
    status: 'next', amt: '$185',
    notes: 'Side-door key under mat. Big dog is friendly 🐶 Extra time on kitchen.',
  },
  {
    time: '1:00', end: '3:00', period: 'PM', name: 'Patel Family', service: 'Organize',
    status: 'conflict', amt: '$160',
    notes: 'Bring extra bins. 2nd-floor office is the priority — lots of boxes.',
  },
  {
    time: '4:00', end: '5:00', period: 'PM', name: 'Westbrook', service: 'Quick Tidy',
    status: 'ok', amt: '$90',
    notes: 'Key in lockbox: 4829. Focus kitchen + main bathroom only.',
  },
];

export default function Home() {
  const { T, mode, privacyOn } = useAppTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>

        {/* HERO */}
        <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '13px 15px 15px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -15, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle,rgba(120,60,200,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: T.pinkLabel, marginBottom: 5 }}>✦ Command Brief · Tue Apr 22</div>
          <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, letterSpacing: '-0.5px', color: 'white', lineHeight: 1.15, marginBottom: 4 }}>Good morning,<br />Sandra.</div>
          <div style={{ fontFamily: T.font, fontSize: 11.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 12 }}>
            3 houses today · <span style={{ color: T.pinkLabel }}>1 flag needs you</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
            {[
              { n: '3', l: 'Jobs' },
              { n: privacyOn ? '•••' : '$485', l: 'Today' },
              { n: '11.4km', l: 'Drive' },
            ].map(s => (
              <div key={s.l} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '7px 6px', textAlign: 'center' }}>
                <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: 'white', letterSpacing: '-0.3px' }}>{s.n}</div>
                <div style={{ fontFamily: T.font, fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(245,158,11,0.11)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 10, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 14 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: '#FCD34D', marginBottom: 1 }}>Tight gap Tuesday</div>
              <div style={{ fontFamily: T.font, fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>Anne (11:30) → Patel (1:00) = 28 min. Push Patel to 1:30?</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button style={{ background: '#E91E6A', color: 'white', border: 'none', borderRadius: 7, padding: '5px 8px', fontFamily: T.font, fontSize: 9.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Fix it</button>
              <button style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '5px 8px', fontFamily: T.font, fontSize: 9.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>Leave it</button>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 13px 0' }}>
          <SectionLabel>Opening Act · Anne K.</SectionLabel>

          <div style={{ background: T.hero, border: '1.5px solid rgba(233,30,106,0.32)', borderRadius: 14, padding: '11px 12px 12px', position: 'relative', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ position: 'absolute', top: -20, right: -15, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: T.pinkLabel }}>Deep Clean</div>
                <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500, letterSpacing: '-0.3px', color: 'white', marginTop: 2 }}>Anne K.</div>
              </div>
              <span style={{ background: '#E91E6A', color: 'white', borderRadius: 5, padding: '2px 7px', fontFamily: T.font, fontSize: 8.5, fontWeight: 700 }}>NEXT UP</span>
            </div>
            <div style={{ fontFamily: T.font, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 9 }}>9:00 – 11:30 AM · 8 min drive · 12 Main St</div>

            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
              <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: T.pinkLabel, marginBottom: 3 }}>✦ PREP NOTES</div>
              <div style={{ fontFamily: T.font, fontSize: 11, color: 'rgba(255,255,255,0.68)', lineHeight: 1.5 }}>
                Side-door key under mat. Big dog is friendly 🐶 Extra time on kitchen.
              </div>
            </div>

            <CapeUpButton job={{ address: '12 Main St', driveTime: '8 min', service: 'Deep Clean' }} />

            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 600, color: T.pinkLabel, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="sm-pulse" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: T.pinkLabel }} />
              📍 Auto-timer ON · Starts when you arrive
            </div>
          </div>

          <SectionLabel>Today's Schedule</SectionLabel>

          {scheduleJobs.map((j, i) => {
            const isConflict = j.status === 'conflict';
            const isNext = j.status === 'next';
            const border = isConflict ? 'rgba(245,158,11,0.35)' : isNext ? 'rgba(233,30,106,0.38)' : T.cardBorder;
            const bg = isConflict ? (mode === 'dark' ? 'rgba(245,158,11,0.05)' : '#FFFBEB') : T.card;

            return (
              <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '9px 11px', marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: j.notes ? 7 : 0 }}>
                  <div style={{ width: 44, height: 46, borderRadius: 10, flexShrink: 0, background: isConflict ? (mode === 'dark' ? 'rgba(245,158,11,0.12)' : '#FEF3C7') : T.pinkTint, border: `1px solid ${isConflict ? 'rgba(245,158,11,0.22)' : T.cardBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 500, color: isConflict ? '#F59E0B' : T.pink, lineHeight: 1 }}>{j.time}</div>
                    <div style={{ fontFamily: T.font, fontSize: 7.5, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.3px', marginTop: 2 }}>–{j.end}</div>
                    <div style={{ fontFamily: T.font, fontSize: 7, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.2px' }}>{j.period}</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, letterSpacing: '-0.2px', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                    <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>{j.service}</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    {isConflict && <span style={{ background: '#FEF3C7', borderRadius: 4, padding: '2px 6px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: '#78350F', whiteSpace: 'nowrap' }}>⚠ GAP</span>}
                    {isNext && <span style={{ background: '#E91E6A', borderRadius: 4, padding: '2px 6px', fontFamily: T.font, fontSize: 8, fontWeight: 700, color: 'white' }}>UP NEXT</span>}
                    <AmtCell amount={j.amt} size={13} />
                  </div>
                </div>

                {j.notes && (
                  <div style={{ borderTop: `1px dashed ${mode === 'dark' ? 'rgba(255,255,255,0.07)' : '#FFE8F2'}`, paddingTop: 6, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: isConflict ? '#F59E0B' : T.pinkLabel, flexShrink: 0, marginTop: 1 }}>✦ NOTES</span>
                    <span style={{ fontFamily: T.font, fontSize: 10.5, color: T.inkSub, lineHeight: 1.45 }}>{j.notes}</span>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ background: T.redBg, border: `1px solid ${T.redBorder}`, borderRadius: 10, padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
            <span style={{ fontSize: 13 }}>💰</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: mode === 'dark' ? '#FCA5A5' : '#B91C1C' }}>Chen Family · 3 days overdue</div>
              <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted }}>AI can send a friendly nudge text now</div>
            </div>
            <AmtCell amount="$120" size={12} />
            <button style={{ background: mode === 'dark' ? 'rgba(220,38,38,0.18)' : '#FEE2E2', border: `1px solid ${T.redBorder}`, color: mode === 'dark' ? '#FCA5A5' : '#B91C1C', borderRadius: 7, padding: '5px 8px', fontFamily: T.font, fontSize: 10, fontWeight: 700, cursor: 'pointer', marginLeft: 2, whiteSpace: 'nowrap' }}>Nudge</button>
          </div>

          <div style={{ background: T.hero, borderRadius: 12, padding: '11px 12px', position: 'relative', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ position: 'absolute', top: -15, right: -8, width: 70, height: 70, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: T.pinkLabel, marginBottom: 4 }}>✦ AGENT ACTIVITY</div>
            <div style={{ fontFamily: T.font, fontSize: 11.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, marginBottom: 9 }}>I drafted a thank-you + receipt for last Tuesday's Westbrook visit. Ready to send?</div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button style={{ flex: 1, background: '#E91E6A', color: 'white', border: 'none', borderRadius: 8, padding: '8px 0', fontFamily: T.font, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Send it ✓</button>
              <button style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.55)', borderRadius: 8, padding: '8px 0', fontFamily: T.font, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Review first</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
