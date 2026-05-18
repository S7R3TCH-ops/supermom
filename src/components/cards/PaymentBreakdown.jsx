export default function PaymentBreakdown({ j, paid, total, privacyOn, T, metaColor }) {
  const src = j.raw || j;
  const remaining = Math.max(0, total - (paid || 0));
  if (remaining === 0) return null;

  if (privacyOn) {
    return (
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        {(paid || 0) > 0 && (
          <>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#16A34A', letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums' }}>••• paid</span>
            <span style={{ color: metaColor, opacity: 0.4, fontSize: 12 }}>·</span>
          </>
        )}
        <span style={{ fontSize: 13, fontWeight: 800, color: T.pink, letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums' }}>••• owing</span>
      </div>
    );
  }

  const isHourly = src.pricing_type === 'Hourly';
  const rate = Number(src.hourly_rate || src.flat_rate || 0);
  const hours = Number(src.actual_duration || src.estimated_hours || 0);
  const additionalCost = Number(src.additional_cost || 0);
  const hst = Number(src.hst_amount || 0);

  const mathParts = [];
  if (isHourly && rate > 0 && hours > 0) {
    mathParts.push(`$${rate.toFixed(0)}/hr x ${hours}h`);
  } else {
    mathParts.push('Flat rate');
  }
  if (additionalCost > 0) mathParts.push(`+ $${additionalCost.toFixed(0)} costs`);
  if (hst > 0) mathParts.push(`+ $${hst.toFixed(0)} HST`);
  mathParts.push(`= $${total.toFixed(0)}`);

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 11, color: metaColor, opacity: 0.8, marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>
        {mathParts.join(' ')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {(paid || 0) > 0 && (
          <>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#16A34A', letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums' }}>
              ${paid.toFixed(0)} paid
            </span>
            <span style={{ color: metaColor, opacity: 0.4, fontSize: 12 }}>·</span>
          </>
        )}
        <span style={{ fontSize: 13, fontWeight: 800, color: T.pink, letterSpacing: '-0.2px', fontVariantNumeric: 'tabular-nums' }}>
          ${remaining.toFixed(0)} owing
        </span>
      </div>
    </div>
  );
}
