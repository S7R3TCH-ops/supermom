import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import { useBusiness } from '../../data/useData';
import { getWorkerLabel } from '../../lib/labels';

export default function JobCard({ job: j, T, onClick, paid = 0, total = 0, grandTotal, privacyOn = false, subtle = false, hstNote = false }) {
  const { business } = useBusiness();
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isPartial = j.payment_status === 'Partial';
  const isUnpaid = isCompleted && !isPaid;
  const isOwing = isUnpaid || isPartial;

  const isDark = T.ink === '#FFFFFF';

  const borderColor = isPartial ? '#EA580C' : (isUnpaid && !isPartial) ? '#DC2626' : isPaid ? (isDark ? '#4ADE80' : '#16A34A') : (isDark ? '#FF70A6' : '#FC4693');
  const bgColor = subtle ? 'transparent'
    : isPartial ? (isDark ? 'rgba(249,115,22,0.14)' : '#FFEDD5')
    : (isUnpaid && !isPartial) ? (isDark ? 'rgba(220,38,38,0.14)' : '#FEE2E2')
    : isPaid ? (isDark ? 'rgba(22,163,74,0.12)' : '#DCFCE7')
    : (isDark ? T.pinkTint : '#FCE7F3');
  const accentColor = isPartial ? (isDark ? '#FB923C' : '#C2410C') : (isUnpaid && !isPartial) ? (isDark ? '#F87171' : '#991B1B') : isPaid ? (isDark ? '#4ADE80' : '#15803D') : (isDark ? '#FF70A6' : '#BE185D');
  const statusLabel = isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : isPaid ? 'PAID ✓' : 'SCHEDULED';

  const timeRange = j.start && j.end ? fmtTimeRange(j.start, j.end) : '—';
  const dateLabel = j.start ? dateBrief(j.start) : '';

  return (
    <div
      onClick={onClick}
      style={{
        background: bgColor,
        border: subtle ? `1px solid ${borderColor}44` : `1.5px solid ${borderColor}`,
        borderLeft: subtle ? undefined : `4px solid ${borderColor}`,
        borderRadius: 16,
        padding: '10px 14px 10px 10px',
        marginBottom: 8,
        cursor: 'pointer',
      }}
    >
      {/* Row 1: name · bold time | status pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <div style={{
          fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink,
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.3px',
        }}>
          {j.client_name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.3px' }}>
          {timeRange}
        </div>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.3px',
          background: `${borderColor}22`, color: accentColor,
          padding: '2px 6px', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Row 2: date | amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: T.inkSub }}>{dateLabel}</div>
        {total > 0 && (
          <div style={{
            fontFamily: T.serif, fontSize: 14,
            fontWeight: isOwing ? 700 : 600,
            color: accentColor, fontVariantNumeric: 'tabular-nums',
          }}>
            {privacyOn ? '•••' : `$${total.toFixed(0)}`}
            {!privacyOn && hstNote && <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>}
          </div>
        )}
      </div>

      {/* Row 3: service tag */}
      <div style={{
        fontFamily: T.font, fontSize: 9, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.4px',
        background: `${borderColor}18`, color: accentColor,
        padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 3,
      }}>
        {j.service_name}
      </div>

      {/* Worker */}
      {j.worker_name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, color: T.inkMuted, fontFamily: T.font }}>
            {getWorkerLabel(business, j.assignee_type)}: {j.worker_name}
          </span>
          {isPaid && Number(j.raw?.worker_pay) > 0 && !j.raw?.worker_paid && (
            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: T.amberBg, color: isDark ? '#FCD34D' : '#92400E', textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>
              $ Unpaid
            </span>
          )}
        </div>
      )}

      {/* Notes */}
      {j.notes && (
        <div style={{
          fontSize: 10.5, color: T.inkMuted, fontStyle: 'italic', marginTop: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', lineHeight: 1.4,
        }}>
          {j.notes}
        </div>
      )}
    </div>
  );
}
