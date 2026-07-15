// Shared field/validation model for the three job sheets (NewJobSheet,
// JobDetailSheet EditMode, PostJobSheet) and the repo-layer backstop.
//
// Single-writer rule: the money triple (subtotal / hst_amount / total_amount)
// is only ever written from buildFinancialPatch() output — no sheet computes
// it by hand. Hourly totals are always derived (rate × hours); there is no
// free-typed grand total for Hourly jobs (Joel, 2026-07-13).

import { computeJobFinancials } from './financialMath';

/** Editability levels, weakest → strongest. */
const SEVERITY = { open: 0, warn: 1, override: 2, locked: 3 };

/**
 * Job lifecycle stage, derived from facts — never stored.
 * payments: non-void payment rows for this job (rows with is_void are ignored).
 */
export function deriveJobStage(job, payments = [], invoiceId = null) {
  const src = job?.raw ?? job ?? {};
  const paidSum = (payments ?? [])
    .filter(p => !p?.is_void)
    .reduce((s, p) => s + (Number(p?.amount) || 0), 0);
  const hasInvoice = !!invoiceId;

  let stage;
  if (src.job_status === 'Cancelled') stage = 'cancelled';
  else if (src.payment_status === 'Paid') stage = 'paid';
  else if (src.job_status === 'Completed') stage = 'completed_owing';
  else if (paidSum > 0) stage = 'scheduled_prepaid';
  else stage = 'scheduled';

  return { stage, hasInvoice, paidSum };
}

// Field groups:
//   identity   — client_id (rebook instead of reassigning)
//   schedule   — scheduled_date, scheduled_time, recurrence, worker
//   financial  — service, pricing_type, rate, estimated_hours, costs, HST
//   completion — actual_duration, payments (admin Revert is the full undo)
//   notes      — job_notes, completion_notes, media
const MATRIX = {
  scheduled:         { identity: 'locked', schedule: 'open',   financial: 'open',     completion: 'locked',   notes: 'open' },
  scheduled_prepaid: { identity: 'locked', schedule: 'open',   financial: 'warn',     completion: 'locked',   notes: 'open' },
  completed_owing:   { identity: 'locked', schedule: 'open',   financial: 'open',     completion: 'open',     notes: 'open' },
  paid:              { identity: 'locked', schedule: 'open',   financial: 'override', completion: 'override', notes: 'open' },
  cancelled:         { identity: 'locked', schedule: 'locked', financial: 'locked',   completion: 'locked',   notes: 'open' },
};

/** Per-group editability for a stage. An invoice escalates financial to at least 'warn'. */
export function getFieldPolicy(stage, hasInvoice = false) {
  const base = MATRIX[stage] || MATRIX.scheduled;
  let financial = base.financial;
  if (hasInvoice && SEVERITY[financial] < SEVERITY.warn) financial = 'warn';
  return { ...base, financial };
}

/** Consistent warn/override card copy across sheets. Returns null when nothing to warn about. */
export function getPolicyMessage(stage, hasInvoice = false, paidSum = 0) {
  const { financial } = getFieldPolicy(stage, hasInvoice);
  if (financial === 'locked') return 'This booking is cancelled — its details are locked.';
  if (financial === 'override') {
    return `This job is paid — changing money fields will recalculate the total, may change it back to partially paid, and ${hasInvoice ? 'will update its invoice' : 'may affect its receipt'}.`;
  }
  if (financial === 'warn') {
    const paidNote = paidSum > 0 ? `$${paidSum.toFixed(2)} has already been paid on this job` : 'this job has an invoice';
    return `Heads up — ${paidNote}. Changing money fields will recalculate the total${hasInvoice ? ' and update the invoice' : ''}.`;
  }
  return null;
}

// DB columns that change the computed total — used by the repo backstop to
// decide when payment_status must be re-derived after an update.
export const MONEY_FIELDS = [
  'pricing_type', 'flat_rate', 'estimated_hours', 'actual_duration',
  'additional_costs_json', 'additional_cost', 'tax_enabled',
  'subtotal', 'hst_amount', 'total_amount',
];

