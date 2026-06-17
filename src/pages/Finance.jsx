import { memo, useCallback, useMemo, useState } from 'react';
import { useAppTheme } from '../context/AppThemeContext';
import { SectionLabel } from '../components/ui/typography';
import { useJobs, useExpenses, useInvoices, useBusiness } from '../data/useData';
import { useFinanceDetailSheet } from '../context/FinanceDetailSheetContext';
import { useJobDetailSheet } from '../context/JobDetailSheetContext';
import { computeJobFinancials } from '../lib/financialMath';
import NewExpenseSheet from '../components/sheets/NewExpenseSheet';
import AmtCell from '../components/ui/AmtCell';
import { EmptyActivity, NoResults } from '../components/ui/Illustrations';

const periods = ['Week', 'Month', 'Year', 'All'];

const STATUS_PILL = {
  paid:      { bg: '#DCFCE7', color: '#14532D', label: 'Paid ✓' },
  partial:   { bg: '#FEF3C7', color: '#92400E', label: 'Partial' },
  unpaid:    { bg: '#FFE0EC', color: '#9B0D3A', label: 'Unpaid' },
  scheduled: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Scheduled' },
  cancelled: { bg: '#E5E7EB', color: '#374151', label: 'Cancelled' },
};

// Parse a date value — handles YYYY-MM-DD strings as local dates (not UTC)
function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPeriodRange(period) {
  const now = new Date();
  if (period === 'All') return null;
  if (period === 'Week') {
    const start = getMondayOfWeek(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === 'Month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }
  if (period === 'Year') {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }
  return null;
}

function filterByPeriod(items, range, dateField) {
  if (!range) return items;
  return items.filter(item => {
    const raw = item[dateField] ?? item.raw?.[dateField];
    const d = parseDate(raw);
    if (!d) return false;
    return d >= range.start && d <= range.end;
  });
}

function computeChartBuckets(period, completedJobs, expenses) {
  const now = new Date();
  let buckets = [];

  if (period === 'Week') {
    const monday = getMondayOfWeek(now);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      buckets.push({
        label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
      });
    }
  } else if (period === 'Month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let ws = new Date(monthStart);
    let wn = 1;
    while (ws <= monthEnd) {
      const we = new Date(ws);
      we.setDate(ws.getDate() + 7);
      buckets.push({ label: `Wk${wn}`, start: new Date(ws), end: we });
      ws.setDate(ws.getDate() + 7);
      wn++;
    }
  } else if (period === 'Year') {
    for (let m = 0; m < 12; m++) {
      buckets.push({
        label: new Date(now.getFullYear(), m, 1).toLocaleDateString('en-US', { month: 'short' }),
        start: new Date(now.getFullYear(), m, 1),
        end: new Date(now.getFullYear(), m + 1, 1),
      });
    }
  } else {
    const allDates = [
      ...completedJobs.map(j => parseDate(j.scheduled_at || j.raw?.scheduled_at)),
      ...expenses.map(e => parseDate(e.expense_date || e.created_at)),
    ].filter(Boolean);
    if (allDates.length === 0) return [];
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const stop = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1);
    while (cur < stop) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      buckets.push({
        label: cur.toLocaleDateString('en-US', { month: 'short' }),
        start: new Date(cur),
        end: next,
      });
      cur = next;
    }
  }

  return buckets.map(b => ({
    label: b.label,
    revenue: completedJobs
      .filter(j => { const d = parseDate(j.scheduled_at || j.raw?.scheduled_at); return d && d >= b.start && d < b.end; })
      .reduce((s, j) => s + computeJobFinancials(j).total, 0),
    expenses: expenses
      .filter(e => { const d = parseDate(e.expense_date || e.created_at); return d && d >= b.start && d < b.end; })
      .reduce((s, e) => s + Number(e.amount || 0), 0),
  }));
}

