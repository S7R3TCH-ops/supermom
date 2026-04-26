import { useMemo, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import SectionLabel from '../components/ui/SectionLabel';
import { useJobs, useExpenses, notifyDataChanged, useClients, useInvoices } from '../data/useData';
import { updateJob, recordPayment } from '../data/jobsRepo';
import { useFinanceDetailSheet } from '../context/FinanceDetailSheetContext';
import NudgeDraftSheet from '../components/sheets/NudgeDraftSheet';
import NewExpenseSheet from '../components/sheets/NewExpenseSheet';

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
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function generateCSV(jobs, expenses, start, end) {
  const s = new Date(start);
  const e = new Date(end + 'T23:59:59');
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [];

  jobs
    .filter(j => {
      const d = new Date(j.scheduled_at);
      return d >= s && d <= e && j.status !== 'Cancelled';
    })
    .forEach(j => rows.push({
      date: new Date(j.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }),
      type: 'Income', description: `${j.service_name} - ${j.client_name}`,
      amount: Number(j.total || 0).toFixed(2), category: '',
      status: j.payment_status === 'Paid' ? 'Paid' : 'Unpaid',
    }));

  expenses
    .filter(ex => !ex.deleted_at && new Date(ex.expense_date) >= s && new Date(ex.expense_date) <= e)
    .forEach(ex => rows.push({
      date: ex.expense_date, type: 'Expense',
      description: ex.notes || ex.category,
      amount: Number(ex.amount || 0).toFixed(2), category: ex.category, status: '',
    }));

  rows.sort((a, b) => new Date(a.date) - new Date(b.date));

  return [
    ['Date', 'Type', 'Description', 'Amount', 'Category', 'Status'].map(escape).join(','),
    ...rows.map(r => [r.date, r.type, r.description, r.amount, r.category, r.status].map(escape).join(',')),
  ].join('\n');
}

