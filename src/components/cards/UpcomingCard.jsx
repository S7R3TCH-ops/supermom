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
              background: `${ACCENT}18`, color: ACCENT,
              padding: '2px 6px', borderRadius: 4, flexShrink: 0,
            }}>
              {j.service_name}
            </span>
            <span style={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 500, color: T.inkSub }}>
              {dateBrief(j.start)}
            </span>
          </div>
          {j.worker_name && (
            <div style={{ fontSize: 10.5, color: T.inkMuted, marginTop: 3, fontFamily: T.font }}>
              {j.assignee_type === 'staff' ? '⭐ Staff:' : '👷 Worker:'} {j.worker_name}
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
        </div>

        {/* Right: amount, time range, status badge — all stacked */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {total > 0 && (
            <div style={{
              fontFamily: T.serif, fontSize: 14, fontWeight: 600, color: ACCENT,
              fontVariantNumeric: 'tabular-nums', marginBottom: 2,
            }}>
              {privacyOn ? '•••' : `$${total.toFixed(0)}`}
              {!privacyOn && hstNote && <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>}
            </div>
          )}
          <div style={{ fontFamily: T.font, fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 4, whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>
            {timeRange}
          </div>
          <span style={{
            fontFamily: T.font, fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.3px',
            background: `${ACCENT}22`, color: ACCENT,
            padding: '2px 6px', borderRadius: 4,
          }}>
            UPCOMING
          </span>
        </div>
      </div>
    </div>
  );
}
