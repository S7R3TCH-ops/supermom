// Async data-access layer for jobs.
// Backed by Supabase, queries the existing `jobs` table from supabase_schema.sql.
// scheduled_date (date) + scheduled_time (time) are stored separately — helpers
// here combine them into Toronto-local ISO strings for the UI.

import { supabase, authHeaders } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';
import { generateInvoiceForJob } from './invoicesRepo';
import { computeJobFinancials } from '../lib/financialMath';
import { MONEY_FIELDS } from '../lib/jobDraftPolicy';
import { composeTorontoISO as _composeTorontoISO } from '../lib/dateUtils';
import { setJobWorkers, markJobWorkerPaid, fetchJobWorkers, fetchJobWorkersForJobs } from './jobWorkersRepo';
export { composeTorontoISO } from '../lib/dateUtils';

function assertWrote(data, op) {
  const rows = Array.isArray(data) ? data : (data ? [data] : []);
  if (rows.length === 0) throw new Error(`${op} failed — no rows changed (RLS or filter mismatch)`);
}

// Narrow select for list queries — drops ~10 unused columns (review fields, reschedule history,
// completion_notes, legacy rates, cron timestamps). fetchJobById keeps * for full detail view.
const SELECT_LIST = [
  'id', 'business_id', 'client_id', 'service_id', 'template_id', 'service_name',
  'scheduled_date', 'scheduled_time', 'pricing_type', 'estimated_hours',
  'actual_duration', 'flat_rate', 'tax_enabled', 'hst_rate', 'subtotal', 'hst_amount',
  'additional_cost', 'additional_cost_notes', 'additional_costs_json', 'total_amount',
  'job_status', 'payment_status', 'payment_method', 'job_notes', 'photo_links',
  'calendar_event_id', 'ai_context', 'deleted_at',
  'distance_to_km', 'distance_home_km',
].join(', ');

export async function fetchActiveJobs() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return [];

  const { data, error } = await supabase
    .from('jobs')
    .select(SELECT_LIST)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });
  if (error) throw error;
  return decorateJobsWithWorkers(data ?? [], businessId);
}

export async function fetchJobsByClientId(clientId) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return [];

  const { data, error } = await supabase
    .from('jobs')
    .select(SELECT_LIST)
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false });
  if (error) throw error;
  return decorateJobsWithWorkers(data ?? [], businessId);
}

export async function searchJobs(q, dateFrom, dateTo) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return [];
  let query = supabase
    .from('jobs')
    .select(`${SELECT_LIST}, clients(first_name, last_name)`)
    .eq('business_id', businessId)
    .is('deleted_at', null);
  if (q) {
    const safe = q.replace(/[%_,()]/g, ' ').trim();
    if (safe) query = query.or(`service_name.ilike.%${safe}%,job_notes.ilike.%${safe}%`);
  }
  if (dateFrom) query = query.gte('scheduled_date', dateFrom);
  if (dateTo) query = query.lte('scheduled_date', dateTo);
  const { data, error } = await query.order('scheduled_date', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const jwMap = await fetchJobWorkersForJobs(rows.map(j => j.id), businessId);
  return rows.map(j => {
    const c = j.clients;
    const client_name = c ? [c.first_name, c.last_name].filter(Boolean).join(' ') : null;
    const { clients: _dropped, ...rest } = j;
    return { ...decorateJob({ ...rest, workers: jwMap[j.id] || [] }), client_name };
  });
}

// Batch-attaches job_workers to a list of job rows (one query for all of
// them, not N+1) and runs each through decorateJob.
async function decorateJobsWithWorkers(rows, businessId) {
  const jwMap = await fetchJobWorkersForJobs(rows.map(j => j.id), businessId);
  return rows.map(j => decorateJob({ ...j, workers: jwMap[j.id] || [] }));
}

