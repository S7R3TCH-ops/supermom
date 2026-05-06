// Async data-access layer for jobs.
// Backed by Supabase, queries the existing `jobs` table from supabase_schema.sql.
// scheduled_date (date) + scheduled_time (time) are stored separately — helpers
// here combine them into Toronto-local ISO strings for the UI.

import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';
import { generateInvoiceForJob } from './invoicesRepo';

function assertWrote(data, op) {
  const rows = Array.isArray(data) ? data : (data ? [data] : []);
  if (rows.length === 0) throw new Error(`${op} failed — no rows changed (RLS or filter mismatch)`);
}

const SELECT_FULL = '*';

export async function fetchActiveJobs() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return [];

  const { data, error } = await supabase
    .from('jobs')
    .select(SELECT_FULL)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(decorateJob);
}

export async function fetchJobsByClientId(clientId) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return [];

  const { data, error } = await supabase
    .from('jobs')
    .select(SELECT_FULL)
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(decorateJob);
}

export async function fetchJobById(id) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return null;

  const { data, error } = await supabase
    .from('jobs')
    .select(`${SELECT_FULL}, clients(first_name, last_name, notes, ai_context, tags)`)
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
  return {
    ...decorateJob(jobRow),
    client_name: clientName,
    client_notes: c?.notes || '',
    client_ai_context: c?.ai_context || {},
    client_tags: c?.tags || [],
  };
}

export async function createJob(payload) {
  const businessId = await getCurrentBusinessId();
  const recurrence = payload.ai_context?.recurrence_rule;
  const cleanPayload = normalizeJobPayload(payload);

  if (recurrence && recurrence !== 'None') {
    return createRecurringSeries(cleanPayload, businessId);
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...cleanPayload, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  const decorated = decorateJob(data);
  await triggerGCalSync(decorated.id, 'upsert');
  return decorated;
}

async function createRecurringSeries(payload, businessId) {
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

  const results = data.map(decorateJob);
  // Sync all occurrences to GCal
  await Promise.allSettled(results.map(j => triggerGCalSync(j.id, 'upsert')));
  
  return results[0];
}

export async function updateJob(id, patch, seriesAction = 'this') {
  const businessId = await getCurrentBusinessId();
  const cleanPatch = { ...normalizeJobPayload(patch), updated_at: new Date().toISOString() };

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
    const decorated = decorateJob(data);
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
  if (!job.template_id) return updateJob(id, cleanPatch, 'this');

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
      .eq('id', job.template_id);
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
      .eq('id', job.template_id);
  }

  return decorateJob(data[0]);
}

export async function recordPayment(jobId, amount, method = 'Cash', notes = null, duration = null, jobNotes = null) {
  const businessId = await getCurrentBusinessId();

  // 1. Get job info (we need client_id, total_amount, and service_id for learning)
  const { data: job, error: getErr } = await supabase
    .from('jobs')
    .select('client_id, business_id, total_amount, service_id')
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
        payment_date: new Date().toISOString().split('T')[0],
        notes: notes,
      })
      .select();
    if (payErr) throw payErr;
    assertWrote(payData, 'recordPayment:insert');
  }

  // 3. Derive payment status from sum of all non-void payments for this job
  const { data: existingPayments } = await supabase
    .from('payments')
    .select('amount')
    .eq('job_id', jobId)
    .eq('is_void', false);
  const paid = (existingPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(job.total_amount || 0);
  const status = paid >= total && paid > 0 ? 'Paid' : paid > 0 ? 'Partial' : '';

  const updated = await updateJob(jobId, {
    payment_status: status,
    job_status: 'Completed',
    payment_method: amount > 0 ? method : null,
    actual_duration: duration,
    job_notes: jobNotes
  });

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
        const avgMinutes = Math.round((totalHours / pastJobs.length) * 60);
        
        await supabase
          .from('services')
          .update({ default_duration: avgMinutes })
          .eq('id', job.service_id);
          
        console.log(`[AI learning] Updated ${job.service_id} default duration to ${avgMinutes}m based on ${pastJobs.length} jobs.`);
      }
    } catch (learnErr) {
      console.warn('AI Learning Error (non-critical):', learnErr);
    }
  }

  // Automatically generate invoice if completed
  try {
    await generateInvoiceForJob(jobId);
  } catch (invErr) {
    console.error('Auto Invoice Generation Error:', invErr);
  }

  triggerLearningEnrichment(job.client_id);
  return updated;
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

// Adds a derived `scheduled_at` ISO string in America/Toronto for UI sorting / time math.
// The DB stores scheduled_date + scheduled_time separately.
function decorateJob(j) {
  if (!j) return j;
  const iso = composeTorontoISO(j.scheduled_date, j.scheduled_time);
  const durationMin = j.estimated_hours != null ? Math.round(Number(j.estimated_hours) * 60) : null;
  return { ...j, scheduled_at: iso, duration_est: durationMin };
}

export function composeTorontoISO(dateStr, timeStr) {
  if (!dateStr) return null;
  
  // Ensure we have a valid HH:mm format, stripping any seconds if present
  let t = '00:00';
  if (timeStr && typeof timeStr === 'string') {
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      t = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  try {
    const dstStart = nthSunday(year, 3, 2);  // 2nd Sunday in March
    const dstEnd   = nthSunday(year, 11, 1); // 1st Sunday in November
    const date  = new Date(Date.UTC(year, month - 1, day));
    const start = new Date(Date.UTC(year, 2,  dstStart));
    const end   = new Date(Date.UTC(year, 10, dstEnd));
    const isDST = date >= start && date < end;
    return `${dateStr}T${t}:00${isDST ? '-04:00' : '-05:00'}`;
  } catch (e) {
    console.error('Error composing ISO date:', e);
    return null;
  }
}

function nthSunday(year, month, n) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const offset = first === 0 ? 0 : 7 - first;
  return 1 + offset + (n - 1) * 7;
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

// ---------- GCal Sync + Learning ----------

function triggerLearningEnrichment(clientId) {
  if (!clientId) return;
  fetch('/api/ai/enrich-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  }).catch(err => console.error('Learning enrichment error:', err));
}

async function triggerGCalSync(jobId, action = 'upsert') {
  try {
    // We fire and forget, but log errors
    fetch('/api/sync/gcal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, action })
    }).catch(err => console.error('GCal Sync Trigger Error:', err));
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
