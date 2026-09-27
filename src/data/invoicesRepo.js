import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';
import { computeJobTotal, computeJobFinancials } from '../lib/financialMath';
import { allocatePayment } from '../lib/paymentWaterfall';

/**
 * Generates a formal invoice for a job if one doesn't already exist.
 * Links it to the job via invoice_jobs.
 */
export async function generateInvoiceForJob(jobId) {
  const businessId = await getCurrentBusinessId();

  // 1. Check if job already has an invoice
  const { data: existingLink } = await supabase
    .from('invoice_jobs')
    .select('invoice_id')
    .eq('job_id', jobId)
    .eq('business_id', businessId)
    .maybeSingle();

  // 2. Fetch job details
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('*, clients!jobs_client_id_fkey(*)')
    .eq('id', jobId)
    .eq('business_id', businessId)
    .single();

  if (jobErr) throw jobErr;

  // Compute actual total using the central source of truth
  const actualTotal = Math.round(computeJobTotal(job) * 100) / 100;

  // Net-7 terms — due 7 days after the service date
  const _d = new Date(job.scheduled_date);
  _d.setDate(_d.getDate() + 7);
  const dueDate = _d.toISOString().slice(0, 10);

  if (existingLink) {
    const statusPatch = job.payment_status === 'Paid' ? { status: 'Paid' } : {};
    const { error: updateErr } = await supabase.from('invoices')
      .update({ total_amount: actualTotal, due_date: dueDate, ...statusPatch })
      .eq('id', existingLink.invoice_id)
      .eq('business_id', businessId);
    if (updateErr) throw updateErr;
    return existingLink.invoice_id;
  }

  // 3. Generate invoice number (YYYY-XXX)
  const year = new Date().getFullYear();
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('business_id', businessId)
    .ilike('invoice_number', `${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 1;
  if (lastInvoice?.invoice_number) {
    const parts = lastInvoice.invoice_number.split('-');
    const lastNum = parseInt(parts[1], 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }
  const invoiceNumber = `${year}-${String(nextNum).padStart(3, '0')}`;

  // 4. Create invoice
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      business_id: businessId,
      client_id: job.client_id,
      invoice_number: invoiceNumber,
      invoice_date: job.scheduled_date,
      due_date: dueDate,
      total_amount: actualTotal,
      status: job.payment_status === 'Paid' ? 'Paid' : 'Draft',
    })
    .select()
    .single();

  if (invErr) throw invErr;

  // 5. Link job to invoice
  const { error: linkErr } = await supabase
    .from('invoice_jobs')
    .insert({
      business_id: businessId,
      invoice_id: invoice.id,
      job_id: jobId,
    });

  if (linkErr) throw linkErr;

  return invoice.id;
}

/**
 * Fetches an invoice and its associated job(s) and client data, decorated with
 * payment balances.
 *
 * Reads via the service-role JSON endpoint (api/invoice.ts?format=json) rather
 * than the browser anon Supabase client, so the public /i/:id route needs no
 * anon SELECT policies on invoices/clients/businesses/jobs (SEC-1).
 */
export async function fetchInvoiceById(id) {
  const res = await fetch(`/api/invoice?id=${encodeURIComponent(id)}&format=json`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load invoice (${res.status})`);
  }
  return res.json();
}

const LAST_ROUND_WINDOW_MS = 10_000;

const torontoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());

/**
 * Records a payment for one or more of a client's outstanding jobs in a single batch,
 * tagging each payment with this invoice's id (payments.invoice_id = invoiceId) so the
 * receipt can later show an "Also Paid for This Client" section.
 *
 * paymentAmount = null pays every selected job in full. A smaller amount is applied
 * oldest-job-first (allocatePayment) — the last job it reaches may end up Partial.
 * Overpayment is rejected here; overpay → client credit only happens via recordPayment.
 *
 * Owing is recomputed fresh from the DB (never trusts a caller-supplied owing), so a
 * full-payment call is idempotent — jobs already settled (owing <= $0.01) are skipped.
 * We do NOT recompute/overwrite any job's subtotal/hst_amount/total_amount here — those
 * are already finalized by recordPayment (single-writer rule, buildFinancialPatch).
 *
 * All payment rows of one call are written in a single insert, so they share a
 * created_at — that's what lets voidInvoiceSettlement undo just the last round.
 *
 * @param {string} invoiceId
 * @param {string} method - 'Cash' | 'e-Transfer'
 * @param {string[]|null} jobIds - allow-list of job ids to settle. null = settle every
 *   outstanding job on the invoice (current job + all "also outstanding").
 * @param {number|null} paymentAmount - dollars to apply; null = full owing of the targets.
 * @returns {Promise<{settled:number, partial:number, amount:number}>}
 */