export async function fetchJobById(id) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return null;

  const { data, error } = await supabase
    .from('jobs')
    .select(`*, clients(first_name, last_name, notes, ai_context, tags)`)
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const c = data.clients;
  const clientName = c
    ? [c.first_name, c.last_name].filter(Boolean).join(' ')
    : 'Unknown';
  const { clients: _dropped, ...jobRow } = data;
  const jobWorkers = await fetchJobWorkers(id);

  let client_recent_notes = [];
  if (data.client_id) {
    const { data: recentNotes } = await supabase
      .from('jobs')
      .select('completion_notes, scheduled_date')
      .eq('client_id', data.client_id)
      .eq('business_id', businessId)
      .eq('job_status', 'Completed')
      .not('completion_notes', 'is', null)
      .neq('id', id)
      .order('scheduled_date', { ascending: false })
      .limit(2);
    client_recent_notes = (recentNotes || []).filter(r => r.completion_notes?.trim());
  }

  return {
    ...decorateJob({ ...jobRow, workers: jobWorkers }),
    client_name: clientName,
    client_notes: c?.notes || '',
    client_ai_context: c?.ai_context || {},
    client_tags: c?.tags || [],
    client_recent_notes,
  };
}

export async function createJob(payload) {
  const businessId = await getCurrentBusinessId();
  const recurrence = payload.ai_context?.recurrence_rule;
  const { worker_id: assignWorkerId, worker_pay: assignWorkerPay, ...payloadNoWorker } = payload;
  const cleanPayload = normalizeJobPayload(payloadNoWorker);

  if (recurrence && recurrence !== 'None') {
    return createRecurringSeries(cleanPayload, businessId, assignWorkerId, assignWorkerPay);
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...cleanPayload, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  if (assignWorkerId) {
    await setJobWorkers(data.id, businessId, [{ worker_id: assignWorkerId, pay: assignWorkerPay ?? null }]);
  }
  const decorated = decorateJob(data);
  await triggerGCalSync(decorated.id, 'upsert');
  return decorated;
}

async function createRecurringSeries(payload, businessId, assignWorkerId, assignWorkerPay) {
  // 1. Create the template
  const { data: template, error: tErr } = await supabase
    .from('job_templates')
    .insert({
      business_id: businessId,
      client_id: payload.client_id,
      service_name: payload.service_name,
      frequency: payload.ai_context?.recurrence_rule,
      preferred_time: payload.scheduled_time,
      pricing_type: payload.pricing_type || 'Flat',
      estimated_hours: payload.estimated_hours,
      flat_rate: payload.flat_rate,
      notes: payload.job_notes,
    })
    .select()
    .single();
  if (tErr) throw tErr;

  // 2. Generate occurrences (Initial + 11 more = ~3-12 months depending on frequency)
  const count = template.frequency === 'Weekly' ? 12 : template.frequency === 'Biweekly' ? 6 : 4;
  const occurrences = [];
  let currentDateStr = payload.scheduled_date;

  for (let i = 0; i < count; i++) {
    const occurrence = normalizeJobPayload({
      ...payload,
      business_id: businessId,
      template_id: template.id,
      scheduled_date: currentDateStr,
      ai_context: {
        ...(payload.ai_context || {}),
        template_id: template.id,
        occurrence_index: i,
      }
    });
    occurrences.push(occurrence);

    // Advance date using string-based UTC math to avoid DST drift
    if (template.frequency === 'Weekly') currentDateStr = addDaysToDateStr(currentDateStr, 7);
    else if (template.frequency === 'Biweekly') currentDateStr = addDaysToDateStr(currentDateStr, 14);
    else if (template.frequency === 'Monthly') currentDateStr = addMonthsToDateStr(currentDateStr, 1);
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert(occurrences)
    .select();
  if (error) throw error;

  if (assignWorkerId) {
    await Promise.all(data.map(j =>
      setJobWorkers(j.id, businessId, [{ worker_id: assignWorkerId, pay: assignWorkerPay ?? null }])
    ));
  }

  const results = data.map(decorateJob);
  // Sync all occurrences to GCal
  await Promise.allSettled(results.map(j => triggerGCalSync(j.id, 'upsert')));

  return results[0];
}

export async function updateJob(id, patch, seriesAction = 'this') {
  const businessId = await getCurrentBusinessId();
  // Worker assignment (worker_id/worker_pay/worker_paid) lives in job_workers,
  // not on the jobs row — pulled out of the patch and handled separately below.
  // Keyed off 'worker_id' in patch specifically (not worker_pay/worker_paid
  // alone) since a full reassignment always sends all three together
  // (JobDetailSheet's saveEdit); a bare { worker_paid } patch used to exist
  // pre-cutover but callers now go through markJobWorkerPaid directly instead.
  const hasWorkerReassignment = 'worker_id' in patch;
  const { worker_id, worker_pay, worker_paid, ...patchNoWorker } = patch;
  const cleanPatch = { ...normalizeJobPayload(patchNoWorker), updated_at: new Date().toISOString() };

  if (seriesAction === 'this') {
    const { data, error } = await supabase
      .from('jobs')
      .update(cleanPatch)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    if (error) throw error;
    assertWrote(data, 'updateJob:this');
    let jobWorkers = [];
    if (hasWorkerReassignment) {
      jobWorkers = worker_id
        ? await setJobWorkers(id, businessId, [{ worker_id, pay: worker_pay ?? null, paid: worker_paid ?? false }])
        : await setJobWorkers(id, businessId, []);
    }
    // Backstop (jobDraftPolicy): a money edit can silently invalidate payment_status
    // (e.g. rate change on a Paid job). Re-derive from the payments sum unless the
    // caller set payment_status itself (recordPayment does — it already derived it).
    if (!('payment_status' in cleanPatch) && MONEY_FIELDS.some(f => f in cleanPatch)) {
      data.payment_status = await rederivePaymentStatus(id);
    }
    const decorated = hasWorkerReassignment
      ? decorateJob({ ...data, workers: jobWorkers })
      : decorateJob(data);
    triggerGCalSync(id, 'upsert');
    return decorated;
  }

  // For 'future' or 'all', we need context from the current job
  const { data: job, error: fErr } = await supabase
    .from('jobs')
    .select('template_id, scheduled_date')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();
  if (fErr) throw fErr;
  if (!job.template_id) return updateJob(id, patch, 'this');

  // Protect series updates from flattening dates
  const seriesPatch = { ...cleanPatch };
  delete seriesPatch.scheduled_date;

  let query = supabase
    .from('jobs')
    .update(seriesPatch)
    .eq('template_id', job.template_id)
    .eq('business_id', businessId)
    .eq('job_status', 'Scheduled'); // Only touch upcoming jobs

  if (seriesAction === 'future') {
    query = query.gte('scheduled_date', job.scheduled_date);
  }

  const { data, error } = await query.select();
  if (error) throw error;
  assertWrote(data, 'updateJob:series');

  if (hasWorkerReassignment) {
    await Promise.all(data.map(j => worker_id
      ? setJobWorkers(j.id, businessId, [{ worker_id, pay: worker_pay ?? null, paid: worker_paid ?? false }])
      : setJobWorkers(j.id, businessId, [])));
  }

  // Sync affected jobs (limited to avoid blast)
  await Promise.allSettled(data.slice(0, 5).map(j => triggerGCalSync(j.id, 'upsert')));

  // Update the template itself if 'all'
  if (seriesAction === 'all') {
    await supabase
      .from('job_templates')
      .update({
        service_name: cleanPatch.service_name,
        preferred_time: cleanPatch.scheduled_time,
        pricing_type: cleanPatch.pricing_type,
        estimated_hours: cleanPatch.estimated_hours,
        flat_rate: cleanPatch.flat_rate,
        notes: cleanPatch.job_notes,
      })
      .eq('id', job.template_id)
      .eq('business_id', businessId);
  }

  return decorateJob(data.find(j => j.id === id) || data[0]);
}

export async function softDeleteJob(id, seriesAction = 'this') {
  const businessId = await getCurrentBusinessId();
  const deletedAt = new Date().toISOString();

  if (seriesAction === 'this') {
    const { data, error } = await supabase
      .from('jobs')
      .update({ deleted_at: deletedAt })
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    if (error) throw error;
    assertWrote(data, 'softDeleteJob:this');
    await triggerGCalSync(id, 'delete');
    return decorateJob(data);
  }

  const { data: job, error: fErr } = await supabase
    .from('jobs')
    .select('template_id, scheduled_date')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();
  if (fErr) throw fErr;
  if (!job.template_id) return softDeleteJob(id, 'this');

  let query = supabase
    .from('jobs')
    .update({ deleted_at: deletedAt })
    .eq('template_id', job.template_id)
    .eq('business_id', businessId)
    .eq('job_status', 'Scheduled'); // Protect historical/completed jobs

  if (seriesAction === 'future') {
    query = query.gte('scheduled_date', job.scheduled_date);
  }

  const { data, error } = await query.select();
  if (error) throw error;
  assertWrote(data, 'softDeleteJob:series');

  await Promise.allSettled(data.slice(0, 20).map(j => triggerGCalSync(j.id, 'delete')));

  if (seriesAction === 'all') {
    await supabase
      .from('job_templates')
      .update({ deleted_at: deletedAt, active: false })
      .eq('id', job.template_id)
      .eq('business_id', businessId);
  }

  return decorateJob(data[0]);
}

export async function cancelJob(id, reason) {
  const businessId = await getCurrentBusinessId();
  const { data: current, error: fetchErr } = await supabase
    .from('jobs')
    .select('ai_context')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();
  if (fetchErr) throw fetchErr;

  const { data, error } = await supabase
    .from('jobs')
    .update({
      job_status: 'Cancelled',
      updated_at: new Date().toISOString(),
      ai_context: {
        ...(current?.ai_context || {}),
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      },
    })
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();
  if (error) throw error;
  assertWrote(data, 'cancelJob');
  // Remove cancelled jobs from Google Calendar
  triggerGCalSync(id, 'delete');
  return decorateJob(data);
}

export async function archiveClientJobs(clientId) {
  const businessId = await getCurrentBusinessId();
  const { error } = await supabase
    .from('jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .is('deleted_at', null);
  if (error) throw error;
}

export async function hardDeleteJob(id) {
  const businessId = await getCurrentBusinessId();
  const { error: delPayErr } = await supabase.from('payments').delete().eq('job_id', id).eq('business_id', businessId);
  if (delPayErr) throw delPayErr;
  const { error: delLinkErr } = await supabase.from('invoice_jobs').delete().eq('job_id', id).eq('business_id', businessId);
  if (delLinkErr) throw delLinkErr;
  const { error: delWorkersErr } = await supabase.from('job_workers').delete().eq('job_id', id).eq('business_id', businessId);
  if (delWorkersErr) throw delWorkersErr;
  const { error } = await supabase.from('jobs').delete().eq('id', id).eq('business_id', businessId);
  if (error) throw error;
}

export async function revertJobToPreCompletion(id) {
  const businessId = await getCurrentBusinessId();

  // 1. Hard-delete all payments for this job
  const { error: delPayErr } = await supabase
    .from('payments').delete().eq('job_id', id).eq('business_id', businessId);
  if (delPayErr) throw delPayErr;

  // 2. Find all invoices linked to this job and clean them up
  // A failed read here must throw, not fall through to the Void branch below
  // (an empty `links` from a failed read would wrongly look like "no invoices left").
  const { data: links, error: linksErr } = await supabase
    .from('invoice_jobs').select('invoice_id').eq('job_id', id).eq('business_id', businessId);
  if (linksErr) throw linksErr;

  for (const { invoice_id } of (links ?? [])) {
    const { error: delInvoiceLinkErr } = await supabase.from('invoice_jobs')
      .delete().eq('invoice_id', invoice_id).eq('job_id', id).eq('business_id', businessId);
    if (delInvoiceLinkErr) throw delInvoiceLinkErr;

    const { data: remaining, error: remainingErr } = await supabase
      .from('invoice_jobs').select('job_id').eq('invoice_id', invoice_id).eq('business_id', businessId);
    if (remainingErr) throw remainingErr;

    if (!remaining || remaining.length === 0) {
      const { error: voidErr } = await supabase.from('invoices')
        .update({ status: 'Void', deleted_at: new Date().toISOString() })
        .eq('id', invoice_id).eq('business_id', businessId);
      if (voidErr) throw voidErr;
    } else {
      const jobIds = remaining.map(r => r.job_id);
      const { data: jobs, error: jobsErr } = await supabase
        .from('jobs').select('*').in('id', jobIds).eq('business_id', businessId);
      if (jobsErr) throw jobsErr;
      const newTotal = (jobs ?? []).reduce((s, j) => s + computeJobFinancials(j).total, 0);
      const { error: totalErr } = await supabase.from('invoices')
        .update({ total_amount: newTotal, status: 'Draft' })
        .eq('id', invoice_id).eq('business_id', businessId);
      if (totalErr) throw totalErr;
    }
  }

  // 3. Revert job to pre-completion state
  const { error } = await supabase.from('jobs')
    .update({
      job_status: 'Scheduled',
      payment_status: '',
      payment_method: null,
      actual_duration: null,
      completion_notes: null,
      subtotal: null,
      hst_amount: null,
      total_amount: null,
    })
    .eq('id', id)
    .eq('business_id', businessId);
  if (error) throw error;
}

/**
 * Re-derives payment_status by comparing the non-void payments sum against the
 * job's recomputed total. The one source of truth for "is this job paid" —
 * called by recordPayment's logic and by updateJob's money-edit backstop.
 * Returns the derived status ('Paid' | 'Partial' | '').
 */
export async function rederivePaymentStatus(jobId) {
  const businessId = await getCurrentBusinessId();

  const [{ data: job, error: jErr }, { data: pays, error: pErr }, { data: biz, error: bErr }] = await Promise.all([
    supabase.from('jobs').select('*').eq('id', jobId).eq('business_id', businessId).single(),
    supabase.from('payments').select('amount').eq('job_id', jobId).eq('is_void', false),
    supabase.from('businesses').select('hst_rate, tax_enabled, hourly_rate').eq('id', businessId).single(),
  ]);
  if (jErr) throw jErr;
  if (pErr) throw pErr;
  if (bErr) throw bErr;

  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const total = computeJobFinancials(job, biz).total;
  const status = paid >= total - 0.01 && paid > 0 ? 'Paid' : paid > 0 ? 'Partial' : '';

  if (status !== job.payment_status) {
    const { error } = await supabase
      .from('jobs')
      .update({ payment_status: status })
      .eq('id', jobId)
      .eq('business_id', businessId);
    if (error) throw error;
  }
  return status;
}

// eslint-disable-next-line no-unused-vars
export async function recordPayment(jobId, amount, method = 'Cash', _paymentStatus = null, duration = null, jobNotes = null, additionalCosts = [], completionNotes = null, workerPaid = null, taxOverride = null) {
  const businessId = await getCurrentBusinessId();

  // 1. Get job info (need full fields for computeJobTotal to work correctly on hourly jobs)
  const { data: job, error: getErr } = await supabase
    .from('jobs')
    .select('client_id, business_id, total_amount, additional_cost, hst_amount, service_id, flat_rate, pricing_type, actual_duration, estimated_hours, additional_costs_json, job_status')
    .eq('id', jobId)
    .eq('business_id', businessId)
    .single();
  if (getErr) throw getErr;

  // 2. Insert into payments if amount > 0
  if (amount > 0) {
    const { data: payData, error: payErr } = await supabase
      .from('payments')
      .insert({
        business_id: businessId,
        job_id: jobId,
        client_id: job.client_id,
        amount: amount,
        payment_method: method,
        payment_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date()),
        notes: jobNotes,
      })
      .select();
    if (payErr) throw payErr;
    assertWrote(payData, 'recordPayment:insert');
  }

  const validCosts = (additionalCosts || []).filter(c => Number(c.amount) > 0);
  const costSum = validCosts.reduce((s, c) => s + Number(c.amount), 0);
  const costNotes = validCosts.map(c => c.description).filter(Boolean).join('; ');

  // 3. Always derive status from DB payments sum — never trust caller-supplied value
  const { data: existingPayments, error: paymentsErr } = await supabase
    .from('payments')
    .select('amount')
    .eq('job_id', jobId)
    .eq('is_void', false);
  if (paymentsErr) throw paymentsErr;
  const paid = (existingPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  // Compute total against the values being written, not the stale pre-completion DB row.
  // The DB row still has job_status='Scheduled' and the old actual_duration/costs at this point.
  const liveJob = {
    ...job,
    job_status: 'Completed',
    actual_duration: duration,
    ...(validCosts.length > 0 ? { additional_costs_json: validCosts, additional_cost: costSum } : {}),
    ...(taxOverride !== null ? { tax_enabled: taxOverride } : {}),
  };
  const financials = computeJobFinancials(liveJob);
  const total = financials.total;
  let status = paid >= total - 0.01 && paid > 0 ? 'Paid' : paid > 0 ? 'Partial' : (amount > 0 ? 'Partial' : '');

  const jobPatch = {
    payment_status: status,
    job_status: 'Completed',
    payment_method: amount > 0 ? method : null,
    actual_duration: duration,
    completion_notes: completionNotes,
    subtotal: financials.subtotal,
    hst_amount: financials.taxAmount,
    total_amount: financials.total,
    ...(taxOverride !== null ? { tax_enabled: taxOverride } : {}),
  };
  if (validCosts.length > 0) {
    jobPatch.additional_costs_json = validCosts;
    jobPatch.additional_cost = costSum;
    jobPatch.additional_cost_notes = costNotes || null;
  }

  const updated = await updateJob(jobId, jobPatch);
  if (workerPaid !== null) await markJobWorkerPaid(jobId, workerPaid);

  // 4. AUTO-LEARNING: Update service default duration based on moving average
  if (duration > 0 && job.service_id) {
    try {
      const { data: pastJobs } = await supabase
        .from('jobs')
        .select('actual_duration')
        .eq('service_id', job.service_id)
        .eq('business_id', businessId)
        .eq('job_status', 'Completed')
        .is('deleted_at', null)
        .not('actual_duration', 'is', null);

      if (pastJobs && pastJobs.length > 0) {
        const totalHours = pastJobs.reduce((sum, j) => sum + Number(j.actual_duration), 0);
        // Jobs run odd actual lengths (e.g. 73 min), but bookings only ever step in
        // 30-minute increments — snap the learned average to match, so the catalog
        // and new-job suggestions don't show ugly fractional hours like "2.28".
        const rawAvgMinutes = (totalHours / pastJobs.length) * 60;
        const avgMinutes = Math.max(30, Math.round(rawAvgMinutes / 30) * 30);

        await supabase
          .from('services')
          .update({ default_duration: avgMinutes })
          .eq('id', job.service_id)
          .eq('business_id', businessId);
          
        console.log(`[AI learning] Updated ${job.service_id} default duration to ${avgMinutes}m based on ${pastJobs.length} jobs.`);
      }
    } catch (learnErr) {
      console.warn('AI Learning Error (non-critical):', learnErr);
    }
  }

  // Generate or update invoice on every completion (creates on first complete, upgrades to Paid on full payment)
  try {
    await generateInvoiceForJob(jobId);
  } catch (invErr) {
    console.error('Auto Invoice Generation Error:', invErr);
  }

  triggerLearningEnrichment(job.client_id);
  return updated;
}

/**
 * Fetches completed, unpaid/partial jobs for a client — used by PostJobSheet
 * to offer Sandra the chance to bundle or settle them before the invoice PDF is opened.
 * Excludes the job that was just completed (excludeJobId).
 */
export async function fetchOutstandingJobsForClient(clientId, excludeJobId) {
  const businessId = await getCurrentBusinessId();
  const { data } = await supabase
    .from('jobs')
    .select('id, scheduled_date, payment_status, flat_rate, subtotal, pricing_type, actual_duration, estimated_hours, additional_cost, additional_costs_json, hst_amount, tax_enabled, services(name)')
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .eq('job_status', 'Completed')
    .is('deleted_at', null)
    .neq('id', excludeJobId)
    .order('scheduled_date', { ascending: true });
  return (data ?? []).filter(j => !j.payment_status || j.payment_status === 'Partial');
}

// ---------- helpers ----------

function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().split('T')[0];
}

function addMonthsToDateStr(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().split('T')[0];
}

// Adds a derived `scheduled_at` ISO string in America/Toronto for UI sorting / time math,
// plus derived flat worker-assignment convenience fields from `j.workers` —
// the resolved job_workers rows (pre-joined with worker name/person_type by
// the caller via jobWorkersRepo's batch fetch). The DB stores scheduled_date +
// scheduled_time separately.
function decorateJob(j) {
  if (!j) return j;
  const iso = _composeTorontoISO(j.scheduled_date, j.scheduled_time);
  // For completed jobs with a recorded actual_duration, use it so end times
  // everywhere (Home, Calendar, overlap checker) reflect what actually happened.
  const actualHrs = j.job_status === 'Completed' && Number(j.actual_duration) > 0
    ? Number(j.actual_duration)
    : null;
  const durationHours = actualHrs ?? (j.estimated_hours != null ? Number(j.estimated_hours) : 0);
  const durationMin = durationHours > 0 ? Math.round(durationHours * 60) : null;

  const workers = Array.isArray(j.workers) ? j.workers : [];
  const primary = workers[0] || null;

  return {
    ...j,
    scheduled_at: iso,
    duration_est: durationMin,
    workers,
    worker_id: primary?.worker_id ?? null,
    worker_name: primary?.name ?? null,
    worker_pay: primary?.pay ?? null,
    worker_paid: primary?.paid ?? false,
    assignee_type: primary?.person_type ?? null,
  };
}

// Returns jobs within `windowMinutes` of the given scheduled_at ISO string.
// Operates on already-fetched + decorated jobs (so the UI can pre-load and
// then check conflicts without a roundtrip).
// When a job has a known drive_to.durationValue (seconds), that travel time
// plus a 15-min comfort buffer replaces the flat windowMinutes threshold.
export function findConflicts(allJobs, scheduledAtISO, durationMin, windowMinutes = 60) {
  const t = new Date(scheduledAtISO).getTime();
  if (Number.isNaN(t)) return [];
  const endT = t + durationMin * 60_000;
  return allJobs.filter(j => {
    if (j.deleted_at) return false;
    const jt = new Date(j.scheduled_at).getTime();
    if (Number.isNaN(jt)) return false;
    const je = jt + ((j.duration_est ?? 0) * 60_000);
    const overlap = jt < endT && je > t;
    if (overlap) return true;
    const gap = Math.min(Math.abs(jt - endT), Math.abs(t - je));
    const driveS = j.ai_context?.drive_to?.durationValue ?? 0;
    const threshold = driveS > 0
      ? (Math.round(driveS / 60) + 15) * 60_000
      : windowMinutes * 60_000;
    return gap < threshold;
  });
}

// ---------- Safe ai_context patch (no GCal sync) ----------

// Use this instead of updateJob when only updating route/drive data.
// Does a fresh DB read before merging to avoid clobbering gcal_event_id
// written concurrently by the GCal sync handler.
export async function patchJobAiContext(id, contextPatch, columnPatch = {}) {
  const businessId = await getCurrentBusinessId();
  const { data: current, error: readErr } = await supabase
    .from('jobs')
    .select('ai_context')
    .eq('id', id)
    .eq('business_id', businessId)
    .single();
  if (readErr) throw readErr;

  const merged = { ...(current?.ai_context || {}), ...contextPatch };

  const { error } = await supabase
    .from('jobs')
    .update({ ai_context: merged, updated_at: new Date().toISOString(), ...columnPatch })
    .eq('id', id)
    .eq('business_id', businessId);
  if (error) throw error;
}

// ---------- GCal Sync + Learning ----------

function triggerLearningEnrichment(clientId) {
  if (!clientId) return;
  authHeaders()
    .then(headers => fetch('/api/ai/enrich-client', {
      method: 'POST',
      headers,
      body: JSON.stringify({ clientId }),
    }))
    .catch(err => console.error('Learning enrichment error:', err));
}

async function triggerGCalSync(jobId, action = 'upsert') {
  try {
    const res = await fetch('/api/sync/gcal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.status === 'token_expired') {
      window.dispatchEvent(new CustomEvent('gcal-token-expired'));
    }
  } catch (e) {
    console.error('GCal Sync Trigger Error:', e);
  }
}

// ---------- Normalization ----------

function normalizeJobPayload(payload) {
  if (!payload) return payload;
  const clean = { ...payload };
  
  // 1. Normalize Time (Force HH:mm:00)
  if (clean.scheduled_time && typeof clean.scheduled_time === 'string') {
    const parts = clean.scheduled_time.split(':');
    if (parts.length === 1 && parts[0].length === 4) { // handle "1000"
      clean.scheduled_time = `${parts[0].slice(0,2)}:${parts[0].slice(2,4)}:00`;
    } else if (parts.length === 2) { // handle "10:00"
      clean.scheduled_time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    } else if (parts.length === 3) { // handle "10:00:00"
      clean.scheduled_time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
    }
  }

  // 2. Ensure numbers are numbers
  if (clean.total_amount !== undefined) clean.total_amount = Number(clean.total_amount || 0);
  if (clean.estimated_hours !== undefined) clean.estimated_hours = Number(clean.estimated_hours || 0);

  return clean;
}
