import { computeJobFinancials } from './financialMath.js';

/**
 * Decorates a fetched invoice (with `clients`, `invoice_jobs.jobs` populated) with
 * real payment numbers computed from the `payments` table — the source of truth —
 * rather than trusting the denormalized `job.payment_status` cache.
 *
 * Accepts any Supabase client (browser RLS-scoped client or a server-side
 * service-role client) so it can run from both `invoicesRepo.fetchInvoiceById`
 * and `api/invoice.js`.
 */
export async function decorateInvoiceWithBalances(supabase, invoice) {
  const job = invoice.invoice_jobs?.[0]?.jobs || null;
  const clientId = invoice.client_id;
  const business = invoice.businesses || null;

  const empty = { amountPaid: 0, balanceOwing: 0, isPaidInFull: false, payments: [], otherOutstanding: [], runningTotalOwing: 0 };
  if (!job || !clientId) return { ...invoice, ...empty };

  const [{ data: clientJobs, error: jobsErr }, { data: clientPayments, error: paymentsErr }] = await Promise.all([
    supabase.from('jobs').select('*')
      .eq('client_id', clientId)
      .eq('business_id', invoice.business_id)
      .eq('job_status', 'Completed')
      .is('deleted_at', null),
    supabase.from('payments').select('id, job_id, amount, payment_date')
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
  const payments = (clientPayments ?? []).filter(p => p.job_id === job.id);

  const balances = (clientJobs ?? []).map(j => {
    // Pass `business` so this matches the same total shown elsewhere on the invoice as
    // "Invoice Total" (computeJobFinancials(job, biz)) — without it, jobs completed before
    // tax was enabled fall back to their stored (untaxed) hst_amount and paid+owing won't
    // reconcile with the displayed total.
    const total = computeJobFinancials(j, business).total;
    const paid = paidByJobId[j.id] || 0;
    return { job: j, total, paid, owing: Math.max(0, Math.round((total - paid) * 100) / 100) };
  });

  const current = balances.find(b => b.job.id === job.id) || null;
  const otherOutstanding = balances.filter(b => b.job.id !== job.id && b.owing > 0.01);
  const runningTotalOwing = Math.round(
    ((current?.owing || 0) + otherOutstanding.reduce((sum, b) => sum + b.owing, 0)) * 100
  ) / 100;

  return {
    ...invoice,
    amountPaid: current?.paid || 0,
    balanceOwing: current?.owing ?? 0,
    isPaidInFull: !!current && current.owing <= 0.01 && current.paid > 0,
    payments,
    otherOutstanding,
    runningTotalOwing,
  };
}
