import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import { useAppTheme } from '../../context/AppThemeContext';

export default function UpcomingCard({ job: j, T, onClick, total = 0, grandTotal, paid = 0, privacyOn = false, hstNote = false }) {
  const { mode } = useAppTheme();
  const BORDER = T.pink;
  const ACCENT = T.pink;
  const BG = mode === 'dark' ? 'rgba(233,30,106,0.1)' : '#FFF0F7';
  const timeRange = j.start && j.end ? fmtTimeRange(j.start, j.end) : '—';

  return (
    <div
      onClick={onClick}
      style={{
        background: BG,
        border: `1px solid ${BORDER}22`,
        borderLeft: `4px solid ${BORDER}`,
        borderRadius: 16,
        padding: '10px 14px 10px 12px',
        marginBottom: 8,
        cursor: 'pointer',
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
        <div style={{ fontFamily: T.font, fontSize: 14, fontWeight: 800, color: ACCENT, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {timeRange}
        </div>
      </div>

      {/* Row 2: UPCOMING badge + service pill + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.3px',
          background: `${ACCENT}22`, color: ACCENT,
          padding: '2px 6px', borderRadius: 4, flexShrink: 0,
        }}>
          UPCOMING
        </span>
        <span style={{
          fontFamily: T.font, fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.4px',
          background: `${ACCENT}18`, color: ACCENT,
          padding: '2px 7px', borderRadius: 4, flexShrink: 0,
        }}>
          {j.service_name}
        </span>
        <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 500, color: T.inkSub }}>
          {dateBrief(j.start)}
        </span>
      </div>

      {/* Row 3: price + worker + worker unpaid badge */}
      {((!privacyOn && total > 0) || j.worker_name) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!privacyOn && total > 0 && (
            <span style={{
              fontFamily: T.serif, fontSize: 13, fontWeight: 600, color: ACCENT,
              fontVariantNumeric: 'tabular-nums',
            }}>
              ${total.toFixed(0)}{hstNote && <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>}
            </span>
          )}
          {privacyOn && total > 0 && (
            <span style={{ fontFamily: T.serif, fontSize: 13, fontWeight: 600, color: ACCENT }}>•••</span>
          )}
          {j.worker_name && (
            <>
              {total > 0 && <span style={{ color: ACCENT, opacity: 0.3, fontSize: 11 }}>·</span>}
              <span style={{ fontSize: 10.5, color: T.inkMuted, fontFamily: T.font }}>
                {j.assignee_type === 'staff' ? '⭐ Staff:' : '👷 Worker:'} {j.worker_name}
              </span>
            </>
          )}
        </div>
      )}

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
    </div>
  );
}
