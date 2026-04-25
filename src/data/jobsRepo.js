// Async data-access layer for jobs.
// Backed by Supabase, queries the existing `jobs` table from supabase_schema.sql.
// scheduled_date (date) + scheduled_time (time) are stored separately — helpers
// here combine them into Toronto-local ISO strings for the UI.

import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';

const SELECT_FULL = '*';

export async function fetchActiveJobs() {
  const businessId = await getCurrentBusinessId();
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

  if (recurrence && recurrence !== 'None') {
    return createRecurringSeries(payload, businessId);
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...payload, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  const decorated = decorateJob(data);
  triggerGCalSync(decorated.id, 'upsert');
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
  let currentDate = new Date(payload.scheduled_date + 'T12:00:00'); // Use noon to avoid date shifting

  for (let i = 0; i < count; i++) {
    const dateStr = currentDate.toISOString().split('T')[0];
    occurrences.push({
      ...payload,
      business_id: businessId,
      template_id: template.id,
      scheduled_date: dateStr,
      ai_context: {
        ...(payload.ai_context || {}),
        template_id: template.id, // Keep AI capable
        occurrence_index: i,
      }
    });

    // Advance date
    if (template.frequency === 'Weekly') currentDate.setDate(currentDate.getDate() + 7);
    else if (template.frequency === 'Biweekly') currentDate.setDate(currentDate.getDate() + 14);
    else if (template.frequency === 'Monthly') currentDate.setMonth(currentDate.getMonth() + 1);
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert(occurrences)
    .select();
  if (error) throw error;

  const results = data.map(decorateJob);
  // Sync all occurrences to GCal
  results.forEach(job => triggerGCalSync(job.id, 'upsert'));
  
  return results[0];
}

export async function updateJob(id, patch, seriesAction = 'this') {
  const businessId = await getCurrentBusinessId();

  if (seriesAction === 'this') {
    const { data, error } = await supabase
      .from('jobs')
      .update(patch)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    if (error) throw error;
    const decorated = decorateJob(data);
    triggerGCalSync(id, 'upsert');
    return decorated;
  }

  // For 'future' or 'all', we need context from the current job
  const { data: job, error: fErr } = await supabase
    .from('jobs')
    .select('template_id, scheduled_date')
    .eq('id', id)
    .single();
  if (fErr) throw fErr;
  if (!job.template_id) return updateJob(id, patch, 'this');

  let query = supabase
    .from('jobs')
    .update(patch)
    .eq('template_id', job.template_id)
    .eq('business_id', businessId);

  if (seriesAction === 'future') {
    query = query.gte('scheduled_date', job.scheduled_date);
  }

  const { data, error } = await query.select();
  if (error) throw error;

  // Sync affected jobs (limited to avoid blast)
  data.slice(0, 5).forEach(j => triggerGCalSync(j.id, 'upsert'));

  // Update the template itself if 'all'
  if (seriesAction === 'all') {
    await supabase
      .from('job_templates')
      .update({
        service_name: patch.service_name,
        preferred_time: patch.scheduled_time,
        pricing_type: patch.pricing_type,
        estimated_hours: patch.estimated_hours,
        flat_rate: patch.flat_rate,
        notes: patch.job_notes,
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
    triggerGCalSync(id, 'delete');
    return decorateJob(data);
  }

  const { data: job, error: fErr } = await supabase
    .from('jobs')
    .select('template_id, scheduled_date')
    .eq('id', id)
    .single();
  if (fErr) throw fErr;
  if (!job.template_id) return softDeleteJob(id, 'this');

  let query = supabase
    .from('jobs')
    .update({ deleted_at: deletedAt })
    .eq('template_id', job.template_id)
    .eq('business_id', businessId);

  if (seriesAction === 'future') {
    query = query.gte('scheduled_date', job.scheduled_date);
  }

  const { data, error } = await query.select();
  if (error) throw error;

  data.slice(0, 5).forEach(j => triggerGCalSync(j.id, 'delete'));

  if (seriesAction === 'all') {
    await supabase
      .from('job_templates')
      .update({ deleted_at: deletedAt, active: false })
      .eq('id', job.template_id);
  }

  return decorateJob(data[0]);
}

export async function recordPayment(jobId, amount, method = 'Cash', notes = null) {
  const businessId = await getCurrentBusinessId();

  // 1. Get job info (we need client_id and total_amount)
  const { data: job, error: getErr } = await supabase
    .from('jobs')
    .select('client_id, business_id, total_amount')
    .eq('id', jobId)
    .single();
  if (getErr) throw getErr;

  // 2. Insert into payments
  const { error: payErr } = await supabase
    .from('payments')
    .insert({
      business_id: businessId,
      job_id: jobId,
      client_id: job.client_id,
      amount: amount,
      payment_method: method,
      payment_date: new Date().toISOString().split('T')[0],
      notes: notes,
    });
  if (payErr) throw payErr;

  // 3. Update job status
  const status = amount >= (job.total_amount || 0) ? 'Paid' : 'Partial';

  return updateJob(jobId, {
    payment_status: status,
    job_status: 'Completed',
    payment_method: method // also update this field on the job table for redundancy/quick lookup
  });
}

// ---------- helpers ----------

// Adds a derived `scheduled_at` ISO string in America/Toronto for UI sorting / time math.
// The DB stores scheduled_date + scheduled_time separately.
function decorateJob(j) {
  if (!j) return j;
  const iso = composeTorontoISO(j.scheduled_date, j.scheduled_time);
  const durationMin = j.estimated_hours != null ? Math.round(Number(j.estimated_hours) * 60) : null;
  return { ...j, scheduled_at: iso, duration_est: durationMin };
}

function composeTorontoISO(dateStr, timeStr) {
  if (!dateStr) return null;
  const t = (timeStr || '00:00').slice(0, 5);
  const [year, month, day] = dateStr.split('-').map(Number);
  const dstStart = nthSunday(year, 3, 2);  // 2nd Sunday in March
  const dstEnd   = nthSunday(year, 11, 1); // 1st Sunday in November
  const date  = new Date(Date.UTC(year, month - 1, day));
  const start = new Date(Date.UTC(year, 2,  dstStart));
  const end   = new Date(Date.UTC(year, 10, dstEnd));
  const isDST = date >= start && date < end;
  return `${dateStr}T${t}:00${isDST ? '-04:00' : '-05:00'}`;
}

function nthSunday(year, month, n) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const offset = first === 0 ? 0 : 7 - first;
  return 1 + offset + (n - 1) * 7;
}

// Returns jobs within `windowMinutes` of the given scheduled_at ISO string.
// Operates on already-fetched + decorated jobs (so the UI can pre-load and
// then check conflicts without a roundtrip).
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
    return gap < windowMinutes * 60_000;
  });
}

// ---------- GCal Sync ----------

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
