// Single source of truth for computing a job's financials from raw DB fields.
//
// Field conventions (from CLAUDE.md):
//   flat_rate   = $/hr rate for Hourly jobs (NewJobSheet never writes hourly_rate)
//   total_amount = booking-time estimate; never updated after completion — don't use as actual total
//   actual_duration = completed hours (use over estimated_hours for completed jobs)

/**
 * Computes the full financial breakdown for a job.
 * Handles live form state (if editing) and business tax settings.
 * 
 * @param {Object} job - The job object from the DB (or decorated display job)
 * @param {Object} business - (Optional) The business object for tax settings
 * @param {Object} liveForm - (Optional) Current edit form state for live math
 * @returns {Object} A full breakdown of costs, taxes, and totals
 */
export function computeJobFinancials(job, business = null, liveForm = null) {
  const src = job?.raw ?? job ?? {};
  
  // 1. Resolve Pricing Type
  const pricingType = liveForm?.pricing_type ?? src?.pricing_type ?? 'Hourly';
  const isHourly = pricingType === 'Hourly';

  // 2. Resolve Hours
  // If completed, use actual_duration. If not, use estimated_hours.
  // If editing, use the live form value.
  // For completed jobs, prefer actual_duration; fall back to estimated_hours if actual was never recorded.
  const rawHours = liveForm?.estimated_hours
    ?? (src?.job_status === 'Completed'
      ? (src?.actual_duration ?? src?.estimated_hours)
      : src?.estimated_hours)
    ?? 0;
  const hoursNum = Number(rawHours);
  const hours = isNaN(hoursNum) ? 0 : hoursNum;

  // 3. Resolve Rate
  // flat_rate stores $/hr; hourly_rate is a legacy/form fallback
  const rawRate = liveForm?.hourly_rate ?? liveForm?.flat_rate ?? src?.flat_rate ?? business?.hourly_rate ?? 60;
  const rateNum = Number(rawRate);
  const rate = isNaN(rateNum) ? 60 : rateNum;

  // 4. Resolve Base Amount (Subtotal before costs/taxes)
  let subtotal = 0;
  if (isHourly) {
    subtotal = hours * rate;
  } else {
    // For flat rate, fallback from form -> job flat_rate -> job total_amount
    const flat = liveForm?.flat_rate ?? liveForm?.total_amount ?? src?.flat_rate ?? src?.total_amount ?? 0;
    const flatNum = Number(flat);
    subtotal = isNaN(flatNum) ? 0 : flatNum;
  }

  // 5. Additional Costs
  // liveForm costs are expected to be an array of { amount, description }
  const formCosts = Array.isArray(liveForm?.additional_costs_json) 
    ? liveForm.additional_costs_json 
    : [];
  const jobCosts = Array.isArray(src?.additional_costs_json)
    ? src.additional_costs_json
    : (Number(src?.additional_cost) > 0 ? [{ amount: src.additional_cost, description: src.additional_cost_notes }] : []);
  
  const activeCosts = liveForm ? formCosts : jobCosts;
  const additionalTotal = activeCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // 6. Taxes
  let taxEnabled = business?.tax_enabled ?? false;
  let taxRate = Number(business?.hst_rate ?? 0.13);
  let taxAmount = 0;

  // If we have business info, use its settings (Live math path)
  if (business) {
    taxAmount = taxEnabled ? (subtotal + additionalTotal) * taxRate : 0;
  } 
  // If we don't have business info (Repo/Data path), fall back to the saved hst_amount on the job
  else if (Number(src?.hst_amount) > 0) {
    taxAmount = Number(src.hst_amount);
    taxEnabled = true;
  }

  // 7. Worker Cost (informational — not added to client-facing total)
  const workerCost = Number(src?.worker_pay) || 0;

  // 8. Grand Total
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
    total,
    workerCost
  };
}

/**
 * Convenience wrapper for getting just the final grand total.
 */
export function computeJobTotal(job) {
  return computeJobFinancials(job).total;
}

/**
 * Pre-tax subtotal (base + additional costs, no HST). Use on cards where HST isn't Sandra's revenue.
 */
export function computeJobSubtotal(job) {
  const { subtotal, additionalTotal } = computeJobFinancials(job);
  return subtotal + additionalTotal;
}