const TrendChart = memo(function TrendChart({ data, T, mode }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.inkMuted, fontSize: 11 }}>
        Not enough data for this period
      </div>
    );
  }

  const W = 300;
  const H = 90;
  const PAD = { t: 8, r: 8, b: 18, l: 8 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;

  const allVals = data.flatMap(d => [d.revenue, d.expenses]);
  const maxVal = Math.max(...allVals, 1);

  const xi = i => PAD.l + (i / Math.max(data.length - 1, 1)) * cW;
  const yi = v => PAD.t + cH - (Math.min(v, maxVal) / maxVal) * cH;

  const revPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xi(i).toFixed(1)} ${yi(d.revenue).toFixed(1)}`).join(' ');
  const expPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xi(i).toFixed(1)} ${yi(d.expenses).toFixed(1)}`).join(' ');
  const revArea = `${revPath} L ${xi(data.length - 1).toFixed(1)} ${(PAD.t + cH).toFixed(1)} L ${xi(0).toFixed(1)} ${(PAD.t + cH).toFixed(1)} Z`;
  const expArea = `${expPath} L ${xi(data.length - 1).toFixed(1)} ${(PAD.t + cH).toFixed(1)} L ${xi(0).toFixed(1)} ${(PAD.t + cH).toFixed(1)} Z`;

  const gridColor = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  const showLabel = i => {
    if (data.length <= 12) return true;
    return i % Math.ceil(data.length / 8) === 0 || i === data.length - 1;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 6, paddingLeft: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 14, height: 2.5, borderRadius: 2, background: '#E91E6A' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Revenue</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 14, height: 2.5, borderRadius: 2, background: '#6B7280' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Expenses</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 100, display: 'block' }}>
        <defs>
          <linearGradient id="fc-rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E91E6A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#E91E6A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fc-exp-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B7280" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#6B7280" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.33, 0.67, 1].map((pct, gi) => (
          <line
            key={gi}
            x1={PAD.l} y1={PAD.t + cH * (1 - pct)}
            x2={PAD.l + cW} y2={PAD.t + cH * (1 - pct)}
            stroke={gridColor} strokeWidth="1"
          />
        ))}
        <path d={expArea} fill="url(#fc-exp-grad)" />
        <path d={revArea} fill="url(#fc-rev-grad)" />
        <path d={expPath} fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={revPath} fill="none" stroke="#E91E6A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => showLabel(i) && (
          <text
            key={i}
            x={xi(i).toFixed(1)}
            y={H - 2}
            textAnchor="middle"
            fontSize="8"
            fill={T.inkMuted}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
});