/**
 * The one validation list all three sheets run before save.
 * draft: { client_id, service_id, scheduled_date, scheduled_time, hours, rate, additionalCosts }
 * PostJobSheet passes requireClient/requireService false (inherited from the job).
 * Returns { ok, errors } — errors keyed by field, human-readable messages.
 */
export function validateJobDraft(draft, { requireClient = true, requireService = true } = {}) {
  const errors = {};
  if (requireClient && !draft.client_id) errors.client_id = 'Client is required.';
  if (requireService && !draft.service_id) errors.service_id = 'Service is required.';
  if (!draft.scheduled_date) errors.scheduled_date = 'Date is required.';
  if (!draft.scheduled_time) errors.scheduled_time = 'Start time is required.';

  const hours = Number(draft.hours);
  if (!Number.isFinite(hours) || hours <= 0) errors.hours = 'Duration must be set.';

  if (draft.rate !== undefined && draft.rate !== null && draft.rate !== '') {
    const r = Number(draft.rate);
    if (!Number.isFinite(r) || r < 0) errors.rate = 'Price must be a number of $0 or more.';
  }

  for (const c of draft.additionalCosts ?? []) {
    if (c?.amount === '' || c?.amount == null) continue; // blank rows are ignored, not errors
    const a = Number(c.amount);
    if (!Number.isFinite(a) || a < 0) {
      errors.additionalCosts = 'Extra cost amounts must be $0 or more.';
      break;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Payment amount check for PostJobSheet. Overpayment is allowed (tips) but
 * reported so the UI can show an "includes $X over the total" note.
 */
export function validatePaymentAmount(amount, balance) {
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) {
    return { ok: false, error: 'Enter a payment amount above $0.', overpay: 0 };
  }
  const over = Math.round((a - Math.max(0, Number(balance) || 0)) * 100) / 100;
  return { ok: true, error: null, overpay: over > 0.009 ? over : 0 };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Builds the complete financial write-set for a job from form values.
 * draft: {
 *   pricing_type: 'Hourly' | 'Flat',
 *   rate:            $/hr for Hourly, flat fee for Flat (stored in flat_rate either way — see CLAUDE.md),
 *   hours:           estimated hours (written to estimated_hours),
 *   actualHours:     optional — completed jobs bill actual_duration, so pass it
 *                    when editing a completed job; totals use it, estimated_hours is still written from hours,
 *   additionalCosts: [{ amount, description }] — rows with amount <= 0 are dropped,
 *   taxEnabled:      boolean (explicit per-job override),
 * }
 */
export function buildFinancialPatch(draft, business = null) {
  const pricingType = draft.pricing_type === 'Hourly' ? 'Hourly' : 'Flat';
  const rate = Number(draft.rate) || 0;
  const hours = Number(draft.hours) || 0;
  const hoursForTotal = Number(draft.actualHours ?? draft.hours) || 0;
  const taxEnabled = !!draft.taxEnabled;

  const validCosts = (draft.additionalCosts ?? [])
    .filter(c => Number(c?.amount) > 0)
    .map(c => ({ amount: Number(c.amount), description: c.description || '' }));

  const fin = computeJobFinancials({}, business, {
    pricing_type: pricingType,
    estimated_hours: hoursForTotal,
    hourly_rate: pricingType === 'Hourly' ? rate : undefined,
    flat_rate: rate,
    additional_costs_json: validCosts,
    tax_enabled: taxEnabled,
  });

  return {
    pricing_type: pricingType,
    flat_rate: rate,
    estimated_hours: hours,
    additional_costs_json: validCosts,
    additional_cost: validCosts.reduce((s, c) => s + c.amount, 0),
    additional_cost_notes: validCosts.map(c => c.description).filter(Boolean).join('; ') || null,
    tax_enabled: taxEnabled,
    subtotal: round2(fin.subtotal),
    hst_amount: round2(fin.taxAmount),
    total_amount: round2(fin.total),
  };
}
