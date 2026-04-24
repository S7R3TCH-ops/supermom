import { useMemo, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import SectionLabel from '../components/ui/SectionLabel';
import { useJobs, notifyDataChanged, useClients } from '../data/useData';
import { updateJob, recordPayment } from '../data/jobsRepo';
import NudgeDraftSheet from '../components/sheets/NudgeDraftSheet';

const periods = ['Week', 'Month', 'Year', 'All'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfWeek(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}
function startOfMonth(d) { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(1); return x; }
function startOfYear(d)  { const x = new Date(d); x.setHours(0,0,0,0); x.setMonth(0,1); return x; }
function addDays(d, n)   { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function periodStart(period, now) {
  if (period === 'Week')  return startOfWeek(now);
  if (period === 'Month') return startOfMonth(now);
  if (period === 'Year')  return startOfYear(now);
  return new Date(0);
}
function fmtShort(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

export default function Finance() {
  const { T, mode, privacyOn } = useAppTheme();
  const [period, setPeriod] = useState('Week');
  const [busyId, setBusyId] = useState(null);
  const [showNudges, setShowNudges] = useState(false);
  const { jobs: allJobs, loading } = useJobs();
  const { clients } = useClients();

  async function markPaid(id) {
    if (busyId) return;
    const job = allJobs.find(j => j.id === id);
    if (!job) return;

    if (!window.confirm(`Mark $${Number(job.total || 0).toFixed(0)} for ${job.client_name} as paid?`)) return;
    setBusyId(id);
    try {
      await recordPayment(id, Number(job.total || 0));
      notifyDataChanged();
    } catch (e) {
      alert('Could not update payment: ' + (e?.message || e));
    } finally {
      setBusyId(null);
    }
  }
  const now = new Date();

  const filtered = useMemo(() => {
    const start = periodStart(period, now);
    return allJobs
      .map(j => ({ ...j, _date: new Date(j.scheduled_at) }))
      .filter(j => !Number.isNaN(j._date.getTime()) && j._date >= start);
  }, [allJobs, period]);

  const collected = filtered
    .filter(j => j.payment_status === 'Paid')
    .reduce((s, j) => s + Number(j.total || 0), 0);
  const outstanding = allJobs
    .filter(j => j.status === 'Completed' && j.payment_status !== 'Paid')
    .reduce((s, j) => s + Number(j.total || 0), 0);
  const outstandingCount = allJobs.filter(j => j.status === 'Completed' && j.payment_status !== 'Paid').length;
  const periodTotal = filtered
    .filter(j => j.status !== 'Cancelled')
    .reduce((s, j) => s + Number(j.total || 0), 0);

  const clientsWithUnpaid = useMemo(() => {
    const map = new Map();
    allJobs
      .filter(j => j.status === 'Completed' && j.payment_status !== 'Paid' && j.client_id)
      .forEach(j => {
        const c = map.get(j.client_id) || { id: j.client_id, unpaidTotal: 0 };
        c.unpaidTotal += Number(j.total || 0);
        map.set(j.client_id, c);
      });
    
    return Array.from(map.values()).map(item => {
      const client = clients.find(c => c.id === item.id);
      return {
        ...item,
        name: client?.name || 'Unknown',
        phone: client?.phone || '',
      };
    }).filter(c => c.unpaidTotal > 0);
  }, [allJobs, clients]);

  // Estimated hours (sum of estimated_hours on completed jobs in period)
  const hoursWorked = filtered
    .filter(j => j.status === 'Completed' && j.raw?.estimated_hours)
    .reduce((s, j) => s + Number(j.raw.estimated_hours), 0);
  const hourlyAvg = hoursWorked > 0 ? collected / hoursWorked : 0;

  // Last 7 days bars
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(todayStart, -6 + i);
    const dayTotal = allJobs
      .filter(j => {
        const jd = new Date(j.scheduled_at);
        return jd.getFullYear() === d.getFullYear() && jd.getMonth() === d.getMonth() && jd.getDate() === d.getDate() && j.status !== 'Cancelled';
      })
      .reduce((s, j) => s + Number(j.total || 0), 0);
    return { d, total: dayTotal, dow: (d.getDay() + 6) % 7 };
  });
  const maxBar = Math.max(1, ...last7.map(b => b.total));

  // Recent activity
  const transactions = useMemo(() => {
    return [...allJobs]
      .map(j => ({ ...j, _date: new Date(j.scheduled_at) }))
      .filter(j => !Number.isNaN(j._date.getTime()))
      .sort((a, b) => b._date - a._date)
      .slice(0, 8)
      .map(j => {
        const paid = j.payment_status === 'Paid';
        const completed = j.status === 'Completed';
        const color = paid ? '#22C55E' : completed ? '#E91E6A' : 'rgba(255,255,255,0.4)';
        const icon = paid ? '💚' : completed ? '🔴' : '🗓';
        return {
          id: j.id,
          icon, color, paid,
          status: j.status,
          label: `${j.client_name} · ${j.service_name}`,
          date: fmtShort(j._date),
          amt: `+$${Number(j.total || 0).toFixed(0)}`,
        };
      });
  }, [allJobs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '12px 14px 14px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: -45, right: -25, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.22) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 9, padding: 3, marginBottom: 12 }}>
          {periods.map(p => (
            <div key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, textAlign: 'center', background: period === p ? '#E91E6A' : 'transparent', fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: period === p ? 'white' : 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>{p}</div>
          ))}
        </div>

        <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 4 }}>
          ✦ This {period}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 3 }}>
          {privacyOn
            ? <div style={{ fontFamily: T.serif, fontSize: 36, fontWeight: 500, letterSpacing: '-2px', color: 'white' }}>•••</div>
            : <div style={{ fontFamily: T.serif, fontSize: 36, fontWeight: 500, letterSpacing: '-2px', color: 'white', fontVariantNumeric: 'tabular-nums' }}>${periodTotal.toFixed(0)}</div>
          }
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
          {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'} this {period.toLowerCase()}
        </div>

        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 32 }}>
          {last7.map((b, i) => {
            const h = Math.round((b.total / maxBar) * 28) + 2;
            const isToday = i === 6;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', height: h, borderRadius: 4, background: isToday ? '#E91E6A' : 'rgba(255,255,255,0.15)' }} />
                <div style={{ fontFamily: T.font, fontSize: 7.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2px' }}>
                  {DOW[b.dow]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '11px 13px 8px' }}>
        {loading && (
          <div style={{ padding: '8px 0 12px', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>Loading…</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 11 }}>
          {[
            { label: 'Collected',    val: `$${collected.toFixed(0)}`,                     sub: `This ${period.toLowerCase()}`,         color: '#22C55E', bg: mode === 'dark' ? 'rgba(34,197,94,0.1)'   : '#F0FFF5', border: mode === 'dark' ? 'rgba(34,197,94,0.22)'   : '#86EFAC' },
            { label: 'Outstanding',  val: `$${outstanding.toFixed(0)}`,                   sub: `${outstandingCount} unpaid`,           color: '#E91E6A', bg: mode === 'dark' ? 'rgba(233,30,106,0.1)'  : '#FFF0F7', border: mode === 'dark' ? 'rgba(233,30,106,0.25)'  : '#FFD6E8', action: outstandingCount > 0 ? 'Nudge all' : null, onAction: () => setShowNudges(true) },
            { label: 'Hours est.',   val: `${hoursWorked.toFixed(1)}h`,                   sub: hourlyAvg > 0 ? `$${hourlyAvg.toFixed(0)} / hr avg` : 'no completed jobs', color: mode === 'dark' ? 'rgba(255,255,255,0.7)' : '#5A3040', bg: T.card, border: T.cardBorder },
            { label: 'Mileage',      val: '— km',                                         sub: 'Auto-tracking pending',                color: mode === 'dark' ? 'rgba(255,255,255,0.7)' : '#5A3040', bg: T.card, border: T.cardBorder },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '10px 11px' }}>
              <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 500, letterSpacing: '-0.4px', color: s.color, marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>
                {privacyOn && (i === 0 || i === 1) ? '•••' : s.val}
              </div>
              <div style={{ fontFamily: T.font, fontSize: 9.5, color: T.inkMuted }}>{s.sub}</div>
              {s.action && (
                <button 
                  onClick={s.onAction}
                  style={{ marginTop: 6, background: '#E91E6A', color: 'white', border: 'none', borderRadius: 6, padding: '4px 9px', fontFamily: T.font, fontSize: 9.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  {s.action}
                </button>
              )}
            </div>
          ))}
        </div>

        {outstandingCount > 0 && (
          <div style={{ background: T.hero, borderRadius: 12, padding: '11px 12px', position: 'relative', overflow: 'hidden', marginBottom: 11 }}>
            <div style={{ position: 'absolute', top: -15, right: -8, width: 70, height: 70, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.2) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 4 }}>✦ FINANCE INTEL</div>
            <div style={{ fontFamily: T.font, fontSize: 11.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, marginBottom: 9 }}>
              {outstandingCount} unpaid completed job{outstandingCount === 1 ? '' : 's'} totalling {privacyOn ? '•••' : `$${outstanding.toFixed(0)}`}. Want me to draft nudge texts?
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button 
                onClick={() => setShowNudges(true)}
                style={{ flex: 1, background: '#E91E6A', color: 'white', border: 'none', borderRadius: 8, padding: '8px 0', fontFamily: T.font, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Draft nudges
              </button>
              <button style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '8px 0', fontFamily: T.font, fontSize: 11, cursor: 'pointer' }}>Later</button>
            </div>
          </div>
        )}

        <SectionLabel>Recent Activity</SectionLabel>

        {transactions.length === 0 && (
          <div style={{ padding: '16px 0', textAlign: 'center', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>
            No jobs yet. Book one to see activity here.
          </div>
        )}

        {transactions.map(tx => {
          const tappable = !tx.paid && tx.status !== 'Cancelled';
          return (
            <div
              key={tx.id}
              onClick={tappable ? () => markPaid(tx.id) : undefined}
              style={{
                background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 11,
                padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9,
                cursor: tappable ? 'pointer' : 'default',
                opacity: busyId === tx.id ? 0.55 : 1,
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${tx.color}18`, border: `1px solid ${tx.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                {tx.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.serif, fontSize: 12.5, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</div>
                <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 1 }}>
                  {tx.date}{tappable ? ' · tap to mark paid' : ''}
                </div>
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: tx.color, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {privacyOn ? '•••' : tx.amt}
              </div>
            </div>
          );
        })}
      </div>

      <NudgeDraftSheet
        isOpen={showNudges}
        onClose={() => setShowNudges(false)}
        clientsWithUnpaid={clientsWithUnpaid}
      />
    </div>
  );
}