export async function settleInvoiceOutstanding(invoiceId, method = 'Cash', jobIds = null, paymentAmount = null) {
  const businessId = await getCurrentBusinessId();
  const invoice = await fetchInvoiceById(invoiceId); // fresh balances — recompute at call time

  const candidates = [...(invoice.invoiceJobBalances ?? []), ...(invoice.otherOutstanding ?? [])]
    .filter(b => b.owing > 0.01)
    .map(b => ({ jobId: b.job.id, owing: b.owing, date: b.job.scheduled_date }));

  const allow = jobIds ? new Set(jobIds) : null;
  const targets = candidates.filter(c => !allow || allow.has(c.jobId));
  if (targets.length === 0) return { settled: 0, partial: 0, amount: 0 };

  const allocations = allocatePayment(targets, paymentAmount); // throws on invalid/overpay
  if (allocations.length === 0) return { settled: 0, partial: 0, amount: 0 };

  const payDate = torontoToday();
  const { error: payErr } = await supabase.from('payments').insert(allocations.map(a => ({
    business_id: businessId,
    invoice_id: invoiceId,
    job_id: a.jobId,
    client_id: invoice.client_id,
    amount: a.amount,
    payment_method: method,
    payment_date: payDate,
  })));
  if (payErr) throw payErr;

  // Payments are the source of truth and are already saved. If a status write below
  // fails, flag it so the UI reloads instead of offering a retry that would record
  // the same money twice.
  try {
    await applySettlementStatuses({ businessId, invoiceId, invoice, allocations, method });
  } catch (e) {
    const err = new Error('Payment saved, but updating job/invoice status failed — reload to check.');
    err.paymentRecorded = true;
    err.cause = e;
    throw err;
  }

  const cents = allocations.reduce((s, a) => s + Math.round(a.amount * 100), 0);
  return {
    settled: allocations.filter(a => a.paidInFull).length,
    partial: allocations.filter(a => !a.paidInFull).length,
    amount: cents / 100,
  };
}

/**
 * Job + invoice status writes for a settlement whose payments are already inserted.
 * Batched (.in) so a bundle costs a few round trips, not 2 per job.
 */
async function applySettlementStatuses({ businessId, invoiceId, invoice, allocations, method }) {
  const paidIds = allocations.filter(a => a.paidInFull).map(a => a.jobId);
  const partialIds = allocations.filter(a => !a.paidInFull).map(a => a.jobId);
  for (const [ids, status] of [[paidIds, 'Paid'], [partialIds, 'Partial']]) {
    if (ids.length === 0) continue;
    const { error } = await supabase.from('jobs')
      .update({ payment_status: status, payment_method: method })
      .in('id', ids)
      .eq('business_id', businessId);
    if (error) throw error;
  }

  const paidNow = new Set(paidIds);
  const invoiceJobIds = new Set((invoice.invoiceJobBalances ?? []).map(b => b.job.id));
  const invoicesToPay = [];

  // This invoice is Paid only once every job on it is — from the balances fetched
  // before the settle plus what was just applied. Partial progress is shown from
  // payments, not stored (invoices.status has no 'Partial').
  const current = invoice.invoiceJobBalances ?? [];
  if (current.length > 0 && current.every(b => b.owing <= 0.01 || paidNow.has(b.job.id))) {
    invoicesToPay.push(invoiceId);
  }

  // Bundled jobs from other invoices: flip such an invoice only if none of its
  // still-owing jobs (all of which are in otherOutstanding) is left unpaid.
  const otherOwingIds = (invoice.otherOutstanding ?? []).map(b => b.job.id).filter(id => !invoiceJobIds.has(id));
  const bundledPaid = paidIds.filter(id => !invoiceJobIds.has(id));
  if (bundledPaid.length > 0 && otherOwingIds.length > 0) {
    const { data: links, error: linkErr } = await supabase.from('invoice_jobs')
      .select('job_id, invoice_id')
      .in('job_id', otherOwingIds)
      .eq('business_id', businessId);
    if (linkErr) throw linkErr;
    const jobsByInvoice = new Map();
    for (const l of links ?? []) {
      if (!l.invoice_id || l.invoice_id === invoiceId) continue;
      if (!jobsByInvoice.has(l.invoice_id)) jobsByInvoice.set(l.invoice_id, []);
      jobsByInvoice.get(l.invoice_id).push(l.job_id);
    }
    for (const [otherInvoiceId, jobIds] of jobsByInvoice) {
      if (jobIds.some(id => paidNow.has(id)) && jobIds.every(id => paidNow.has(id))) invoicesToPay.push(otherInvoiceId);
    }
  }

  if (invoicesToPay.length > 0) {
    const { error: flipErr } = await supabase.from('invoices')
      .update({ status: 'Paid' })
      .in('id', invoicesToPay)
      .eq('business_id', businessId);
    if (flipErr) throw flipErr;
  }
}

