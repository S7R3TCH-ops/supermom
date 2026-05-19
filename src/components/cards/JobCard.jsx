import { fmtTimeRange, dateBrief } from '../../lib/dateUtils';
import PaymentBreakdown from './PaymentBreakdown';

export default function JobCard({ job: j, T, onClick, onDuplicate, paid = 0, total = 0, privacyOn = false, subtle = false }) {
  const isCompleted = j.status === 'Completed';
  const isPaid = j.payment_status === 'Paid';
  const isPartial = j.payment_status === 'Partial';
  const isUnpaid = isCompleted && !isPaid;

  const urgencyColor = isUnpaid ? '#F59E0B' : isCompleted ? '#16A34A' : T.pink;
  const urgencyBg = isUnpaid ? 'rgba(245,158,11,0.12)' : isCompleted ? 'rgba(22,163,74,0.08)' : T.pinkGlow;
  const statusLabel = isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : isCompleted ? 'PAID ✓' : 'SCHEDULED';

  const remaining = isPaid ? 0 : Math.max(0, total - paid);
  const showPaymentInfo = isCompleted || total > 0;
  const metaColor = T.inkSub || '#795548';
  const timeRange = fmtTimeRange(j.start, j.end);
  const dateLabel = dateBrief(j.start);

  if (isCompleted) {
    return (
      <div
        onClick={onClick}
        style={{
          background: subtle ? 'transparent' : urgencyBg,
          border: subtle ? `1px solid ${T.cardBorder}` : `1.5px solid ${urgencyColor}`,
          borderLeft: subtle ? `1px solid ${T.cardBorder}` : `5px solid ${urgencyColor}`,
          borderRadius: 14,
          marginBottom: 9,
          cursor: 'pointer',
          padding: '10px 14px',
          opacity: subtle ? 0.6 : 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{
            fontFamily: T.serif,
            fontSize: 17,
            fontWeight: 600,
            color: T.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.3px',
            flex: 1,
          }}>
            {j.client_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {showPaymentInfo && !privacyOn && total > 0 && (
              <span style={{
                fontFamily: T.serif,
                fontSize: 14,
                fontWeight: 600,
                color: urgencyColor,
                letterSpacing: '-0.3px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                ${total.toFixed(0)}
              </span>
            )}
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              color: urgencyColor,
              textTransform: 'uppercase',
              background: `${urgencyColor}22`,
              padding: '3px 8px',
              borderRadius: 5,
              letterSpacing: '0.3px',
            }}>
              {statusLabel}
            </span>
            {onDuplicate && (
              <button
                onClick={e => { e.stopPropagation(); onDuplicate(j); }}
                style={{ background: 'none', border: 'none', padding: '0 2px', color: urgencyColor, fontSize: 14, fontWeight: 900, cursor: 'pointer', lineHeight: 1, opacity: 0.7 }}
                title="Rebook this job"
              >
                ↻
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: metaColor }}>
            {dateLabel} · {timeRange}
          </span>
          <span style={{ fontSize: 10, color: metaColor, opacity: 0.4 }}>·</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: urgencyColor, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {j.service_name}
          </span>
        </div>

        {remaining > 0 && <PaymentBreakdown j={j} paid={paid} total={total} privacyOn={privacyOn} T={T} metaColor={metaColor} />}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: urgencyBg,
        border: `2px solid ${urgencyColor}`,
        borderLeft: `6px solid ${urgencyColor}`,
        borderRadius: 16,
        marginBottom: 12,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px 8px',
        borderBottom: `1px solid ${urgencyColor}30`,
      }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: 22,
          fontWeight: 900,
          color: urgencyColor,
          letterSpacing: '-0.5px',
          lineHeight: 1,
        }}>
          {timeRange}
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 800,
          color: urgencyColor,
          textTransform: 'uppercase',
          background: `${urgencyColor}22`,
          padding: '4px 9px',
          borderRadius: 6,
          letterSpacing: '0.4px',
        }}>
          {statusLabel}
        </div>
      </div>

      <div style={{ padding: '10px 16px 12px' }}>
        <div style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.4px', marginBottom: 1 }}>
          {j.client_name}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: metaColor, marginBottom: 4 }}>
          {dateLabel}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: urgencyColor, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          {j.service_name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: metaColor, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span>Est: {j.raw?.estimated_hours || 0}h</span>
          {showPaymentInfo && remaining === 0 && total > 0 && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ color: paid > 0 ? '#16A34A' : urgencyColor, fontVariantNumeric: 'tabular-nums' }}>
                {privacyOn ? '•••' : paid > 0 ? `$${total.toFixed(0)} pre-paid` : `$${total.toFixed(0)} total`}
              </span>
            </>
          )}
        </div>
        {showPaymentInfo && remaining > 0 && <PaymentBreakdown j={j} paid={paid} total={total} privacyOn={privacyOn} T={T} metaColor={metaColor} />}
        {j.job_notes ? (
          <div style={{
            fontSize: 11,
            color: metaColor,
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
        {j.address && (
          <div style={{ fontSize: 11, color: metaColor, marginTop: 4, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📍 {j.address}
          </div>
        )}
      </div>
    </div>
  );
}