const TransactionRow = memo(function TransactionRow({ tx, T, privacyOn, onPress }) {
  const isJob = tx.type === 'job';
  const isWorkerCost = tx.type === 'worker_cost';
  const tappable = isJob && tx.status !== 'Cancelled';

  const pillKey = isJob
    ? tx.isPaid ? 'paid'
    : tx.isPartial ? 'partial'
    : tx.status === 'Cancelled' ? 'cancelled'
    : tx.status === 'Completed' ? 'unpaid'
    : 'scheduled'
    : null;
  const pill = pillKey ? STATUS_PILL[pillKey] : null;
  const workerPill = isWorkerCost
    ? tx.workerPaid
      ? { bg: '#DCFCE7', color: '#14532D', label: 'Paid ✓' }
      : { bg: '#FEF3C7', color: '#92400E', label: 'Unpaid' }
    : null;

  const Tag = tappable ? 'button' : 'div';
  const tagProps = tappable
    ? { type: 'button', onClick: () => onPress(tx.rawId), 'aria-label': `Open job: ${tx.label}` }
    : {};

  return (
    <Tag
      {...tagProps}
      style={{
        background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 11,
        padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9,
        cursor: tappable ? 'pointer' : 'default',
        width: '100%', textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
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
          {workerPill && (
            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: workerPill.bg, color: workerPill.color, textTransform: 'uppercase' }}>
              {workerPill.label}
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <AmtCell amount={tx.amount} T={T} privacyOn={privacyOn} style={{ fontSize: 14, fontWeight: 600, color: (tx.type === 'expense' || tx.type === 'worker_cost') ? '#EF4444' : T.ink }} />
        {tx.isPartial && !privacyOn && (
          <div style={{ fontSize: 9, color: T.inkMuted, fontWeight: 500, marginTop: 1 }}>
            of ${tx.total}
          </div>
        )}
      </div>
    </Tag>
  );
});

export default function Finance() {
  const { T, mode, privacyOn } = useAppTheme();
  const { jobs: allJobs, loading } = useJobs();
  const { expenses: allExpenses } = useExpenses();
  const { invoices } = useInvoices();
  const { openJob } = useJobDetailSheet();
  const { open: openFinanceDetail } = useFinanceDetailSheet();

  const { business } = useBusiness();
  const [period, setPeriod] = useState('Month');
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [showTaxReady, setShowTaxReady] = useState(false);
  const [showMileage, setShowMileage] = useState(false);

  const now = useMemo(() => new Date(), []);
  const periodRange = useMemo(() => getPeriodRange(period), [period]);

  const periodJobs = useMemo(
    () => filterByPeriod(allJobs || [], periodRange, 'scheduled_at'),
    [allJobs, periodRange],
  );
  const periodExpenses = useMemo(
    () => filterByPeriod(allExpenses || [], periodRange, 'expense_date'),
    [allExpenses, periodRange],
  );
  const completedPeriodJobs = useMemo(
    () => periodJobs.filter(j => j.status === 'Completed'),
    [periodJobs],
  );

  // Annotated job items ready to pass to the detail sheet
  const revenueItems = useMemo(() => completedPeriodJobs.map(j => ({
    ...j.raw,
    client_name: j.client_name,
    total: computeJobFinancials(j).total,
  })), [completedPeriodJobs]);

  const outstandingItems = useMemo(() =>
    completedPeriodJobs
      .filter(j => j.payment_status !== 'Paid')
      .map(j => {
        const total = computeJobFinancials(j).total;
        const owing = Math.max(0, total - (j.amount_paid || 0));
        return { ...j.raw, client_name: j.client_name, total: owing };
      }),
    [completedPeriodJobs],
  );

  const workerCostItems = useMemo(() =>
    completedPeriodJobs
      .filter(j => Number(j.raw?.worker_pay) > 0)
      .map(j => ({
        ...j.raw,
        client_name: j.client_name,
        worker_name: j.worker_name,
        amount: Number(j.raw.worker_pay),
        worker_paid: j.raw.worker_paid ?? false,
        _itemType: 'worker_cost',
      })),
    [completedPeriodJobs],
  );

  const stats = useMemo(() => {
    const revenue = revenueItems.reduce((s, j) => s + j.total, 0);
    const outstanding = outstandingItems.reduce((s, j) => s + j.total, 0);
    const expenses = periodExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const workerCosts = workerCostItems.reduce((s, w) => s + w.amount, 0);
    return { revenue, outstanding, expenses, workerCosts, profit: revenue - expenses - workerCosts };
  }, [revenueItems, outstandingItems, periodExpenses, workerCostItems]);

  const chartData = useMemo(
    () => computeChartBuckets(period, completedPeriodJobs, periodExpenses),
    [period, completedPeriodJobs, periodExpenses],
  );

  const mileageEnabled = business?.ai_profile?.mileage_tracking ?? false;
  const craRate = business?.ai_profile?.mileage_rate_per_km ?? 0.70;

  const mileageStats = useMemo(() => {
    if (!mileageEnabled) return null;
    const rows = completedPeriodJobs
      .filter(j => j.raw?.distance_to_km != null || j.raw?.distance_home_km != null)
      .map(j => ({
        date: j.raw?.scheduled_date || '',
        client: j.client_name || '',
        service: j.raw?.service_name || '',
        to_km: Number(j.raw?.distance_to_km || 0),
        home_km: Number(j.raw?.distance_home_km || 0),
      }));
    const totalKm = rows.reduce((s, r) => s + r.to_km + r.home_km, 0);
    return { rows, totalKm, deductible: totalKm * craRate };
  }, [completedPeriodJobs, mileageEnabled, craRate]);

  const transactions = useMemo(() => {
    const jobTx = periodJobs.map(j => {
      const computed = computeJobFinancials(j);
      return {
        type: 'job',
        rawId: j.id,
        label: j.client_name,
        amount: computed.total,
        total: computed.total,
        _date: parseDate(j.scheduled_at) || new Date(0),
        dateBrief: (parseDate(j.scheduled_at) || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        status: j.status,
        isPaid: j.payment_status === 'Paid',
        isPartial: j.payment_status === 'Partial',
        icon: '💰',
        color: '#E91E6A',
      };
    });
    const expTx = periodExpenses.map(e => ({
      type: 'expense',
      rawId: e.id,
      label: e.description || e.category || 'Expense',
      amount: Number(e.amount || 0),
      _date: parseDate(e.expense_date || e.created_at) || new Date(0),
      dateBrief: (parseDate(e.expense_date || e.created_at) || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      icon: '💸',
      color: '#6B7280',
    }));
    const workerTx = workerCostItems.map(w => ({
      type: 'worker_cost',
      rawId: w.id,
      label: `${w.worker_name || 'Worker'} — ${w.client_name}`,
      amount: w.amount,
      workerPaid: w.worker_paid,
      _date: parseDate(w.scheduled_at) || new Date(0),
      dateBrief: (parseDate(w.scheduled_at) || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      icon: '👷',
      color: '#F59E0B',
    }));
    return [...jobTx, ...expTx, ...workerTx].sort((a, b) => b._date - a._date);
  }, [periodJobs, periodExpenses, workerCostItems]);

  const periodLabel = useMemo(() => ({
    Week: 'This Week', Month: 'This Month', Year: 'This Year', All: 'All Time',
  }[period] || period), [period]);

  const handleJobPress = useCallback(id => openJob(id), [openJob]);

  const handleStatClick = useCallback(type => {
    if (type === 'revenue') {
      openFinanceDetail(`Revenue · ${periodLabel}`, revenueItems, 'jobs');
    } else if (type === 'expenses') {
      openFinanceDetail(`Expenses · ${periodLabel}`, periodExpenses, 'expenses');
    } else if (type === 'outstanding') {
      openFinanceDetail(`Outstanding · ${periodLabel}`, outstandingItems, 'jobs');
    } else if (type === 'profit') {
      const mixed = [
        ...revenueItems.map(j => ({ ...j, _itemType: 'revenue' })),
        ...periodExpenses.map(e => ({ ...e, _itemType: 'expense' })),
        ...workerCostItems,
      ].sort((a, b) => {
        const da = parseDate(a.scheduled_at || a.expense_date || a.created_at) || new Date(0);
        const db = parseDate(b.scheduled_at || b.expense_date || b.created_at) || new Date(0);
        return db - da;
      });
      openFinanceDetail(`Profit Breakdown · ${periodLabel}`, mixed, 'profit');
    }
  }, [revenueItems, outstandingItems, periodExpenses, workerCostItems, periodLabel, openFinanceDetail]);

  if (loading && (!allJobs || allJobs.length === 0)) {
    return <FinanceSkeleton T={T} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, color: T.ink }}>
      <div style={{
        background: T.hero,
        borderBottom: mode === 'dark' ? '3px solid #E91E6A' : 'none',
        padding: '13px 15px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 180, height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle,${T.pinkGlow} 0%,transparent 65%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px',
          textTransform: 'uppercase', color: mode === 'dark' ? '#FF78B0' : T.pink, marginBottom: 8,
          position: 'relative',
        }}>✦ Financial Command</div>
        <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: mode === 'dark' ? 'rgba(255,255,255,0.5)' : T.inkMuted, marginBottom: 4, position: 'relative' }}>
          {periodLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, position: 'relative' }}>
          <span style={{ fontFamily: T.serif, fontSize: 38, fontWeight: 500, color: mode === 'dark' ? 'white' : T.ink, letterSpacing: '-1.5px', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {privacyOn ? '•••' : `$${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, position: 'relative', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: mode === 'dark' ? 'rgba(255,255,255,0.45)' : T.inkMuted, fontWeight: 500 }}>
            {completedPeriodJobs.length} job{completedPeriodJobs.length !== 1 ? 's' : ''}
          </span>
          {stats.profit !== stats.revenue && (
            <span style={{ fontSize: 10, color: stats.profit >= 0 ? (mode === 'dark' ? '#86EFAC' : '#16A34A') : '#EF4444', fontWeight: 600 }}>
              {privacyOn ? '•••' : `You cleared $${Math.abs(stats.profit).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} after expenses`}
            </span>
          )}
        </div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        {/* Period Selector */}
        <div style={{ display: 'flex', background: '#2C2C2E', borderRadius: 12, padding: 3, marginBottom: 16 }}>
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 9, border: 'none',
                background: period === p ? T.pink : 'transparent',
                color: period === p ? 'white' : 'rgba(255,255,255,0.55)',
                fontFamily: T.font, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <StatCard T={T} mode={mode} label="Total Revenue" value={stats.revenue} color={T.pink} privacyOn={privacyOn} onClick={() => handleStatClick('revenue')} count={revenueItems.length} />
          <StatCard T={T} mode={mode} label="Expenses" value={stats.expenses} color="#6B7280" privacyOn={privacyOn} onClick={() => handleStatClick('expenses')} count={periodExpenses.length} />
          <StatCard T={T} mode={mode} label="Outstanding" value={stats.outstanding} color="#F59E0B" privacyOn={privacyOn} onClick={() => handleStatClick('outstanding')} count={outstandingItems.length} />
          <StatCard T={T} mode={mode} label="Profit" value={stats.profit} color="#10B981" privacyOn={privacyOn} onClick={() => handleStatClick('profit')} workerCosts={stats.workerCosts} />
        </div>

        {/* Trend Chart */}
        <div style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: '14px 14px 10px', marginBottom: 24 }}>
          <TrendChart data={chartData} T={T} mode={mode} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <SectionLabel style={{ marginBottom: 0 }}>Activity · {periodLabel}{transactions.length > 0 ? ` · ${transactions.length}` : ''}</SectionLabel>
          <button
            type="button"
            onClick={() => setShowNewExpense(true)}
            style={{ background: 'transparent', border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: '6px 12px', fontSize: 10, fontWeight: 700, color: T.pink, cursor: 'pointer', minHeight: 32 }}
          >
            + Add expense
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <EmptyActivity size={80} />
              <div style={{ marginTop: 12, fontSize: 13, color: T.inkMuted }}>No transactions for this period.</div>
            </div>
          ) : (
            transactions.map((tx, i) => (
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
                    <div style={{ fontSize: 9, color: inv.status === 'Paid' ? '#14532D' : '#FC4693', fontWeight: 700, background: inv.status === 'Paid' ? '#DCFCE7' : '#FFEFF4', padding: '2px 6px', borderRadius: 4, display: 'inline-block', letterSpacing: '0.4px' }}>{inv.status.toUpperCase()}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 10, color: T.inkMuted, textAlign: 'center', padding: '4px 0' }}>Showing {Math.min(invoices.length, 3)} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <NoResults size={50} />
              <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 10 }}>No formal invoices generated yet.</div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowTaxReady(v => !v)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showTaxReady ? 8 : 28 }}
        >
          <SectionLabel style={{ marginBottom: 0 }}>Tax Ready · {now.getFullYear()}</SectionLabel>
          <span style={{ fontSize: 10, color: T.inkMuted, fontWeight: 600, transform: showTaxReady ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
        </button>
        {showTaxReady && (
          <div style={{
            background: mode === 'dark' ? '#1C1C1E' : '#FDF2F8',
            border: `1.5px solid ${mode === 'dark' ? '#8B0E3F' : '#F9A8D4'}`,
            borderRadius: 16, padding: '16px', marginBottom: 30,
          }}>
            <div style={{ fontSize: 11, color: T.pink, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>✦ CSV Export</div>
            <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.4, marginBottom: 16 }}>
              Download your financial history for the selected period, including sidekick pay and HST, categorized for tax filing.
            </div>
            <button
              type="button"
              onClick={() => {
                const rows = [
                  ['Date', 'Client', 'Service', 'Pricing', 'Duration (hrs)', 'Subtotal', 'HST', 'Total', 'Payment Method', 'Payment Status', 'Sidekick', 'Sidekick Pay', 'Sidekick Paid'],
                ];
                completedPeriodJobs.forEach(j => {
                  const f = computeJobFinancials(j);
                  rows.push([
                    j.raw?.scheduled_date || '',
                    j.client_name || '',
                    j.raw?.service_name || '',
                    j.raw?.pricing_type || '',
                    j.raw?.actual_duration ?? j.raw?.estimated_hours ?? '',
                    f.subtotal.toFixed(2),
                    f.taxAmount.toFixed(2),
                    f.total.toFixed(2),
                    j.raw?.payment_method || '',
                    j.raw?.payment_status || '',
                    j.worker_name || '',
                    j.raw?.worker_pay != null ? Number(j.raw.worker_pay).toFixed(2) : '',
                    j.raw?.worker_paid ? 'Yes' : (j.raw?.worker_pay != null ? 'No' : ''),
                  ]);
                });
                const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Supermom_${period === 'All' ? 'AllTime' : period}_${now.getFullYear()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: T.pink, color: 'white', border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Download {period} CSV ({completedPeriodJobs.length} jobs)
            </button>
          </div>
        )}

        {mileageEnabled && mileageStats && (
          <>
            <button
              type="button"
              onClick={() => setShowMileage(v => !v)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showMileage ? 8 : 28 }}
            >
              <SectionLabel style={{ marginBottom: 0 }}>Mileage Deductions · {periodLabel}</SectionLabel>
              <span style={{ fontSize: 10, color: T.inkMuted, fontWeight: 600, transform: showMileage ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
            </button>
            {showMileage && (
              <div style={{
                background: mode === 'dark' ? '#1C1C1E' : '#F0FDF4',
                border: `1.5px solid ${mode === 'dark' ? '#14532D' : '#86EFAC'}`,
                borderRadius: 16, padding: '16px', marginBottom: 30,
              }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: T.inkMuted, marginBottom: 4 }}>Total km</div>
                    <div style={{ fontSize: 22, fontWeight: 500, fontFamily: T.serif, color: T.ink }}>{mileageStats.totalKm.toFixed(1)}</div>
                    <div style={{ fontSize: 9, color: T.inkMuted, marginTop: 2 }}>{mileageStats.rows.length} job{mileageStats.rows.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ flex: 1, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: T.inkMuted, marginBottom: 4 }}>Deductible</div>
                    <div style={{ fontSize: 22, fontWeight: 500, fontFamily: T.serif, color: '#16A34A' }}>${mileageStats.deductible.toFixed(2)}</div>
                    <div style={{ fontSize: 9, color: T.inkMuted, marginTop: 2 }}>@ ${Number(craRate).toFixed(2)}/km</div>
                  </div>
                </div>
                {mileageStats.rows.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.inkMuted, textAlign: 'center', padding: '8px 0' }}>
                    No km data for this period. Drive times are calculated automatically when Google Maps is active.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const csvRows = [
                        ['Date', 'Client', 'Service', 'To Client (km)', 'Home (km)', 'Total (km)', `Rate ($/km)`, 'Deductible ($)'],
                        ...mileageStats.rows.map(r => [
                          r.date,
                          r.client,
                          r.service,
                          r.to_km.toFixed(2),
                          r.home_km.toFixed(2),
                          (r.to_km + r.home_km).toFixed(2),
                          Number(craRate).toFixed(2),
                          ((r.to_km + r.home_km) * craRate).toFixed(2),
                        ]),
                      ];
                      const csv = csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Mileage_${period === 'All' ? 'AllTime' : period}_${now.getFullYear()}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 12,
                      background: '#16A34A', color: 'white', border: 'none',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Export mileage log ({mileageStats.rows.length} jobs · {mileageStats.totalKm.toFixed(1)} km)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <NewExpenseSheet isOpen={showNewExpense} onClose={() => setShowNewExpense(false)} />
    </div>
  );
}

function FinanceSkeleton({ T }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
      <style>{`@keyframes sm-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
      <div style={{ background: T.hero, borderBottom: '3px solid #E91E6A', padding: '13px 15px 15px' }}>
        <div style={{ width: 110, height: 10, borderRadius: 5, background: T.cardBorder, animation: 'sm-pulse 1.5s ease-in-out infinite', marginBottom: 10 }} />
        <div style={{ width: 190, height: 22, borderRadius: 7, background: T.cardBorder, animation: 'sm-pulse 1.5s ease-in-out infinite 0.1s' }} />
      </div>
      <div style={{ padding: '16px 14px' }}>
        <div style={{ height: 38, borderRadius: 12, background: '#2C2C2E', animation: 'sm-pulse 1.5s ease-in-out infinite 0.05s', marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 80, borderRadius: 15, background: T.card, border: `1.5px solid ${T.cardBorder}`, animation: `sm-pulse 1.5s ease-in-out infinite ${i * 0.07}s` }} />
          ))}
        </div>
        <div style={{ height: 130, borderRadius: 16, background: T.card, border: `1px solid ${T.cardBorder}`, animation: 'sm-pulse 1.5s ease-in-out infinite 0.2s', marginBottom: 24 }} />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 52, borderRadius: 11, background: T.card, border: `1px solid ${T.cardBorder}`, animation: `sm-pulse 1.5s ease-in-out infinite ${0.25 + i * 0.06}s`, marginBottom: 6 }} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ T, mode, label, value, color, privacyOn, onClick, count, workerCosts }) {
  const isNeg = value < 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${privacyOn ? 'hidden' : '$' + Math.abs(value).toLocaleString()}`}
      style={{
        background: T.card, border: `1.5px solid ${T.cardBorder}`,
        borderRadius: 15, padding: '14px 12px', cursor: 'pointer',
        position: 'relative', overflow: 'hidden',
        transition: 'opacity 0.1s',
        WebkitTapHighlightColor: 'transparent',
        width: '100%', textAlign: 'left',
      }}
    >
      <div style={{ fontSize: 10, color: T.inkMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: isNeg ? '#EF4444' : color }}>$</span>
        <span style={{ fontSize: 22, fontWeight: 500, color: isNeg ? '#EF4444' : T.ink, fontFamily: T.serif, fontVariantNumeric: 'tabular-nums' }}>
          {privacyOn ? '•••' : Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>
      {count !== undefined && (
        <div style={{ fontSize: 9, color: T.inkMuted, marginTop: 4, fontWeight: 500 }}>
          {count} job{count !== 1 ? 's' : ''}
        </div>
      )}
      {workerCosts > 0 && (
        <div style={{ fontSize: 9, color: '#92400E', marginTop: 2, fontWeight: 600 }}>
          {privacyOn ? '•••' : `-$${workerCosts.toFixed(0)}`} worker costs
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 9, color: color, fontWeight: 700, opacity: 0.8 }}>
        VIEW ›
      </div>
    </button>
  );
}