export default function Finance() {
  const { T, mode, privacyOn } = useAppTheme();
  const [period, setPeriod] = useState('Week');
  const [busyId, setBusyId] = useState(null);
  const [showNudges, setShowNudges] = useState(false);
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [csvStart, setCsvStart] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [csvEnd, setCsvEnd] = useState(todayISO);
  const { jobs: allJobs, loading, error } = useJobs();
  const { expenses: allExpenses } = useExpenses();
  const { clients } = useClients();
  const { invoices } = useInvoices();
  const { open: openDetail } = useFinanceDetailSheet();

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
  const collectedJobs = filtered.filter(j => j.payment_status === 'Paid');

  const outstanding = allJobs
    .filter(j => j.status === 'Completed' && j.payment_status !== 'Paid')
    .reduce((s, j) => s + Number(j.total || 0), 0);
  const outstandingJobs = allJobs.filter(j => j.status === 'Completed' && j.payment_status !== 'Paid');
  const outstandingCount = outstandingJobs.length;
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

  const expPeriodStart = periodStart(period, now);
  const periodExpList = allExpenses.filter(e => !e.deleted_at && new Date(e.expense_date) >= expPeriodStart);
  const periodExpenses = periodExpList.reduce((s, e) => s + Number(e.amount || 0), 0);

  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const ytdIncome = allJobs
    .filter(j => j.payment_status === 'Paid' && new Date(j.scheduled_at) >= ytdStart)
    .reduce((s, j) => s + Number(j.total || 0), 0);
  const ytdExpenses = allExpenses
    .filter(e => !e.deleted_at && new Date(e.expense_date) >= ytdStart)
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const ytdMileage = allJobs
    .filter(j => j.ai_context?.mileage_km && new Date(j.scheduled_at) >= ytdStart)
    .reduce((s, j) => s + Number(j.ai_context.mileage_km || 0), 0);

  function handleExport() {
    const csv = generateCSV(allJobs, allExpenses, csvStart, csvEnd);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supermom-${csvStart}-to-${csvEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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

  // Recent activity — jobs + expenses merged by date
  const transactions = useMemo(() => {
    const jobTx = allJobs
      .map(j => ({ ...j, _date: new Date(j.scheduled_at) }))
      .filter(j => !Number.isNaN(j._date.getTime()))
      .map(j => {
        const paid = j.payment_status === 'Paid';
        const completed = j.status === 'Completed';
        return {
          id: `job-${j.id}`,
          icon: paid ? '💚' : completed ? '🔴' : '🗓',
          color: paid ? '#22C55E' : completed ? '#E91E6A' : T.inkMuted,
          label: `${j.client_name} · ${j.service_name}`,
          date: fmtShort(j._date),
          amt: `+$${Number(j.total || 0).toFixed(0)}`,
          _date: j._date,
          type: 'job',
        };
      });

    const expTx = allExpenses
      .filter(e => !e.deleted_at)
      .map(e => ({
        id: `exp-${e.id}`,
        icon: '🧾',
        color: '#F59E0B',
        label: `${e.category} expense${e.notes ? ` · ${e.notes}` : ''}`,
        date: e.expense_date ? new Date(e.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }) : '—',
        amt: `-$${Number(e.amount || 0).toFixed(0)}`,
        _date: new Date(e.expense_date),
        type: 'expense',
      }));

    return [...jobTx, ...expTx]
      .sort((a, b) => b._date - a._date)
      .slice(0, 10);
  }, [allJobs, allExpenses, T.inkMuted]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '12px 14px 14px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: -45, right: -25, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(233,30,106,0.22) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 9, padding: 3, marginBottom: 12 }}>
          {periods.map(p => (
            <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p} style={{ flex: 1, padding: '6px 0', borderRadius: 7, textAlign: 'center', background: period === p ? '#E91E6A' : 'transparent', fontFamily: T.font, fontSize: 10.5, fontWeight: 600, color: period === p ? 'white' : 'rgba(255,255,255,0.45)', cursor: 'pointer', border: 'none' }}>{p}</button>
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

        {error && (
          <div style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, fontFamily: T.font, fontSize: 12, color: T.ink }}>
            {error.message || 'Could not load finance data.'}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 11 }}>
          {[
            { label: 'Collected',    val: `$${collected.toFixed(0)}`,       sub: `This ${period.toLowerCase()}`,         color: '#22C55E', bg: mode === 'dark' ? 'rgba(34,197,94,0.1)'  : '#F0FFF5', border: mode === 'dark' ? 'rgba(34,197,94,0.22)'  : '#86EFAC', onClick: () => openDetail(`Collected (${period})`, collectedJobs, 'jobs') },
            { label: 'Outstanding',  val: `$${outstanding.toFixed(0)}`,     sub: `${outstandingCount} unpaid`,           color: '#E91E6A', bg: mode === 'dark' ? 'rgba(233,30,106,0.1)' : '#FFF0F7', border: mode === 'dark' ? 'rgba(233,30,106,0.25)' : '#FFD6E8', action: outstandingCount > 0 ? 'Nudge all' : null, onAction: (e) => { e.stopPropagation(); setShowNudges(true); }, onClick: () => openDetail('Outstanding', outstandingJobs, 'jobs') },
            { label: 'Expenses',     val: `$${periodExpenses.toFixed(0)}`,  sub: `This ${period.toLowerCase()}`,         color: '#F59E0B', bg: mode === 'dark' ? 'rgba(245,158,11,0.1)' : '#FFFBEB', border: mode === 'dark' ? 'rgba(245,158,11,0.25)' : '#FCD34D', action: '+ Add', onAction: (e) => { e.stopPropagation(); setShowNewExpense(true); }, onClick: () => openDetail(`Expenses (${period})`, periodExpList, 'expenses') },
            { label: 'Hours / rate', val: `${hoursWorked.toFixed(1)}h`,     sub: hourlyAvg > 0 ? `$${hourlyAvg.toFixed(0)} / hr avg` : 'no completed jobs', color: mode === 'dark' ? 'rgba(255,255,255,0.7)' : '#5A3040', bg: T.card, border: T.cardBorder },
          ].map((s, i) => (
            <div key={i} onClick={s.onClick} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '10px 11px', cursor: s.onClick ? 'pointer' : 'default' }}>
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
          const tappable = tx.type === 'job' && !tx.paid && tx.status !== 'Cancelled';
          const rawJobId = tx.type === 'job' ? tx.id.replace('job-', '') : null;
          return (
            <div
              key={tx.id}
              onClick={tappable ? () => markPaid(rawJobId) : undefined}
              style={{
                background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 11,
                padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9,
                cursor: tappable ? 'pointer' : 'default',
                opacity: busyId === rawJobId ? 0.55 : 1,
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

        <SectionLabel>Formal Invoices</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
          {invoices.length === 0 ? (
            <div style={{ padding: '16px 0', textAlign: 'center', color: T.inkMuted, fontFamily: T.font, fontSize: 12 }}>
              No formal invoices yet.
            </div>
          ) : (
            invoices.slice(0, 5).map(inv => (
              <div
                key={inv.id}
                onClick={() => window.open(`/i/${inv.id}`, '_blank')}
                style={{
                  background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
                  padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer'
                }}
              >
                <div style={{ 
                  width: 32, height: 32, borderRadius: 8, background: inv.status === 'Paid' ? 'rgba(34,197,94,0.1)' : 'rgba(233,30,106,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                }}>
                  {inv.status === 'Paid' ? '✅' : '📄'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 500, color: T.ink }}>
                    {inv.clients?.first_name} {inv.clients?.last_name}
                  </div>
                  <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 2 }}>
                    {inv.invoice_number} · {inv.invoice_date}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 600, color: T.ink }}>
                    ${Number(inv.total_amount).toFixed(0)}
                  </div>
                  <div style={{ 
                    fontFamily: T.font, fontSize: 8.5, fontWeight: 700, 
                    color: inv.status === 'Paid' ? '#22C55E' : '#E91E6A', 
                    textTransform: 'uppercase', marginTop: 2 
                  }}>
                    {inv.status}
                  </div>
                </div>
              </div>
            ))
          )}
          {invoices.length > 5 && (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <button style={{ background: 'none', border: 'none', color: T.pink, fontFamily: T.font, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                View all {invoices.length} invoices
              </button>
            </div>
          )}
        </div>

        {/* Tax Ready */}
        <SectionLabel>Tax Ready · {now.getFullYear()}</SectionLabel>
        <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 }}>
            {[
              { l: 'YTD Income',   v: `$${ytdIncome.toFixed(0)}`,                    c: '#22C55E' },
              { l: 'Deductibles',  v: `$${ytdExpenses.toFixed(0)}`,                   c: '#F59E0B' },
              { l: 'Mileage',      v: ytdMileage > 0 ? `${ytdMileage.toFixed(1)} km` : '— km', c: T.inkSub },
              { l: 'Est. Taxable', v: `$${Math.max(0, ytdIncome - ytdExpenses).toFixed(0)}`, c: T.ink },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center', padding: '9px 6px', background: T.bg, borderRadius: 10, border: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500, color: s.c, fontVariantNumeric: 'tabular-nums' }}>
                  {privacyOn ? '•••' : s.v}
                </div>
                <div style={{ fontFamily: T.font, fontSize: 8.5, fontWeight: 700, color: T.inkMuted, letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: T.inkMuted, marginBottom: 8 }}>Export range</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
            {[{ label: 'From', val: csvStart, set: setCsvStart }, { label: 'To', val: csvEnd, set: setCsvEnd }].map(f => (
              <div key={f.label} style={{ background: T.bg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ fontFamily: T.font, fontSize: 8.5, color: T.inkMuted, marginBottom: 3 }}>{f.label}</div>
                <input type="date" value={f.val} onChange={e => f.set(e.target.value)}
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: T.font, fontSize: 12, fontWeight: 500, color: T.ink, width: '100%' }} />
              </div>
            ))}
          </div>

          <button onClick={handleExport} style={{
            width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
            background: '#1A0A12', color: 'white',
            fontFamily: T.font, fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.2px',
          }}>
            Export CSV ↓
          </button>
        </div>
      </div>  {/* end sm-scroll */}

      <NudgeDraftSheet
        isOpen={showNudges}
        onClose={() => setShowNudges(false)}
        clientsWithUnpaid={clientsWithUnpaid}
      />

      <NewExpenseSheet
        isOpen={showNewExpense}
        onClose={() => setShowNewExpense(false)}
      />
    </div>
  );
}
