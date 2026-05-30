import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import PaymentBreakdown from './PaymentBreakdown';

export default function JobCard({ job: j, T, onClick, onDuplicate, paid = 0, total = 0, privacyOn = false, subtle = false, hstNote = false }) {
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isPartial = j.payment_status === 'Partial';
  const isUnpaid = isCompleted && !isPaid;

  // State signal colours — all from design system
  const isCompletedUnpaid = isUnpaid && !isPartial;
  const borderColor = isPartial ? '#F97316' : isCompletedUnpaid ? '#EF4444' : isPaid ? '#86EFAC' : '#E91E6A';
  const bgColor = subtle
    ? 'transparent'
    : isPartial ? '#FFF7ED'
    : isCompletedUnpaid ? '#FEF2F2'
    : isPaid ? '#F0FFF5'
    : '#FFF0F7';
  const accentColor = isPartial ? '#C2410C' : isCompletedUnpaid ? '#991B1B' : isPaid ? '#14532D' : '#E91E6A';
  const statusLabel = isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : isPaid ? 'PAID ✓' : 'SCHEDULED';

  const remaining = isPaid ? 0 : Math.max(0, total - paid);
  const showAmount = (isCompleted || total > 0) && total > 0;
  const timeRange = j.start && j.end ? fmtTimeRange(j.start, j.end) : '—';
  const dateLabel = j.start ? dateBrief(j.start) : '';

  return (
    <div
      onClick={onClick}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}30`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 16,
        padding: '11px 14px 11px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        opacity: subtle ? 0.8 : 1,
      }}
    >
      {/* Row 1: time — amount + status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: accentColor }}>
          {timeRange}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {showAmount && (
            <span style={{
              fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: accentColor,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {privacyOn ? '•••' : `$${total.toFixed(0)}`}
              {!privacyOn && hstNote && (
                <span style={{ fontSize: 8, fontWeight: 700, color: accentColor, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>
              )}
            </span>
          )}
          <span style={{
            fontFamily: T.font, fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.3px',
            background: `${borderColor}22`, color: accentColor,
            padding: '3px 7px', borderRadius: 4,
          }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Row 2: client name */}
      <div style={{
        fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: T.ink,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        letterSpacing: '-0.3px', marginBottom: 4,
      }}>
        {j.client_name}
      </div>

      {/* Row 3: service pill + date + rebook button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.4px',
          background: `${borderColor}18`, color: accentColor,
          padding: '2px 7px', borderRadius: 4, flexShrink: 0,
        }}>
          {j.service_name}
        </span>
        <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 500, color: T.inkSub }}>
          {dateLabel}
        </span>
        {onDuplicate && (
          <button
            onClick={e => { e.stopPropagation(); onDuplicate(j); }}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              padding: '0 2px', color: accentColor, fontSize: 14,
              fontWeight: 900, cursor: 'pointer', lineHeight: 1, opacity: 0.7,
            }}
            title="Rebook this job"
          >↻</button>
        )}
      </div>

      {/* Row 4: payment breakdown when balance is owed */}
      {remaining > 0 && (
        <div style={{ marginTop: 6 }}>
          <PaymentBreakdown j={j} paid={paid} total={total} privacyOn={privacyOn} T={T} metaColor={accentColor} />
        </div>
      )}

      {/* Row 5: job notes */}
      {j.notes && (
        <div style={{
          fontSize: 11, color: T.inkMuted, fontStyle: 'italic', marginTop: 5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', lineHeight: 1.4,
        }}>
          {j.notes}
        </div>
      )}

      {/* Row 6: address (scheduled jobs) */}
      {j.address && (
        <div style={{
          fontSize: 11, color: T.inkMuted, marginTop: 4, opacity: 0.7,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          📍 {j.address}
        </div>
      )}
    </div>
  );
}
