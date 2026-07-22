import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import { useBusiness } from '../../data/useData';
import { getWorkerLabel } from '../../lib/labels';

export default function JobCard({ job: j, T, onClick, paid = 0, total = 0, grandTotal, privacyOn = false, hstNote = false }) {
  const { business } = useBusiness();
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isPartial = j.payment_status === 'Partial';
  const isUnpaid = isCompleted && !isPaid;
  const isOwing = isUnpaid || isPartial;

  const S = isPartial ? T.status.partial
    : (isUnpaid && !isPartial) ? T.status.overdue
    : isPaid ? T.status.paid
    : T.status.scheduled;
  const statusLabel = isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : isPaid ? 'PAID ✓' : 'SCHEDULED';

  const timeRange = j.start && j.end ? fmtTimeRange(j.start, j.end) : '—';
  const dateLabel = j.start ? dateBrief(j.start) : '';

  // Owing cards (unpaid/overdue/partial) get a bold solid fill — switch body text to white for contrast
  const nameColor = isOwing ? S.fg : T.ink;
  const dateColor = isOwing ? 'rgba(255,255,255,0.85)' : T.inkSub;
  const mutedColor = isOwing ? 'rgba(255,255,255,0.75)' : T.inkMuted;
  const amountColor = isOwing ? S.fg : S.text;

  return (
    <div
      onClick={onClick}
      style={{
        background: S.bg,
        border: `1.5px solid ${S.border}`,
        borderLeft: `4px solid ${S.border}`,
        borderRadius: 16,
        padding: '10px 14px 10px 10px',
        marginBottom: 8,
        cursor: 'pointer',
      }}
    >
      {/* Row 1: name · bold time | status pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <div style={{
          fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: nameColor,
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.3px',
        }}>
          {j.client_name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: amountColor, whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.3px' }}>
          {timeRange}
        </div>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.3px',
          background: S.pill, color: S.text,
          padding: '2px 6px', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Row 2: date | amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: dateColor }}>{dateLabel}</div>
        {total > 0 && (
          <div style={{
            fontFamily: T.serif, fontSize: 14,
            fontWeight: isOwing ? 700 : 600,
            color: amountColor, fontVariantNumeric: 'tabular-nums',
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
        background: S.pill, color: S.text,
        padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 3,
      }}>
        {j.service_name}
      </div>

      {/* Worker */}
      {j.worker_name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, color: mutedColor, fontFamily: T.font }}>
            {getWorkerLabel(business, j.assignee_type)}: {j.worker_name}
          </span>
          {isPaid && Number(j.worker_pay) > 0 && !j.worker_paid && (
            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: T.status.attention.pill, color: T.status.attention.text, textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>
              $ Unpaid
            </span>
          )}
        </div>
      )}

      {/* Notes */}
      {j.notes && (
        <div style={{
          fontSize: 10.5, color: mutedColor, fontStyle: 'italic', marginTop: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', lineHeight: 1.4,
        }}>
          {j.notes}
        </div>
      )}
    </div>
  );
}
