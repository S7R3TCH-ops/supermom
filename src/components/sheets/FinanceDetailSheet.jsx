import { useRef } from 'react';
import { useAppTheme } from '../../context/AppThemeContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useJobDetailSheet } from '../../context/JobDetailSheetContext';
import AmtCell from '../ui/AmtCell';
import GrabBar from '../ui/GrabBar';
import { computeJobFinancials } from '../../lib/financialMath';

function fmtShortDate(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' });
}

function JobRow({ item, T, privacyOn, onTap }) {
  const financials = computeJobFinancials(item);
  const total = item.total ?? financials.total;
  const isHourly = item.pricing_type === 'Hourly';
  const hours = item.actual_duration || item.estimated_hours || 0;
  const rate = item.flat_rate || 0;

  return (
    <button
      type="button"
      onClick={() => onTap(item.id)}
      aria-label={`View details for ${item.service_name} job for ${item.client_name}`}
      style={{
        width: '100%', textAlign: 'left',
        background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.client_name}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 11, color: T.inkSub, marginTop: 2 }}>
          {fmtShortDate(item.scheduled_at)}{item.service_name ? ` · ${item.service_name}` : ''}
        </div>
        {(isHourly || Number(item.additional_cost) > 0) && (
          <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 3, display: 'flex', gap: 6 }}>
            {isHourly && rate > 0 && <span>{Number(hours) % 1 === 0 ? hours : Number(hours).toFixed(1)}h @ ${Number(rate).toFixed(0)}/hr</span>}
            {Number(item.additional_cost) > 0 && <span>+ ${Number(item.additional_cost).toFixed(0)} costs</span>}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
          {privacyOn ? '•••' : `$${Number(total).toFixed(0)}`}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: item.payment_status === 'Paid' ? T.greenFg : item.payment_status === 'Partial' ? T.amberFg : T.errorFg, textTransform: 'uppercase', marginTop: 2 }}>
          {item.payment_status === 'Paid' ? 'Paid ✓' : item.payment_status === 'Partial' ? 'Partial' : 'Unpaid'}
        </div>
      </div>
    </button>
  );
}

