import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import PaymentBreakdown from './PaymentBreakdown';
import { useAppTheme } from '../../context/AppThemeContext';

export default function UpcomingCard({ job: j, T, onClick, total = 0, paid = 0, privacyOn = false, hstNote = false }) {
  const { mode } = useAppTheme();
  const BORDER = T.pink;
  const ACCENT = T.pink;
  const BG = mode === 'dark' ? 'rgba(233,30,106,0.1)' : '#FFF0F7';
  const timeRange = j.start && j.end ? fmtTimeRange(j.start, j.end) : '—';
  const remaining = Math.max(0, total - paid);

  return (
    <div
      onClick={onClick}
      style={{
        background: BG,
        border: `1px solid ${BORDER}22`,
        borderLeft: `4px solid ${BORDER}`,
        borderRadius: 16,
        padding: '11px 14px 11px 12px',
        marginBottom: 8,
        cursor: 'pointer',
      }}
    >
      {/* Row 1: time — amount + UPCOMING badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: ACCENT }}>
          {timeRange}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {total > 0 && (
            <span style={{
              fontFamily: T.serif, fontSize: 14, fontWeight: 500, color: ACCENT,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {privacyOn ? '•••' : `$${total.toFixed(0)}`}
              {!privacyOn && hstNote && (
                <span style={{ fontSize: 8, fontWeight: 700, color: ACCENT, opacity: 0.6, marginLeft: 2, fontFamily: T.font, textTransform: 'uppercase' }}> +HST</span>
              )}
            </span>
          )}
          <span style={{
            fontFamily: T.font, fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.3px',
            background: `${ACCENT}22`, color: ACCENT,
            padding: '3px 7px', borderRadius: 4,
          }}>
            UPCOMING
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

      {/* Row 3: service pill + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

      {/* Row 4: payment breakdown for pre-paid jobs */}
      {remaining > 0 && (
        <div style={{ marginTop: 6 }}>
          <PaymentBreakdown j={j} paid={paid} total={total} privacyOn={privacyOn} T={T} metaColor={ACCENT} />
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
    </div>
  );
}
