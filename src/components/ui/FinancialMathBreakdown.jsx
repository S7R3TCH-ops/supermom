import { useMemo } from 'react';

/**
 * A standard, transparent math breakdown component for Supermom.
 * Used in JobDetail, PostJob, and Finance screens.
 * 
 * @param {Object} props
 * @param {Object} props.job - The job object from the DB
 * @param {Object} props.business - The business object (for tax settings)
 * @param {Object} props.liveForm - (Optional) Current edit form state for live math
 * @param {Object} props.T - Theme tokens
 * @param {string} props.mode - 'light' | 'dark'
 * @param {boolean} props.compact - If true, shows a more condensed version
 */
export default function FinancialMathBreakdown({ job, business, liveForm, T, mode, compact = false }) {
  const data = useMemo(() => {
    // 1. Resolve Pricing Type
    const pricingType = liveForm?.pricing_type ?? job?.pricing_type ?? 'Hourly';
    const isHourly = pricingType === 'Hourly';

    // 2. Resolve Hours
    // If completed, use actual_duration. If not, use estimated_hours.
    // If editing, use the live form value.
    const rawHours = liveForm?.estimated_hours ?? (job?.job_status === 'Completed' ? job?.actual_duration : job?.estimated_hours) ?? 0;
    const hours = Number(rawHours);

    // 3. Resolve Rate
    const rawRate = liveForm?.hourly_rate ?? job?.hourly_rate ?? business?.hourly_rate ?? 60;
    const rate = Number(rawRate);

    // 4. Resolve Base Amount (Subtotal before costs/taxes)
    let subtotal = 0;
    if (isHourly) {
      subtotal = hours * rate;
    } else {
      const flat = liveForm?.total_amount ?? job?.flat_rate ?? job?.total_amount ?? 0;
      subtotal = Number(flat);
    }

    // 5. Additional Costs
    // liveForm costs are expected to be an array of { amount, description }
    const formCosts = Array.isArray(liveForm?.additional_costs_json) 
      ? liveForm.additional_costs_json 
      : [];
    const jobCosts = Array.isArray(job?.additional_costs_json)
      ? job.additional_costs_json
      : (Number(job?.additional_cost) > 0 ? [{ amount: job.additional_cost, description: job.additional_cost_notes }] : []);
    
    const activeCosts = liveForm ? formCosts : jobCosts;
    const additionalTotal = activeCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    // 6. Taxes
    const taxEnabled = business?.tax_enabled ?? false;
    const taxRate = Number(business?.hst_rate ?? 0.13);
    const taxAmount = taxEnabled ? (subtotal + additionalTotal) * taxRate : 0;

    // 7. Grand Total
    const total = subtotal + additionalTotal + taxAmount;

    return {
      pricingType,
      isHourly,
      hours,
      rate,
      subtotal,
      activeCosts,
      additionalTotal,
      taxEnabled,
      taxAmount,
      taxRate,
      total
    };
  }, [job, business, liveForm]);

  const { pricingType, isHourly, hours, rate, subtotal, activeCosts, additionalTotal, taxEnabled, taxAmount, taxRate, total } = data;

  const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', alignItems: 'baseline' };
  const labelStyle = { fontSize: compact ? 10 : 11, color: T.inkMuted, fontWeight: 500 };
  const valueStyle = { fontSize: compact ? 12 : 13, color: T.ink, fontWeight: 600, fontFamily: T.font, fontVariantNumeric: 'tabular-nums' };
  const totalStyle = { fontSize: compact ? 16 : 18, color: T.pink, fontWeight: 700, fontFamily: T.serif, fontVariantNumeric: 'tabular-nums' };

  return (
    <div style={{ 
      background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', 
      border: `1px solid ${T.cardBorder}`, 
      borderRadius: 12, 
      padding: compact ? '8px 10px' : '12px 14px',
      marginTop: 8,
      marginBottom: 12
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: T.pink, letterSpacing: '0.5px', marginBottom: 8 }}>
        ✦ Financial Breakdown
      </div>

      {/* Base Calculation */}
      <div style={rowStyle}>
        <span style={labelStyle}>
          {isHourly ? `${pricingType} (${hours % 1 === 0 ? hours : hours.toFixed(1)} hrs × $${rate.toFixed(0)}/hr)` : `Service (Flat Rate)`}
        </span>
        <span style={valueStyle}>${subtotal.toFixed(2)}</span>
      </div>

      {/* Additional Costs */}
      {activeCosts.map((c, i) => (
        Number(c.amount) > 0 && (
          <div key={i} style={rowStyle}>
            <span style={labelStyle}>+ {c.description || 'Additional cost'}</span>
            <span style={valueStyle}>${Number(c.amount).toFixed(2)}</span>
          </div>
        )
      ))}

      {/* Tax */}
      {taxEnabled && (
        <div style={rowStyle}>
          <span style={labelStyle}>+ Tax ({ (taxRate * 100).toFixed(0) }%)</span>
          <span style={valueStyle}>${taxAmount.toFixed(2)}</span>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: T.cardBorder, margin: '8px 0' }} />

      {/* Total */}
      <div style={{ ...rowStyle, padding: 0 }}>
        <span style={{ ...labelStyle, color: T.ink, fontWeight: 700 }}>TOTAL AMOUNT</span>
        <span style={totalStyle}>${total.toFixed(2)}</span>
      </div>
    </div>
  );
}