function WorkerCostRow({ item, T, privacyOn }) {
  const paid = item.worker_paid ?? false;
  return (
    <div style={{
      background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: T.ink }}>
          {item.worker_name || 'Worker'}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 2 }}>
          {fmtShortDate(item.scheduled_at)}{item.client_name ? ` · ${item.client_name}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#B5004E', fontVariantNumeric: 'tabular-nums' }}>
          {privacyOn ? '•••' : `-$${Number(item.amount || 0).toFixed(0)}`}
        </div>
        <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase',
          background: paid ? T.greenBg : T.amberBg, color: paid ? T.greenFg : T.amberFg }}>
          {paid ? 'Paid ✓' : 'Unpaid'}
        </span>
      </div>
    </div>
  );
}

function ExpenseRow({ item, T, privacyOn }) {
  return (
    <div style={{
      background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: T.ink }}>
          {item.category || item.description || 'Expense'}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 10, color: T.inkMuted, marginTop: 2 }}>
          {fmtShortDate(item.expense_date || item.created_at)}
          {item.notes ? ` · ${item.notes}` : ''}
          {item.description && item.category && item.description !== item.category ? ` · ${item.description}` : ''}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.errorFg, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {privacyOn ? '•••' : `-$${Number(item.amount || 0).toFixed(0)}`}
      </div>
    </div>
  );
}

export default function FinanceDetailSheet({ title, items, type, onClose }) {
  const { T, mode, privacyOn } = useAppTheme();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, true, onClose);
  const { openJob } = useJobDetailSheet();

  const handleJobTap = id => { onClose(); openJob(id); };

  // Compute header summary
  const summary = (() => {
    if (type === 'jobs') {
      const total = items.reduce((s, i) => s + Number(i.total || 0), 0);
      return { line: `${items.length} job${items.length !== 1 ? 's' : ''}`, total, color: '#FC4693' };
    }
    if (type === 'expenses') {
      const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
      return { line: `${items.length} expense${items.length !== 1 ? 's' : ''}`, total, color: '#6B7280' };
    }
    if (type === 'profit') {
      const revenue = items.filter(i => i._itemType === 'revenue').reduce((s, i) => s + Number(i.total || 0), 0);
      const expenses = items.filter(i => i._itemType === 'expense').reduce((s, i) => s + Number(i.amount || 0), 0);
      const workerCosts = items.filter(i => i._itemType === 'worker_cost').reduce((s, i) => s + Number(i.amount || 0), 0);
      const net = revenue - expenses - workerCosts;
      return { revenue, expenses, workerCosts, net, color: net >= 0 ? T.greenFg : T.errorFg };
    }
    return { line: `${items.length} item${items.length !== 1 ? 's' : ''}`, total: 0, color: T.pink };
  })();

  return (
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={title} style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(4,1,12,0.62)', animation: 'njFade 180ms ease-out',
    }}>
      <style>{`
        @keyframes njFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes njSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div onClick={onClose} style={{ flex: 1, minHeight: 40 }} />

      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, color: T.ink,
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.38)',
        maxHeight: 'calc(var(--app-height, 100dvh) * 0.88)', display: 'flex', flexDirection: 'column',
        animation: 'njSlide 260ms cubic-bezier(0.2,0.8,0.2,1)',
        border: `1px solid ${T.cardBorder}`, borderBottom: 'none',
      }}>
        <GrabBar onDismiss={onClose} />

        <div style={{ padding: '14px 18px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: `1px solid ${T.cardBorder}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.font, fontSize: 9.5, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#FF78B0', marginBottom: 2 }}>✦ Details</div>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, letterSpacing: '-0.4px', color: T.ink }}>{title}</div>

            {type === 'profit' ? (
              <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T.greenFg }}>
                  {privacyOn ? '•••' : `+$${summary.revenue?.toFixed(0)}`} revenue
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T.errorFg }}>
                  {privacyOn ? '•••' : `-$${summary.expenses?.toFixed(0)}`} expenses
                </span>
                {summary.workerCosts > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: T.amberFg }}>
                    {privacyOn ? '•••' : `-$${summary.workerCosts?.toFixed(0)}`} worker
                  </span>
                )}
                <span style={{ fontSize: 10.5, fontWeight: 700, color: summary.color }}>
                  = {privacyOn ? '•••' : `$${summary.net?.toFixed(0)}`} net
                </span>
              </div>
            ) : (
              <div style={{ fontFamily: T.font, fontSize: 11.5, color: T.inkMuted, marginTop: 4 }}>
                {summary.line} · Total:{' '}
                <span style={{ color: summary.color, fontWeight: 700 }}>
                  {privacyOn ? '•••' : `$${Number(summary.total).toFixed(0)}`}
                </span>
              </div>
            )}
          </div>

          <button onClick={onClose} aria-label="Close" style={{
            width: 30, height: 30, borderRadius: 9,
            background: mode === 'dark' ? 'rgba(255,255,255,0.07)' : T.pinkTint,
            border: `1px solid ${T.cardBorder}`, color: T.inkSub, cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 24px' }}>
          {items.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: T.inkMuted, fontFamily: T.font, fontSize: 13 }}>
              No items found.
            </div>
          ) : type === 'jobs' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => (
                <JobRow key={item.id} item={item} T={T} privacyOn={privacyOn} onTap={handleJobTap} />
              ))}
            </div>
          ) : type === 'expenses' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => (
                <ExpenseRow key={item.id} item={item} T={T} privacyOn={privacyOn} />
              ))}
            </div>
          ) : type === 'profit' ? (
            <div>
              {/* Revenue section */}
              {items.filter(i => i._itemType === 'revenue').length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    Income ({items.filter(i => i._itemType === 'revenue').length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                    {items.filter(i => i._itemType === 'revenue').map(item => (
                      <JobRow key={item.id} item={item} T={T} privacyOn={privacyOn} onTap={handleJobTap} />
                    ))}
                  </div>
                </>
              )}
              {/* Worker Costs section */}
              {items.filter(i => i._itemType === 'worker_cost').length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.amberFg, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, marginTop: items.filter(i => i._itemType === 'revenue').length > 0 ? 18 : 0 }}>
                    Worker Costs ({items.filter(i => i._itemType === 'worker_cost').length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                    {items.filter(i => i._itemType === 'worker_cost').map((item, idx) => (
                      <WorkerCostRow key={item.id || idx} item={item} T={T} privacyOn={privacyOn} />
                    ))}
                  </div>
                </>
              )}
              {/* Expenses section */}
              {items.filter(i => i._itemType === 'expense').length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.errorFg, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    Expenses ({items.filter(i => i._itemType === 'expense').length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.filter(i => i._itemType === 'expense').map(item => (
                      <ExpenseRow key={item.id} item={item} T={T} privacyOn={privacyOn} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
