import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import { useBusiness } from '../../data/useData';
import { getWorkerLabel } from '../../lib/labels';

export default function UpcomingCard({ job: j, T, onClick, total = 0, grandTotal, paid = 0, privacyOn = false, hstNote = false }) {
  const { business } = useBusiness();
  const S = T.status.scheduled;
  const timeRange = j.start && j.end ? fmtTimeRange(j.start, j.end) : '—';
  const dateLabel = j.start ? dateBrief(j.start) : '';

  return (
    <div
      onClick={onClick}
      style={{
        background: S.bg,
        border: `1.5px solid ${S.border}`,
        borderRadius: 16,
        padding: '10px 14px 10px 12px',
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
        <div style={{ fontSize: 12, fontWeight: 700, color: S.text, whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.3px' }}>
          {timeRange}
        </div>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.3px',
          background: S.pill, color: S.text,
          padding: '2px 6px', borderRadius: 4, flexShrink: 0,
        }}>
          UPCOMING
        </span>
      </div>

      {/* Row 2: date | amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: T.inkSub }}>{dateLabel}</div>
        {total > 0 && (
          <div style={{
            fontFamily: T.serif, fontSize: 14, fontWeight: 600, color: S.text,
            fontVariantNumeric: 'tabular-nums',
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
        <div style={{ fontSize: 10.5, color: T.inkMuted, marginTop: 2, fontFamily: T.font }}>
          {getWorkerLabel(business, j.assignee_type)}: {j.worker_name}
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
