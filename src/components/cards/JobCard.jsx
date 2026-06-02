import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';

export default function JobCard({ job: j, T, onClick, paid = 0, total = 0, grandTotal, privacyOn = false, subtle = false, hstNote = false }) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        {/* Left: client, service, date, worker */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: T.serif, fontSize: 17, fontWeight: 500, color: T.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: '-0.3px', marginBottom: 3,
          }}>
            {j.client_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: T.font, fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.4px',
              background: `${borderColor}18`, color: accentColor,
              padding: '2px 6px', borderRadius: 4, flexShrink: 0,
            }}>
              {j.service_name}
            </span>
            <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 500, color: T.inkSub }}>
              {dateLabel}
            </span>
          </div>
          {j.worker_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, color: T.inkMuted, fontFamily: T.font }}>
                {j.assignee_type === 'staff' ? '⭐ Staff:' : '👷 Worker:'} {j.worker_name}
              </span>
              {isPaid && Number(j.raw?.worker_pay) > 0 && !j.raw?.worker_paid && (
                <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>
                  $ Unpaid
                </span>
              )}
            </div>
          )}
          {j.notes && (
            <div style={{
              fontSize: 10.5, color: T.inkMuted, fontStyle: 'italic', marginTop: 4,
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', lineHeight: 1.4,
            }}>
              {j.notes}
            </div>
          )}
          {j.address && (
            <div style={{
              fontSize: 10.5, color: T.inkMuted, marginTop: 3, opacity: 0.7,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              📍 {j.address}
            </div>
          )}
        </div>

        {/* Right: amount, time range, status badge — all stacked */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {total > 0 && (
            <div style={{
              fontFamily: T.serif, fontSize: 14, fontWeight: 600, color: accentColor,
              fontVariantNumeric: 'tabular-nums', marginBottom: 2,
            }}>
              {privacyOn ? '•••' : `$${total.toFixed(0)}`}
              {!privacyOn && hstNote && <span style={{ fontSize: 8, fontWeight: 700, color: accentColor, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>}
            </div>
          )}
          <div style={{ fontFamily: T.font, fontSize: 12, fontWeight: 800, color: accentColor, marginBottom: 4, whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>
            {timeRange}
          </div>
          <span style={{
            fontFamily: T.font, fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.3px',
            background: `${borderColor}22`, color: accentColor,
            padding: '2px 6px', borderRadius: 4,
          }}>
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
