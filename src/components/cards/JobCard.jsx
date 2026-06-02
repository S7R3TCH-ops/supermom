import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';

export default function JobCard({ job: j, T, onClick, onDuplicate, paid = 0, total = 0, grandTotal, privacyOn = false, subtle = false, hstNote = false }) {
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isPartial = j.payment_status === 'Partial';
  const isUnpaid = isCompleted && !isPaid;

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
        padding: '10px 14px 10px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        opacity: subtle ? 0.8 : 1,
      }}
    >
      {/* Row 1: client name ← → time range */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <div style={{
          fontFamily: T.serif, fontSize: 17, fontWeight: 500, color: T.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.3px', flex: 1, paddingRight: 10,
        }}>
          {j.client_name}
        </div>
        <div style={{ fontFamily: T.font, fontSize: 14, fontWeight: 800, color: accentColor, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {timeRange}
        </div>
      </div>

      {/* Row 2: status badge + service pill + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.3px',
          background: `${borderColor}22`, color: accentColor,
          padding: '2px 6px', borderRadius: 4, flexShrink: 0,
        }}>
          {statusLabel}
        </span>
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
      </div>

      {/* Row 3: price + worker + worker unpaid badge + rebook */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {total > 0 && (
          <span style={{
            fontFamily: T.serif, fontSize: 13, fontWeight: 600, color: accentColor,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {privacyOn ? '•••' : `$${total.toFixed(0)}`}
            {!privacyOn && hstNote && (
              <span style={{ fontSize: 8, fontWeight: 700, color: accentColor, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>
            )}
          </span>
        )}
        {j.worker_name && (
          <>
            {total > 0 && <span style={{ color: accentColor, opacity: 0.3, fontSize: 11 }}>·</span>}
            <span style={{ fontSize: 10.5, color: T.inkMuted, fontFamily: T.font }}>
              {j.assignee_type === 'staff' ? '⭐ Staff:' : '👷 Worker:'} {j.worker_name}
            </span>
            {isPaid && Number(j.raw?.worker_pay) > 0 && !j.raw?.worker_paid && (
              <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>
                $ Unpaid
              </span>
            )}
          </>
        )}
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

      {/* Notes (optional) */}
      {j.notes && (
        <div style={{
          fontSize: 11, color: T.inkMuted, fontStyle: 'italic', marginTop: 5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', lineHeight: 1.4,
        }}>
          {j.notes}
        </div>
      )}

      {/* Address (optional) */}
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
