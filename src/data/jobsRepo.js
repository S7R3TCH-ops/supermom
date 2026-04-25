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
    .select(`${SELECT_FULL}, clients(first_name, last_name)`)
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
  return { ...decorateJob(jobRow), client_name: clientName };
}

export async function createJob(payload) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...payload, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return decorateJob(data);
}

export async function updateJob(id, patch) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();
  if (error) throw error;
  return decorateJob(data);
}

export async function softDeleteJob(id) {
  return updateJob(id, { deleted_at: new Date().toISOString() });
}

export async function recordPayment(jobId, amount, method = 'Cash', notes = null) {
  const businessId = await getCurrentBusinessId();

  // 1. Get job info (we need client_id)
  const { data: job, error: getErr } = await supabase
    .from('jobs')
    .select('client_id, business_id')
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
  return updateJob(jobId, {
    payment_status: 'Paid',
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
