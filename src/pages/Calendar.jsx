import { useAppTheme } from '../context/AppThemeContext';

export default function Calendar() {
  const { T, mode, privacyOn } = useAppTheme();
  const slotH = 50, startH = 8;

  const jobs = [
    { start: 9,  end: 11.5, label: 'Deep Clean', client: 'Anne K.',       amt: '$185', addr: '12 Main St',  color: '#E91E6A', bg: mode === 'dark' ? 'rgba(233,30,106,0.12)' : '#FFF0F7', note: 'Key under mat · big dog · extra time kitchen' },
    { start: 13, end: 15,   label: 'Organize',   client: 'Patel Family',  amt: '$160', addr: '45 Oak Ave',  color: '#F59E0B', bg: mode === 'dark' ? 'rgba(245,158,11,0.12)' : '#FFFBEB', note: 'Bring extra bins · 2nd floor office priority' },
    { start: 16, end: 17,   label: 'Quick Tidy', client: 'Westbrook',     amt: '$90',  addr: '8 Birch Cres', color: '#22C55E', bg: mode === 'dark' ? 'rgba(34,197,94,0.1)'   : '#F0FFF5', note: 'Lockbox: 4829 · kitchen + bathroom only' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      {/* Dark hero */}
      <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '11px 13px 13px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500, letterSpacing: '-0.4px', color: 'white' }}>April 2026</div>
          <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 20, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E' }} />
            <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: '#4ADE80', letterSpacing: '0.4px' }}>GCAL SYNCED</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 9 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
            const on = i === 1;
            const nums = [20, 21, 22, 23, 24, 25, 26], dots = [0, 3, 1, 2, 0, 0, 0];
            return (
              <div key={i} style={{ textAlign: 'center', padding: '4px 2px 5px', borderRadius: 8, background: on ? '#E91E6A' : 'rgba(255,255,255,0.05)', border: on ? 'none' : '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontFamily: T.font, fontSize: 7.5, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: on ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.38)' }}>{d}</div>
                <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, color: 'white', lineHeight: 1.2, marginTop: 2 }}>{nums[i]}</div>
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 2 }}>
                  {Array.from({ length: dots[i] }).map((_, k) => (
                    <span key={k} style={{ width: 3, height: 3, borderRadius: '50%', background: on ? 'rgba(255,255,255,0.7)' : '#FF78B0', display: 'block' }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 9, padding: 3 }}>
          {['Day', 'Week', 'Agenda'].map((v, i) => (
            <div key={v} style={{ flex: 1, padding: '6px 0', borderRadius: 7, textAlign: 'center', background: i === 0 ? '#E91E6A' : 'transparent', fontFamily: T.font, fontSize: 11, fontWeight: 600, color: i === 0 ? 'white' : 'rgba(255,255,255,0.48)' }}>{v}</div>
          ))}
        </div>
      </div>

      {/* Conflict banner */}
      <div style={{ background: mode === 'dark' ? 'rgba(245,158,11,0.09)' : '#FEF3C7', borderBottom: '1px solid rgba(245,158,11,0.18)', padding: '6px 13px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <span style={{ fontSize: 11 }}>⚠</span>
        <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: '#B45309', flex: 1 }}>Anne → Patel gap 28 min · conflict risk</span>
        <button style={{ background: '#1A0A12', color: 'white', border: 'none', borderRadius: 6, padding: '4px 9px', fontFamily: T.font, fontSize: 9.5, fontWeight: 700, cursor: 'pointer' }}>Fix</button>
      </div>

      {/* Timeline */}
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', position: 'relative' }}>
        <div style={{ position: 'relative', minHeight: 11 * slotH }}>
          {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
            <div key={h} style={{ display: 'flex', height: slotH, alignItems: 'flex-start', gap: 7 }}>
              <div style={{ width: 36, fontFamily: T.font, fontSize: 9, fontWeight: 600, color: T.inkMuted, paddingTop: 2, textAlign: 'right', flexShrink: 0 }}>
                {h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
              </div>
              <div style={{ flex: 1, borderTop: mode === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid #FFE8F2' }} />
            </div>
          ))}

          {jobs.map((j, i) => {
            const top = (j.start - startH) * slotH + 2;
            const h = (j.end - j.start) * slotH - 4;
            return (
              <div key={i} style={{ position: 'absolute', top, left: 43, right: 0, height: h, background: j.bg, border: `1.5px solid ${j.color}35`, borderLeft: `3px solid ${j.color}`, borderRadius: 9, padding: '6px 9px', overflow: 'hidden' }}>
                <div style={{ fontFamily: T.serif, fontSize: 12, fontWeight: 500, color: j.color, letterSpacing: '-0.2px' }}>{j.label}</div>
                <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkSub, marginTop: 1 }}>{j.client}</div>
                {h > 55 && (
                  <div style={{ fontFamily: T.font, fontSize: 9, color: T.inkMuted, marginTop: 2 }}>
                    {j.start}:00 – {j.end % 1 === 0.5 ? `${Math.floor(j.end)}:30` : `${j.end}:00`}
                  </div>
                )}
                {h > 80 && (
                  <div style={{ fontFamily: T.font, fontSize: 9, color: T.inkMuted, marginTop: 3, lineHeight: 1.35, fontStyle: 'italic' }}>
                    {j.note}
                  </div>
                )}
                {h > 50 && (
                  <div style={{ position: 'absolute', bottom: 5, right: 7, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {!privacyOn && <span style={{ fontFamily: T.serif, fontSize: 11, fontWeight: 500, color: j.color }}>{j.amt}</span>}
                    {privacyOn && <span style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, letterSpacing: '2px' }}>•••</span>}
                    <span style={{ color: T.inkMuted, fontSize: 9 }}>·</span>
                    <span style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, color: j.color, letterSpacing: '0.3px', cursor: 'pointer' }}>↗ Directions</span>
                  </div>
                )}
              </div>
            );
          })}

          {[
            { from: 11.5, to: 13, label: '8 min drive',  conflict: true },
            { from: 15,   to: 16, label: '12 min drive', conflict: false },
          ].map((d, i) => {
            const top = (d.from - startH) * slotH + 4;
            const h = (d.to - d.from) * slotH - 8;
            return (
              <div key={i} style={{ position: 'absolute', top, left: 43, right: 0, height: h, borderLeft: `2px dashed ${d.conflict ? '#F59E0B' : 'rgba(255,255,255,0.12)'}`, marginLeft: 4, display: 'flex', alignItems: 'center' }}>
                <span style={{ marginLeft: 7, fontFamily: T.font, fontSize: 8.5, fontWeight: 600, color: d.conflict ? '#F59E0B' : T.inkMuted }}>
                  {d.label}{d.conflict && ' ⚠'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
