import { computeJobFinancials } from './financialMath.js';

/**
 * Decorates a fetched invoice (with `clients`, `businesses`, `invoice_jobs.jobs` populated)
 * with real payment numbers computed from the `payments` table — the source of truth.
 *
 * Handles multi-job invoices: aggregates amountPaid/balanceOwing/isPaidInFull across
 * all jobs linked via invoice_jobs, not just the first one.
 *
 * Accepts any Supabase client (browser RLS-scoped or server-side service-role) so it
 * can run from both `invoicesRepo.fetchInvoiceById` and `api/invoice.js`.
 */
export async function decorateInvoiceWithBalances(supabase, invoice) {
  const invoiceJobIds = new Set((invoice.invoice_jobs || []).map(ij => ij.job_id));
  const clientId  = invoice.client_id;
  const business  = invoice.businesses || null;

  const empty = {
    amountPaid: 0, balanceOwing: 0, isPaidInFull: false,
    payments: [], otherOutstanding: [], alsoPaid: [],
    runningTotalOwing: 0, totalPaidAllJobs: 0, settlementCount: 0,
    invoiceJobBalances: [], creditRemaining: 0,
  };
  if (!invoiceJobIds.size || !clientId) return { ...invoice, ...empty };

  const [{ data: clientJobs, error: jobsErr }, { data: clientPayments, error: paymentsErr }, { data: creditRows, error: creditErr }] = await Promise.all([
    supabase.from('jobs').select('id, scheduled_date, service_name, pricing_type, actual_duration, estimated_hours, flat_rate, subtotal, additional_costs_json, additional_cost, additional_cost_notes, tax_enabled, hst_amount, job_status')
      .eq('client_id', clientId)
      .eq('business_id', invoice.business_id)
      .eq('job_status', 'Completed')
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: true }),
    supabase.from('payments').select('id, job_id, amount, payment_date, invoice_id, payment_method, created_at')
      .eq('client_id', clientId)
      .eq('business_id', invoice.business_id)
      .eq('is_void', false)
      .order('payment_date', { ascending: true }),
    supabase.from('client_credits').select('amount')
      .eq('client_id', clientId)
      .eq('business_id', invoice.business_id),
  ]);
  if (jobsErr) throw jobsErr;
  if (paymentsErr) throw paymentsErr;
  if (creditErr) throw creditErr;

  const creditRemaining = Math.round((creditRows ?? []).reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;

  const paidByJobId = {};
  (clientPayments ?? []).forEach(p => {
    paidByJobId[p.job_id] = (paidByJobId[p.job_id] || 0) + Number(p.amount);
  });

  // All payments for invoice-linked jobs — shown in "Payments Received" column
  const payments = (clientPayments ?? []).filter(p => invoiceJobIds.has(p.job_id));

  // Jobs settled together via THIS invoice that are NOT themselves on the invoice
  const alsoPaidJobIds = new Set(
    (clientPayments ?? [])
      .filter(p => p.invoice_id === invoice.id && !invoiceJobIds.has(p.job_id))
      .map(p => p.job_id)
  );
  const settlementCount = (clientPayments ?? []).filter(p => p.invoice_id === invoice.id).length;

  const balances = (clientJobs ?? []).map(j => {
    // Use business param so tax inheritance (NULL → business.tax_enabled) is correct
    const total = computeJobFinancials(j, business).total;
    const paid  = paidByJobId[j.id] || 0;
    return { job: j, total, paid, owing: Math.max(0, Math.round((total - paid) * 100) / 100) };
  });

  // Per-job balances for every job on this invoice
  const invoiceJobBalances = balances.filter(b => invoiceJobIds.has(b.job.id));

  // Aggregate across all linked jobs
  const amountPaid   = Math.round(invoiceJobBalances.reduce((s, b) => s + b.paid,  0) * 100) / 100;
  const balanceOwing = Math.round(invoiceJobBalances.reduce((s, b) => s + b.owing, 0) * 100) / 100;
  const isPaidInFull = invoiceJobBalances.length > 0 &&
    invoiceJobBalances.every(b => b.owing <= 0.01 && b.paid > 0);

  const otherOutstanding = balances.filter(b => !invoiceJobIds.has(b.job.id) && b.owing > 0.01);
  const alsoPaid = balances
    .filter(b => alsoPaidJobIds.has(b.job.id))
    .map(b => ({ job: b.job, total: b.total, paid: b.paid }));

  const runningTotalOwing = Math.round(
    (balanceOwing + otherOutstanding.reduce((sum, b) => sum + b.owing, 0)) * 100
  ) / 100;
  const totalPaidAllJobs = Math.round(
    (invoiceJobBalances.reduce((s, b) => s + b.total, 0) +
     alsoPaid.reduce((sum, b) => sum + b.total, 0)) * 100
  ) / 100;

  return {
    ...invoice,
    amountPaid,
    balanceOwing,
    isPaidInFull,
    payments,
    otherOutstanding,
    alsoPaid,
    runningTotalOwing,
    totalPaidAllJobs,
    settlementCount,
    invoiceJobBalances,
    creditRemaining,
  };
}

/**
 * Per-job payment badge for a line item on a decorated invoice (web view + PDF —
 * both must render it the same way). Only shown while the invoice is still open
 * (a receipt is all-paid by definition) and the job has money against it.
 * Derived from payments via invoiceJobBalances, never from jobs.payment_status.
 *
 * @returns {null | {kind: 'paid'|'partial', paid: number, owing: number}}
 */
export function jobPaymentBadge(invoice, jobId) {
  if (!invoice || invoice.isPaidInFull) return null;
  const b = (invoice.invoiceJobBalances || []).find(x => x.job?.id === jobId);
  if (!b || !(b.paid > 0.009)) return null;
  return { kind: b.owing <= 0.01 ? 'paid' : 'partial', paid: b.paid, owing: b.owing };
}

/**
 * Pure helper for per-job payment badges on decorated invoices.
 * Single source of truth for badge text and kind used by both InvoiceView.jsx and invoicePdf.ts.
 * Returns { kind: 'paid'|'partial', text: string, paid: number, owing: number } or null.
 */
export function getJobPaymentBadge(invoice, jobId) {
  if (!invoice) return null;
  const b = (invoice.invoiceJobBalances || []).find(x => x.job?.id === jobId);
  if (!b || !(b.paid > 0.009)) return null;
  const isFullyPaid = b.owing <= 0.01;
  return {
    kind: isFullyPaid ? 'paid' : 'partial',
    text: isFullyPaid ? 'Paid in full ✓' : `Paid $${b.paid.toFixed(2)} · Owing $${b.owing.toFixed(2)}`,
    paid: b.paid,
    owing: b.owing,
  };
}

