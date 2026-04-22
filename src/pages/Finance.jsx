import { useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import SectionLabel from '../components/ui/SectionLabel';

const bars = [420, 380, 510, 295, 485];
const periods = ['Week', 'Month', 'Year', 'All'];

const transactions = [
  { type: 'income',  icon: '💚', label: 'Anne K. · Deep Clean',    date: 'Apr 19', amt: '+$185', color: '#22C55E' },
  { type: 'pending', icon: '🔴', label: 'Patel Family · Organize',  date: 'Apr 15', amt: '+$160', color: '#E91E6A' },
  { type: 'pending', icon: '🔴', label: 'Chen Family · Deep Clean', date: 'Apr 12', amt: '+$120', color: '#E91E6A' },
  { type: 'expense', icon: '🟡', label: 'Cleaning supplies',         date: 'Apr 10', amt: '-$42',  color: '#F59E0B' },
  { type: 'income',  icon: '💚', label: 'Westbrook · Quick Tidy',   date: 'Apr 8',  amt: '+$90',  color: '#22C55E' },
  { type: 'expense', icon: '🟡', label: 'Mileage deduction (auto)', date: 'Apr 8',  amt: '-$18',  color: '#F59E0B' },
];

export default function Finance() {
  const { T, mode, privacyOn } = useAppTheme();
  const [period, setPeriod] = useState('Week');
  const maxBar = Math.max(...bars);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      {/* Dark hero */}
      <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '12px 14px 14px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: -45, right: -25, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.22) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 9, padding: 3, marginBottom: 12 }}>
          {periods.map(p => (
            <div key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, textAlign: 'center', background: period === p ? '#E91E6A' : 'transparent', fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: period === p ? 'white' : 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>{p}</div>
          ))}
        </div>

        <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 4 }}>✦ This Week</div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 3 }}>
          {privacyOn
            ? <div style={{ fontFamily: T.serif, fontSize: 36, fontWeight: 500, letterSpacing: '-2px', color: 'white' }}>•••</div>
            : <div style={{ fontFamily: T.serif, fontSize: 36, fontWeight: 500, letterSpacing: '-2px', color: 'white', fontVariantNumeric: 'tabular-nums' }}>$485</div>
          }
          <div style={{ background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '3px 9px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, color: '#4ADE80' }}>▲ 12%</span>
          </div>
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>vs last week · {privacyOn ? '•••' : '$432'}</div>

        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 32 }}>
          {bars.map((v, i) => {
            const h = Math.round((v / maxBar) * 28) + 4;
            const isToday = i === 4;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', height: h, borderRadius: 4, background: isToday ? '#E91E6A' : 'rgba(255,255,255,0.15)' }} />
                <div style={{ fontFamily: T.font, fontSize: 7.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2px' }}>
                  {['M', 'T', 'W', 'T', 'T'][i]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '11px 13px 8px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 11 }}>
          {[
            { label: 'Collected',    val: '$1,240', sub: 'This month',           color: '#22C55E',                              bg: mode === 'dark' ? 'rgba(34,197,94,0.1)'   : '#F0FFF5', border: mode === 'dark' ? 'rgba(34,197,94,0.22)'   : '#86EFAC' },
            { label: 'Outstanding',  val: '$280',   sub: '3 invoices',           color: '#E91E6A',                              bg: mode === 'dark' ? 'rgba(233,30,106,0.1)'   : '#FFF0F7', border: mode === 'dark' ? 'rgba(233,30,106,0.25)'  : '#FFD6E8', action: 'Nudge all' },
            { label: 'Hours Worked', val: '28.5h',  sub: '$43.50 / hr avg',      color: mode === 'dark' ? 'rgba(255,255,255,0.7)' : '#5A3040', bg: T.card, border: T.cardBorder },
            { label: 'Mileage',      val: '87 km',  sub: 'Auto-tracked · tax ready', color: mode === 'dark' ? 'rgba(255,255,255,0.7)' : '#5A3040', bg: T.card, border: T.cardBorder },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '10px 11px' }}>
              <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 500, letterSpacing: '-0.4px', color: s.color, marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>
                {privacyOn && (i === 0 || i === 1) ? '•••' : s.val}
              </div>
              <div style={{ fontFamily: T.font, fontSize: 9.5, color: T.inkMuted }}>{s.sub}</div>
              {s.action && (
                <button style={{ marginTop: 6, background: '#E91E6A', color: 'white', border: 'none', borderRadius: 6, padding: '4px 9px', fontFamily: T.font, fontSize: 9.5, fontWeight: 700, cursor: 'pointer' }}>{s.action}</button>
              )}
            </div>
          ))}
        </div>

        <div style={{ background: T.hero, borderRadius: 12, padding: '11px 12px', position: 'relative', overflow: 'hidden', marginBottom: 11 }}>
          <div style={{ position: 'absolute', top: -15, right: -8, width: 70, height: 70, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.2) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 4 }}>✦ FINANCE INTEL</div>
          <div style={{ fontFamily: T.font, fontSize: 11.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, marginBottom: 9 }}>
            3 outstanding invoices totalling {privacyOn ? '•••' : '$280'}. Chen Family is 3 days overdue. Want me to draft nudge texts for all three?
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button style={{ flex: 1, background: '#E91E6A', color: 'white', border: 'none', borderRadius: 8, padding: '8px 0', fontFamily: T.font, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Draft nudges</button>
            <button style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '8px 0', fontFamily: T.font, fontSize: 11, cursor: 'pointer' }}>Later</button>
          </div>
        </div>

        <div style={{ background: mode === 'dark' ? 'rgba(139,92,246,0.1)' : '#F5F3FF', border: mode === 'dark' ? '1px solid rgba(139,92,246,0.22)' : '1px solid #DDD6FE', borderRadius: 11, padding: '9px 12px', marginBottom: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>📊</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.font, fontSize: 11, fontWeight: 700, color: mode === 'dark' ? '#C4B5FD' : '#5B21B6' }}>Tax Ready</div>
            <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>YTD income, mileage, deductibles auto-tracked</div>
          </div>
          <button style={{ background: mode === 'dark' ? 'rgba(139,92,246,0.2)' : '#EDE9FE', border: mode === 'dark' ? '1px solid rgba(139,92,246,0.3)' : '1px solid #C4B5FD', color: mode === 'dark' ? '#C4B5FD' : '#5B21B6', borderRadius: 7, padding: '5px 9px', fontFamily: T.font, fontSize: 9.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Export CSV</button>
        </div>

        <SectionLabel>Recent Activity</SectionLabel>

        {transactions.map((tx, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 11, padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${tx.color}18`, border: `1px solid ${tx.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
              {tx.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.serif, fontSize: 12.5, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</div>
              <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>{tx.date}</div>
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: tx.color, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {privacyOn ? '•••' : tx.amt}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
