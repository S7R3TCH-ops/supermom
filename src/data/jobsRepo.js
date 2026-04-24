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
    .select('*, clients(first_name, last_name)')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const c = data.clients;
  const clientName = c
    ? [c.first_name, c.last_name].filter(Boolean).join(' ')
    : 'Unknown';
  return { ...decorateJob(data), client_name: clientName };
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
  const { data, error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return decorateJob(data);
}

export async function softDeleteJob(id) {
  return updateJob(id, { deleted_at: new Date().toISOString() });
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

// April 2026 is DST → -04:00. Nov–Mar would be -05:00.
function composeTorontoISO(dateStr, timeStr) {
  if (!dateStr) return null;
  const t = (timeStr || '00:00').slice(0, 5);
  const month = parseInt(dateStr.slice(5, 7), 10);
  const day = parseInt(dateStr.slice(8, 10), 10);
  const isDST = (month > 3 && month < 11) ||
    (month === 3 && day >= 8) ||
    (month === 11 && day < 1);
  return `${dateStr}T${t}:00${isDST ? '-04:00' : '-05:00'}`;
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
