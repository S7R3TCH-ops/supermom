// Money math for the Statler voice tools (api/ai/[action].js statler-tool).
//
// This is a deliberate, tested mirror of buildFinancialPatch() in
// src/lib/jobDraftPolicy.js + computeJobFinancials() in src/lib/financialMath.ts,
// NOT a second source of truth: src/lib/jobMoney.parity.test.js asserts the two
// produce identical subtotal/hst_amount/total_amount, so any drift fails CI.
// It lives here as plain JS because a .js serverless handler pulling in the
// TypeScript money module is an unproven Vercel import chain (see CLAUDE.md,
// invoice PDF import-chain note), and a wrong total on a customer invoice is
// the expensive failure.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function activeCosts(job) {
  if (Array.isArray(job?.additional_costs_json)) {
    return job.additional_costs_json
      .filter((c) => Number(c?.amount) > 0)
      .map((c) => ({ amount: Number(c.amount), description: c.description || '' }));
  }
  return Number(job?.additional_cost) > 0
    ? [{ amount: Number(job.additional_cost), description: job.additional_cost_notes || '' }]
    : [];
}

// Per-job tax override wins; null/undefined inherits the business setting.
function resolveTax(job, business) {
  const perJob = job?.tax_enabled;
  const enabled = perJob !== null && perJob !== undefined ? !!perJob : !!business?.tax_enabled;
  const rate = Number(business?.hst_rate ?? 0.13);
  return { enabled, rate: isNaN(rate) ? 0.13 : rate };
}

/**
 * subtotal / hst_amount / total_amount for a job at `hours` billable hours.
 * flat_rate stores $/hr for Hourly jobs and the fee for Flat jobs (CLAUDE.md).
 */
export function computeMoney(job, business, hours) {
  const hourly = job?.pricing_type === 'Hourly';
  const rate = Number(job?.flat_rate) || 0;
  const h = Number(hours) || 0;
  const base = hourly ? h * rate : rate;
  const costs = activeCosts(job);
  const additional = costs.reduce((s, c) => s + c.amount, 0);
  const tax = resolveTax(job, business);
  const taxAmount = tax.enabled ? (base + additional) * tax.rate : 0;
  return {
    subtotal: round2(base),
    hst_amount: round2(taxAmount),
    total_amount: round2(base + additional + taxAmount),
    additional_total: round2(additional),
    tax_enabled: tax.enabled,
  };
}

/** Column patch for a voice duration change on a Scheduled job. Never touches
 *  rate, pricing type, tax override or additional costs. */
export function buildHoursPatch(job, business, hours) {
  const m = computeMoney(job, business, hours);
  return {
    estimated_hours: Number(hours),
    subtotal: m.subtotal,
    hst_amount: m.hst_amount,
    total_amount: m.total_amount,
  };
}
