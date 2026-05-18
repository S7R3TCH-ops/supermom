import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import PaymentBreakdown from './PaymentBreakdown';

export default function UpcomingCard({ job: j, T, onClick, total = 0, paid = 0, privacyOn = false }) {
  const BLUE = '#1565C0';
  const timeRange = fmtTimeRange(j.start, j.end);
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(21,101,192,0.07)',
        border: `2px solid ${BLUE}`,
        borderLeft: `6px solid ${BLUE}`,
        borderRadius: 14,
        marginBottom: 10,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '9px 14px 7px',
        borderBottom: `1px solid ${BLUE}25`,
      }}>
        <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: BLUE, letterSpacing: '-0.5px', lineHeight: 1 }}>
          {timeRange}
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: BLUE, textTransform: 'uppercase', background: `${BLUE}18`, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.4px' }}>
          UPCOMING
        </div>
      </div>

      <div style={{ padding: '8px 14px 10px' }}>
        <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>
          {j.client_name}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: BLUE, opacity: 0.7, marginBottom: 3 }}>
          {dateBrief(j.start)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {j.service_name}
          </div>
          {total > 0 && (
            <>
              <span style={{ fontSize: 10, color: BLUE, opacity: 0.4 }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: BLUE }}>
                {privacyOn ? '•••' : `$${total.toFixed(0)}`}
              </span>
            </>
          )}
        </div>
        {j.job_notes ? (
          <div style={{
            fontSize: 11,
            color: BLUE,
            opacity: 0.7,
            fontStyle: 'italic',
            marginTop: 4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
          }}>
            {j.job_notes}
          </div>
        ) : null}
        {paid > 0 && total > 0 && <PaymentBreakdown j={j} paid={paid} total={total} privacyOn={privacyOn} T={T} metaColor={BLUE} />}
      </div>
    </div>
  );
}
