import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';
import { computeJobTotal, computeJobFinancials } from '../lib/financialMath';
import { decorateInvoiceWithBalances } from '../lib/invoiceBalances';

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
    .select('*, clients(*)')
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
 * Fetches an invoice and its associated job(s) and client data.
 */
export async function fetchInvoiceById(id) {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      clients (*),
      businesses (*),
      invoice_jobs (
        job_id,
        jobs (*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return decorateInvoiceWithBalances(supabase, invoice);
}

const torontoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());

/**
 * Records full payment for one or more of a client's outstanding jobs in a single batch,
 * tagging each payment with this invoice's id (payments.invoice_id = invoiceId) so the
 * receipt can later show an "Also Paid for This Client" section. Each settled job is marked
 * Paid and its own auto-generated invoice flipped to 'Paid'.
 *
 * Owing is recomputed fresh from the DB (never trusts a caller-supplied amount), so the call
 * is idempotent — jobs already settled (owing <= $0.01) are skipped, making it safe to re-run.
 *
 * @param {string} invoiceId
 * @param {string} method - 'Cash' | 'e-Transfer'
 * @param {string[]|null} jobIds - allow-list of job ids to settle. null = settle every
 *   outstanding job on the invoice (current job + all "also outstanding").
 * @returns {Promise<{settled:number, amount:number}>}
 */
export async function settleInvoiceOutstanding(invoiceId, method = 'Cash', jobIds = null) {
  const businessId = await getCurrentBusinessId();
  const invoice = await fetchInvoiceById(invoiceId); // fresh balances — recompute at call time

  // Include all invoice-linked jobs (not just first) plus other outstanding
  const candidates = [];
  (invoice.invoiceJobBalances ?? []).forEach(b => {
    if (b.owing > 0.01) candidates.push({ jobId: b.job.id, owing: b.owing });
  });
  (invoice.otherOutstanding ?? []).forEach(b => {
    if (b.owing > 0.01) candidates.push({ jobId: b.job.id, owing: b.owing });
  });

  const allow = jobIds ? new Set(jobIds) : null;
  const targets = candidates.filter(c => !allow || allow.has(c.jobId));
  if (targets.length === 0) return { settled: 0, amount: 0 };

  const payDate = torontoToday();
  let amount = 0;

  for (const { jobId, owing } of targets) {
    // Insert a payment for the exact remaining owing. We do NOT recompute/overwrite the job's
    // subtotal/hst_amount/total_amount here — those are already finalized by recordPayment.
    const { error: payErr } = await supabase
      .from('payments')
      .insert({
        business_id: businessId,
        invoice_id: invoiceId,
        job_id: jobId,
        client_id: invoice.client_id,
        amount: owing,
        payment_method: method,
        payment_date: payDate,
      });
    if (payErr) throw payErr;

    const { error: jobErr } = await supabase
      .from('jobs')
      .update({ payment_status: 'Paid', payment_method: method })
      .eq('id', jobId)
      .eq('business_id', businessId);
    if (jobErr) throw jobErr;

    // Flip that job's own invoice to Paid (the current invoice included).
    const { data: link } = await supabase
      .from('invoice_jobs')
      .select('invoice_id')
      .eq('job_id', jobId)
      .eq('business_id', businessId)
      .maybeSingle();
    if (link?.invoice_id) {
      await supabase.from('invoices')
        .update({ status: 'Paid' })
        .eq('id', link.invoice_id)
        .eq('business_id', businessId);
    }

    amount += owing;
  }

  return { settled: targets.length, amount: Math.round(amount * 100) / 100 };
}

/**
 * Reverses a settlement recorded via settleInvoiceOutstanding by voiding the payments tagged
 * with this invoice id (soft delete — is_void = true, never a hard delete). Each affected
 * job's payment_status and its own invoice status are re-derived from remaining payments.
 *
 * @param {string} invoiceId
 * @param {string|null} jobId - limit the undo to a single job; null = void the whole batch.
 * @returns {Promise<{voided:number}>}
 */
export async function voidInvoiceSettlement(invoiceId, jobId = null) {
  const businessId = await getCurrentBusinessId();

  let q = supabase.from('payments')
    .select('id, job_id')
    .eq('invoice_id', invoiceId)
    .eq('business_id', businessId)
    .eq('is_void', false);
  if (jobId) q = q.eq('job_id', jobId);
  const { data: pays, error: paysErr } = await q;
  if (paysErr) throw paysErr;
  if (!pays || pays.length === 0) return { voided: 0 };

  const ids = pays.map(p => p.id);
  const { error: voidErr } = await supabase
    .from('payments')
    .update({ is_void: true })
    .in('id', ids)
    .eq('business_id', businessId);
  if (voidErr) throw voidErr;

  const affectedJobIds = [...new Set(pays.map(p => p.job_id))];
  for (const jid of affectedJobIds) {
    const [{ data: job }, { data: remaining }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jid).eq('business_id', businessId).single(),
      supabase.from('payments').select('amount').eq('job_id', jid).eq('is_void', false),
    ]);
    if (!job) continue;
    const paid = (remaining ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const total = Math.round(computeJobTotal(job) * 100) / 100;
    const status = paid >= total - 0.01 && paid > 0 ? 'Paid' : paid > 0 ? 'Partial' : '';
    await supabase.from('jobs').update({ payment_status: status })
      .eq('id', jid).eq('business_id', businessId);

    const { data: link } = await supabase.from('invoice_jobs')
      .select('invoice_id').eq('job_id', jid).eq('business_id', businessId).maybeSingle();
    if (link?.invoice_id) {
      await supabase.from('invoices')
        .update({ status: status === 'Paid' ? 'Paid' : 'Draft' })
        .eq('id', link.invoice_id).eq('business_id', businessId);
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
      await supabase.from('invoice_jobs')
        .delete()
        .eq('job_id', jobId)
        .eq('business_id', businessId);

      // Void old invoice if it now has no jobs
      const { count } = await supabase
        .from('invoice_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', existing.invoice_id)
        .eq('business_id', businessId);

      if ((count ?? 0) === 0) {
        await supabase.from('invoices')
          .update({ status: 'Void' })
          .eq('id', existing.invoice_id)
          .eq('business_id', businessId);
      }
    }

    const { error: linkErr } = await supabase
      .from('invoice_jobs')
      .insert({ business_id: businessId, invoice_id: invoiceId, job_id: jobId });
    if (linkErr) throw linkErr;
  }

  // Recalculate combined total_amount across all linked jobs
  const { data: allLinks } = await supabase
    .from('invoice_jobs')
    .select('jobs(*)')
    .eq('invoice_id', invoiceId)
    .eq('business_id', businessId);

  const newTotal = Math.round(
    (allLinks ?? []).reduce((s, link) => s + computeJobFinancials(link.jobs, bizData).total, 0) * 100
  ) / 100;

  await supabase.from('invoices')
    .update({ total_amount: newTotal })
    .eq('id', invoiceId)
    .eq('business_id', businessId);

  return invoiceId;
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