/**
 * Reverses a settlement recorded via settleInvoiceOutstanding by voiding the payments tagged
 * with this invoice id (soft delete — is_void = true, never a hard delete). Each affected
 * job's payment_status and its own invoice status are re-derived from remaining payments.
 *
 * @param {string} invoiceId
 * @param {string|null} jobId - limit the undo to a single job; null = every job.
 * @param {{lastRoundOnly?: boolean}} [opts] - lastRoundOnly: void only the most recent
 *   settle call's payments (they share one created_at — single insert), not earlier
 *   partial rounds; legacy row-by-row settles are grouped by a 10s window).
 *   Default false = void the whole batch.
 * @returns {Promise<{voided:number}>}
 */
export async function voidInvoiceSettlement(invoiceId, jobId = null, { lastRoundOnly = false } = {}) {
  const businessId = await getCurrentBusinessId();

  let q = supabase.from('payments')
    .select('id, job_id, created_at')
    .eq('invoice_id', invoiceId)
    .eq('business_id', businessId)
    .eq('is_void', false);
  if (jobId) q = q.eq('job_id', jobId);
  const { data: allPays, error: paysErr } = await q;
  if (paysErr) throw paysErr;
  let pays = allPays ?? [];
  if (lastRoundOnly && pays.length > 0) {
    // New settles share one created_at (single insert). Settles recorded before that
    // inserted row-by-row a few hundred ms apart, so treat anything within
    // LAST_ROUND_WINDOW_MS of the newest payment as the same round.
    const ts = p => new Date(p.created_at).getTime();
    const latest = Math.max(...pays.map(ts));
    pays = pays.filter(p => latest - ts(p) <= LAST_ROUND_WINDOW_MS);
  }
  if (pays.length === 0) return { voided: 0 };

  const ids = pays.map(p => p.id);
  const { error: voidErr } = await supabase
    .from('payments')
    .update({ is_void: true })
    .in('id', ids)
    .eq('business_id', businessId);
  if (voidErr) throw voidErr;

  const affectedJobIds = [...new Set(pays.map(p => p.job_id))];
  for (const jid of affectedJobIds) {
    const [{ data: job, error: jobErr }, { data: remaining, error: remainingErr }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jid).eq('business_id', businessId).single(),
      supabase.from('payments').select('amount').eq('job_id', jid).eq('business_id', businessId).eq('is_void', false),
    ]);
    if (jobErr) throw jobErr;
    if (remainingErr) throw remainingErr;
    if (!job) continue;
    const paid = (remaining ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const total = Math.round(computeJobTotal(job) * 100) / 100;
    const status = paid >= total - 0.01 && paid > 0 ? 'Paid' : paid > 0 ? 'Partial' : '';
    const { error: statusErr } = await supabase.from('jobs').update({ payment_status: status })
      .eq('id', jid).eq('business_id', businessId);
    if (statusErr) throw statusErr;

    const { data: link, error: linkErr } = await supabase.from('invoice_jobs')
      .select('invoice_id').eq('job_id', jid).eq('business_id', businessId).maybeSingle();
    if (linkErr) throw linkErr;
    // Undo can only make an invoice less paid: a job that is still Paid leaves its
    // invoice alone (on a multi-job invoice the others may still owe).
    if (link?.invoice_id && status !== 'Paid') {
      const { error: flipErr } = await supabase.from('invoices')
        .update({ status: 'Draft' })
        .eq('id', link.invoice_id).eq('business_id', businessId);
      if (flipErr) throw flipErr;
    }
  }

  return { voided: ids.length };
}

