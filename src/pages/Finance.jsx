import { memo, useCallback, useMemo, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import { Title, Subheading, Text, Caption, SectionLabel } from '../components/ui/typography';
import { useJobs, useExpenses, useInvoices } from '../data/useData';
import { useFinanceDetailSheet } from '../context/FinanceDetailSheetContext';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import NewExpenseSheet from '../components/sheets/NewExpenseSheet';
import AmtCell from '../components/ui/AmtCell';
import { EmptyActivity, NoResults } from '../components/ui/Illustrations';

const periods = ['Week', 'Month', 'Year', 'All'];

const STATUS_PILL = {
  paid:      { bg: '#DCFCE7', color: '#14532D', label: 'Paid ✓' },
  partial:   { bg: '#FEF3C7', color: '#92400E', label: 'Partial' },
  unpaid:    { bg: '#FFE0EC', color: '#9B0D3A', label: 'Unpaid' },
  scheduled: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Scheduled' },
  cancelled: { bg: '#F3F4F6', color: '#4B5563', label: 'Cancelled' },
};

const TransactionRow = memo(function TransactionRow({ tx, T, privacyOn, onPress }) {
  const isJob = tx.type === 'job';
  const tappable = isJob && tx.status !== 'Cancelled';

  const pillKey = isJob
    ? tx.isPaid ? 'paid'
    : tx.isPartial ? 'partial'
    : tx.status === 'Cancelled' ? 'cancelled'
    : tx.status === 'Completed' ? 'unpaid'
    : 'scheduled'
    : null;
  const pill = pillKey ? STATUS_PILL[pillKey] : null;

  return (
    <div
      onClick={tappable ? () => onPress(tx.rawId) : undefined}
      style={{
        background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 11,
        padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9,
        cursor: tappable ? 'pointer' : 'default',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${tx.color}18`, border: `1px solid ${tx.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
        {tx.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.serif, fontSize: 12.5, fontWeight: 500, color: T.ink, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <span style={{ fontSize: 10, color: T.inkMuted, fontWeight: 500 }}>{tx.dateBrief}</span>
          {pill && (
            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: pill.bg, color: pill.color, textTransform: 'uppercase' }}>
              {pill.label}
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <AmtCell amount={tx.amount} T={T} privacyOn={privacyOn} style={{ fontSize: 14, fontWeight: 600, color: tx.type === 'expense' ? '#EF4444' : T.ink }} />
        {tx.isPartial && !privacyOn && (
          <div style={{ fontSize: 9, color: T.inkMuted, fontWeight: 500, marginTop: 1 }}>
            of ${tx.total}
          </div>
        )}
      </div>
    </div>
  );
});

export default function Finance() {
  const { T, mode, privacyOn } = useAppTheme();
  const { jobs: allJobs, loading } = useJobs();
  const { expenses: allExpenses } = useExpenses();
  const { invoices } = useInvoices();
  const { openJob } = useJobDetailSheet();
  const { open: openFinanceDetail } = useFinanceDetailSheet();

  const [period, setPeriod] = useState('Month');
  const [showNewExpense, setShowNewExpense] = useState(false);

  // Stabilize "now" for memoization
  const now = useMemo(() => new Date(), []);

  const stats = useMemo(() => {
    const jobs = (allJobs || []).filter(j => j.job_status === 'Completed');
    const revenue = jobs.reduce((s, j) => s + Number(j.total_amount || 0), 0);
    const outstanding = (allJobs || [])
      .filter(j => j.job_status === 'Completed' && j.payment_status !== 'Paid')
      .reduce((s, j) => s + Number(j.total_amount || 0), 0);
    const expenses = (allExpenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthRevenue = jobs
      .filter(j => {
        const d = new Date(j.scheduled_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((s, j) => s + Number(j.total_amount || 0), 0);

    return { revenue, monthRevenue, outstanding, expenses, profit: revenue - expenses };
  }, [allJobs, allExpenses, now]);

  const chartData = useMemo(() => {
    const data = [
      { label: 'Mon', value: 120 },
      { label: 'Tue', value: 340 },
      { label: 'Wed', value: 200 },
      { label: 'Thu', value: 450 },
      { label: 'Fri', value: 300 },
      { label: 'Sat', value: 0 },
      { label: 'Sun', value: 0 },
    ];
    return data;
  }, []);

  const handleJobPress = useCallback((id) => openJob(id), [openJob]);

  const transactions = useMemo(() => {
    const jobTx = (allJobs || [])
      .map(j => ({
        type: 'job',
        rawId: j.id,
        label: j.client_name || 'Unnamed Client',
        amount: Number(j.total_amount || 0),
        total: Number(j.total || 0),
        _date: new Date(j.scheduled_at),
        dateBrief: new Date(j.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        status: j.job_status,
        isPaid: j.payment_status === 'Paid',
        isPartial: j.payment_status === 'Partial',
        icon: '💰',
        color: '#E91E6A'
      }));

    const expTx = (allExpenses || [])
      .map(e => ({
        type: 'expense',
        rawId: e.id,
        label: e.description || 'Expense',
        amount: Number(e.amount || 0),
        _date: new Date(e.created_at),
        dateBrief: new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        icon: '💸',
        color: '#6B7280'
      }));

    return [...jobTx, ...expTx]
      .sort((a, b) => b._date - a._date);
  }, [allJobs, allExpenses]);

  if (loading && (!allJobs || allJobs.length === 0)) {
    return <div style={{ padding: 20, background: T.bg, color: T.inkMuted }}>Loading finances…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      {/* Hero */}
      <div style={{ 
        background: T.hero, 
        borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none', 
        padding: '13px 15px 15px', 
        position: 'relative', 
        overflow: 'hidden' 
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 180, height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 65%)`,
          pointerEvents: 'none',
        }} />

        <div style={{
          fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px',
          textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 10,
          position: 'relative'
        }}>✦ Financial Command</div>

        <h2 style={{ fontFamily: T.serif, fontSize: 24, margin: 0, color: mode === 'dark' ? 'white' : T.ink, position: 'relative' }}>
          Revenue & Expenses
        </h2>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <StatCard 
            T={T} 
            label="Total Revenue" 
            value={stats.revenue} 
            color={T.pink} 
            privacyOn={privacyOn}
            onClick={() => openFinanceDetail('revenue')}
          />
          <StatCard 
            T={T} 
            label="Expenses" 
            value={stats.expenses} 
            color="#6B7280" 
            privacyOn={privacyOn}
            onClick={() => openFinanceDetail('expenses')}
          />
          <StatCard 
            T={T} 
            label="Outstanding" 
            value={stats.outstanding} 
            color="#F59E0B" 
            privacyOn={privacyOn}
            onClick={() => openFinanceDetail('outstanding')}
          />
          <StatCard 
            T={T} 
            label="Est. Profit" 
            value={stats.profit} 
            color="#10B981" 
            privacyOn={privacyOn}
            onClick={() => openFinanceDetail('profit')}
          />
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', background: T.card, borderRadius: 12, padding: 4, marginBottom: 20, border: `1px solid ${T.cardBorder}` }}>
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                background: period === p ? (mode === 'dark' ? 'rgba(255,255,255,0.1)' : T.pinkPale) : 'transparent',
                color: period === p ? T.pink : T.inkMuted,
                fontFamily: T.font, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Simple Bar Chart placeholder */}
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, gap: 8 }}>
            {chartData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: '100%', background: i === 3 ? T.pink : T.pinkTint, borderRadius: '4px 4px 0 0', height: `${(d.value / 500) * 100}%`, minHeight: 4 }} />
                <div style={{ fontSize: 9, fontWeight: 700, color: T.inkMuted }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <SectionLabel style={{ marginBottom: 0 }}>Recent Activity</SectionLabel>
          <button 
            onClick={() => setShowNewExpense(true)}
            style={{ background: 'transparent', border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: T.pink, cursor: 'pointer' }}
          >
            + ADD EXPENSE
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <EmptyActivity size={80} />
              <div style={{ marginTop: 12, fontSize: 13, color: T.inkMuted }}>No transactions found.</div>
            </div>
          ) : (
            transactions.slice(0, 15).map((tx, i) => (
              <TransactionRow key={`${tx.type}-${tx.rawId}-${i}`} tx={tx} T={T} privacyOn={privacyOn} onPress={handleJobPress} />
            ))
          )}
        </div>

        <SectionLabel>Formal Invoices</SectionLabel>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 14, marginBottom: 24 }}>
          {invoices && invoices.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {invoices.slice(0, 3).map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>INV-{inv.invoice_number}</div>
                    <div style={{ fontSize: 10, color: T.inkMuted }}>{new Date(inv.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>${Number(inv.total_amount).toFixed(2)}</div>
                    <div style={{ fontSize: 9, color: inv.status === 'Paid' ? '#10B981' : '#F59E0B', fontWeight: 700 }}>{inv.status.toUpperCase()}</div>
                  </div>
                </div>
              ))}
              <button style={{ width: '100%', marginTop: 8, background: 'transparent', border: 'none', color: T.pink, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>VIEW ALL INVOICES ›</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <NoResults size={50} />
              <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 10 }}>No formal invoices generated yet.</div>
            </div>
          )}
        </div>

        <SectionLabel>Tax Ready · {now.getFullYear()}</SectionLabel>
        <div style={{
          background: mode === 'dark' ? '#1C1C1E' : '#FDF2F8',
          border: `1.5px solid ${mode === 'dark' ? '#8B0E3F' : '#F9A8D4'}`,
          borderRadius: 16, padding: '16px', marginBottom: 30
        }}>
          <div style={{ fontSize: 11, color: T.pink, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>✦ CSV Export Ready</div>
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.4, marginBottom: 16 }}>
            Download your full financial history for the current year, categorized for easy tax filing.
          </div>
          <button style={{
            width: '100%', padding: '12px', borderRadius: 12,
            background: T.pink, color: 'white', border: 'none',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(233,30,106,0.2)'
          }}>
            Download 2026 CSV
          </button>
        </div>
      </div>

      <NewExpenseSheet isOpen={showNewExpense} onClose={() => setShowNewExpense(false)} />
    </div>
  );
}

function StatCard({ T, label, value, color, privacyOn, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        background: T.card, border: `1.5px solid ${T.cardBorder}`,
        borderRadius: 15, padding: '14px 12px', cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.1s active',
      }}
    >
      <div style={{ fontSize: 10, color: T.inkMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: color }}>$</span>
        <span style={{ fontSize: 22, fontWeight: 500, color: T.ink, fontFamily: T.serif, fontVariantNumeric: 'tabular-nums' }}>
          {privacyOn ? '•••' : Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
