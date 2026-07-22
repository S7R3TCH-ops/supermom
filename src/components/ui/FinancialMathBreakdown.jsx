import { useMemo } from 'react';
import { computeJobFinancials } from '../../lib/financialMath';

/**
 * A standard, transparent math breakdown component for Supermom.
 * Used in JobDetail, PostJob, and Finance screens.
 * 
 * @param {Object} props
 * @param {Object} props.job - The job object from the DB
 * @param {Object} props.business - The business object (for tax settings)
 * @param {Object} props.liveForm - (Optional) Current edit form state for live math
 * @param {Object} props.T - Theme tokens
 * @param {string} props.mode - 'light' | 'dark'
 * @param {boolean} props.compact - If true, shows a more condensed version
 */
export default function FinancialMathBreakdown({ job, business, liveForm, payments, T, mode, compact = false }) {
  const data = useMemo(() => {
    return computeJobFinancials(job, business, liveForm);
  }, [job, business, liveForm]);

  const { pricingType, isHourly, hours, rate, subtotal, activeCosts, additionalTotal, taxEnabled, taxAmount, taxRate, total, workerCost } = data;
  const workerPay = workerCost;
  const workerPaid = job?.worker_paid ?? false;
  const workerName = job?.worker_name ?? null;

  const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', alignItems: 'baseline' };
  const labelStyle = { fontSize: compact ? 10 : 11, color: T.inkMuted, fontWeight: 500 };
  const valueStyle = { fontSize: compact ? 12 : 13, color: T.ink, fontWeight: 600, fontFamily: T.font, fontVariantNumeric: 'tabular-nums' };
  const totalStyle = { fontSize: compact ? 16 : 18, color: T.pink, fontWeight: 700, fontFamily: T.serif, fontVariantNumeric: 'tabular-nums' };

  return (
    <div style={{ 
      background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', 
      border: `1px solid ${T.cardBorder}`, 
      borderRadius: 12, 
      padding: compact ? '8px 10px' : '12px 14px',
      marginTop: 8,
      marginBottom: 12
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: T.pink, letterSpacing: '0.5px', marginBottom: 8 }}>
        ✦ Financial Breakdown
      </div>

      {/* Base Calculation */}
      <div style={rowStyle}>
        <span style={labelStyle}>
          {isHourly ? `${pricingType} (${hours % 1 === 0 ? hours : hours.toFixed(1)} hrs × $${rate.toFixed(0)}/hr)` : `Service (Flat Rate)`}
        </span>
        <span style={valueStyle}>${subtotal.toFixed(2)}</span>
      </div>

      {/* Additional Costs */}
      {activeCosts.map((c, i) => (
        Number(c.amount) > 0 && (
          <div key={i} style={rowStyle}>
            <span style={labelStyle}>+ {c.description || 'Additional cost'}</span>
            <span style={valueStyle}>${Number(c.amount).toFixed(2)}</span>
          </div>
        )
      ))}

      {/* Subtotal (shown when there are additional costs) */}
      {additionalTotal > 0 && (
        <div style={{ ...rowStyle, borderTop: `1px solid ${T.cardBorder}`, marginTop: 4, paddingTop: 6 }}>
          <span style={{ ...labelStyle, fontWeight: 700, color: T.ink }}>Subtotal</span>
          <span style={{ ...valueStyle, fontWeight: 700 }}>${(subtotal + additionalTotal).toFixed(2)}</span>
        </div>
      )}

      {/* HST — always shown */}
      <div style={rowStyle}>
        <span style={{ ...labelStyle, color: taxEnabled && taxAmount > 0 ? T.ink : T.inkMuted }}>
          HST ({(taxRate * 100).toFixed(0)}%)
        </span>
        <span style={{ ...valueStyle, color: taxEnabled && taxAmount > 0 ? T.ink : T.inkMuted }}>
          ${taxAmount.toFixed(2)}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: T.cardBorder, margin: '8px 0' }} />

      {/* Total */}
      <div style={{ ...rowStyle, padding: 0 }}>
        <span style={{ ...labelStyle, color: T.ink, fontWeight: 700 }}>TOTAL AMOUNT</span>
        <span style={totalStyle}>${total.toFixed(2)}</span>
      </div>

      {/* Payment History */}
      {Array.isArray(payments) && payments.length > 0 && (() => {
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
        const remaining = Math.max(0, total - totalPaid);
        return (
          <>
            <div style={{ height: 1, background: T.cardBorder, margin: '10px 0 6px' }} />
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: T.inkMuted, letterSpacing: '0.5px', marginBottom: 6 }}>
              💳 Payments
            </div>
            {payments.map((p, i) => {
              const d = p.payment_date ? new Date(p.payment_date + 'T12:00:00') : null;
              const dateStr = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
              return (
                <div key={i} style={rowStyle}>
                  <span style={labelStyle}>{dateStr} · {p.payment_method || 'Cash'}</span>
                  <span style={{ ...valueStyle, color: '#16A34A' }}>−${Number(p.amount).toFixed(2)}</span>
                </div>
              );
            })}
            <div style={{ height: 1, background: T.cardBorder, margin: '6px 0' }} />
            <div style={{ ...rowStyle, padding: 0 }}>
              <span style={{ ...labelStyle, color: T.ink, fontWeight: 700 }}>
                {remaining > 0 ? 'REMAINING' : 'BALANCE'}
              </span>
              <span style={{
                fontSize: compact ? 16 : 18,
                fontWeight: 700,
                fontFamily: T.serif,
                fontVariantNumeric: 'tabular-nums',
                color: remaining > 0 ? '#FC4693' : '#16A34A',
              }}>
                {remaining > 0 ? `$${remaining.toFixed(2)}` : 'PAID ✓'}
              </span>
            </div>
          </>
        );
      })()}

      {/* Worker Pay — informational only, not client-facing */}
      {workerPay > 0 && (
        <>
          <div style={{ height: 1, background: T.cardBorder, margin: '10px 0 6px' }} />
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: T.inkMuted, letterSpacing: '0.5px', marginBottom: 6 }}>
            👷 Worker Cost
          </div>
          <div style={{ ...rowStyle }}>
            <span style={{ ...labelStyle }}>{workerName || 'Worker'}</span>
            <span style={{ ...valueStyle, color: T.inkMuted }}>−${workerPay.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{
              fontFamily: T.font, fontSize: 9, fontWeight: 700, letterSpacing: '0.4px',
              textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4,
              background: workerPaid ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: workerPaid ? '#16A34A' : '#B45309',
            }}>
              {workerPaid ? 'Paid to Worker ✓' : 'Not Yet Paid'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