/**
 * Links additional jobs to an existing invoice as extra line items.
 *
 * For each job: if it belongs to a different invoice, that link is removed and the
 * old invoice is voided if it becomes empty. The invoice total_amount is recalculated
 * from all linked jobs after the operation.
 *
 * @param {string} invoiceId
 * @param {string[]} extraJobIds - job IDs to add to this invoice
 */
export async function addJobsToInvoice(invoiceId, extraJobIds) {
  if (!extraJobIds?.length) return invoiceId;
  const businessId = await getCurrentBusinessId();

  // Need business data for accurate tax-aware total computation
  const { data: bizData } = await supabase
    .from('businesses').select('*').eq('id', businessId).single();

  for (const jobId of extraJobIds) {
    const { data: existing } = await supabase
      .from('invoice_jobs')
      .select('invoice_id')
      .eq('job_id', jobId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (existing?.invoice_id === invoiceId) continue; // already on this invoice

    if (existing) {
      const { error: unlinkErr } = await supabase.from('invoice_jobs')
        .delete()
        .eq('job_id', jobId)
        .eq('business_id', businessId);
      if (unlinkErr) throw unlinkErr;

      // Void old invoice if it now has no jobs
      const { count, error: countErr } = await supabase
        .from('invoice_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', existing.invoice_id)
        .eq('business_id', businessId);
      if (countErr) throw countErr;

      if ((count ?? 0) === 0) {
        const { error: voidErr } = await supabase.from('invoices')
          .update({ status: 'Void' })
          .eq('id', existing.invoice_id)
          .eq('business_id', businessId);
        if (voidErr) throw voidErr;
      }
    }

    const { error: linkErr } = await supabase
      .from('invoice_jobs')
      .insert({ business_id: businessId, invoice_id: invoiceId, job_id: jobId });
    if (linkErr) throw linkErr;
  }

  // Recalculate combined total_amount across all linked jobs
  await recalcInvoiceTotal(invoiceId, businessId, bizData);

  return invoiceId;
}

/**
 * Recomputes an invoice's total_amount from all its linked jobs.
 * Called after any operation that changes what a linked job is worth —
 * adding/removing jobs, or editing a job's money fields (jobDraftPolicy resync).
 */
export async function recalcInvoiceTotal(invoiceId, businessId = null, bizData = null) {
  const bid = businessId ?? await getCurrentBusinessId();
  let biz = bizData;
  if (!biz) {
    const { data, error } = await supabase
      .from('businesses').select('*').eq('id', bid).single();
    if (error) throw error;
    biz = data;
  }

  const { data: allLinks, error: allLinksErr } = await supabase
    .from('invoice_jobs')
    .select('jobs(*)')
    .eq('invoice_id', invoiceId)
    .eq('business_id', bid);
  if (allLinksErr) throw allLinksErr;

  const newTotal = Math.round(
    (allLinks ?? []).reduce((s, link) => s + computeJobFinancials(link.jobs, biz).total, 0) * 100
  ) / 100;

  const { error: totalErr } = await supabase.from('invoices')
    .update({ total_amount: newTotal })
    .eq('id', invoiceId)
    .eq('business_id', bid);
  if (totalErr) throw totalErr;

  return newTotal;
}

/**
 * Fetches all invoices for the current business.
 */
export async function fetchInvoices() {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients(first_name, last_name)')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetches all invoices for a specific client.
 */
export async function fetchInvoicesByClientId(clientId) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
