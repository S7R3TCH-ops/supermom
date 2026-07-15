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
    invoiceJobBalances: [],
  };
  if (!invoiceJobIds.size || !clientId) return { ...invoice, ...empty };

  const [{ data: clientJobs, error: jobsErr }, { data: clientPayments, error: paymentsErr }] = await Promise.all([
    supabase.from('jobs').select('*')
      .eq('client_id', clientId)
      .eq('business_id', invoice.business_id)
      .eq('job_status', 'Completed')
      .is('deleted_at', null),
    supabase.from('payments').select('id, job_id, amount, payment_date, invoice_id, payment_method')
      .eq('client_id', clientId)
      .eq('business_id', invoice.business_id)
      .eq('is_void', false)
      .order('payment_date', { ascending: true }),
  ]);
  if (jobsErr) throw jobsErr;
  if (paymentsErr) throw paymentsErr;

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
  };
}
