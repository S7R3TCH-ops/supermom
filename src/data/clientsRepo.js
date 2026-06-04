// Async data-access layer for clients.
// Backed by Supabase, queries the existing `clients` table from supabase_schema.sql.
// All queries are scoped by the caller's business_id (resolved via getCurrentBusinessId).

import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';

function assertWrote(data, op) {
  const rows = Array.isArray(data) ? data : (data ? [data] : []);
  if (rows.length === 0) throw new Error(`${op} failed — no rows changed (RLS or filter mismatch)`);
}

const SELECT_FULL = '*';

export async function fetchClients() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return []; // Global Admin fallback

  const { data, error } = await supabase
    .from('clients')
    .select(SELECT_FULL)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('first_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchClientById(id) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return null;

  const { data, error } = await supabase
    .from('clients')
    .select(SELECT_FULL)
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchClientByContact({ email, first_name, last_name, phone }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return null;

  let query = supabase
    .from('clients')
    .select(SELECT_FULL)
    .eq('business_id', businessId)
    .is('deleted_at', null);

  if (email) {
    const { data: byEmail } = await query.eq('email', email).maybeSingle();
    if (byEmail) return byEmail;
  }

  if (!first_name || (!phone && !last_name)) return null;

  let nameQuery = supabase
    .from('clients')
    .select(SELECT_FULL)
    .eq('business_id', businessId)
    .eq('first_name', first_name)
    .is('deleted_at', null);
  if (last_name) nameQuery = nameQuery.eq('last_name', last_name);
  else nameQuery = nameQuery.is('last_name', null);
  if (phone) nameQuery = nameQuery.eq('phone', phone);
  else nameQuery = nameQuery.is('phone', null);

  const { data: byNamePhone } = await nameQuery.maybeSingle();
  return byNamePhone;
}

export async function createClient(payload) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) throw new Error('No active business — switch to a business viewpoint first');

  // Pre-check for duplicates
  const existing = await fetchClientByContact(payload);
  if (existing) {
    throw new Error(`A client with this ${(payload.email && existing.email === payload.email) ? 'email' : 'name/phone'} already exists.`);
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...payload, business_id: businessId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(id, patch) {
  const businessId = await getCurrentBusinessId();
  const { data, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single();
  if (error) throw error;
  assertWrote(data, 'updateClient');
  return data;
}

// Soft delete (deleted_at) — never hard delete (per CLAUDE.md).
export async function softDeleteClient(id) {
  return updateClient(id, { deleted_at: new Date().toISOString() });
}

export async function hardDeleteClient(clientId) {
  const businessId = await getCurrentBusinessId();
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('client_id', clientId)
    .eq('business_id', businessId);
  for (const job of jobs ?? []) {
    await supabase.from('payments').delete().eq('job_id', job.id);
    await supabase.from('invoice_jobs').delete().eq('job_id', job.id);
    await supabase.from('jobs').delete().eq('id', job.id).eq('business_id', businessId);
  }
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('business_id', businessId);
  if (error) throw error;
}

export async function simulateAILearning(id, clientName) {
  const patch = {
    ai_context: {
      learned: {
        version: "1.0",
        last_enriched_at: new Date().toISOString(),
        last_enriched_job_count: 10,
        duration_patterns: {
          average_duration_hours: 3.5,
          frequency_per_month: 2,
          preferred_time: "09:00",
          variability_score: 0.1
        },
        payment_method_preference: "e-Transfer",
        preferred_time_of_day: "Morning",
        preferred_day_of_week: "Tuesday",
        behavioral_flags: ["Prefers label maker", "Values logical flow", "Gate code usually 1234"],
        synthesis_note: `After 10 sessions, I've learned that ${clientName.split(' ')[0]} prefers the back entrance and always double checks the pantry labels. This client is very appreciative of detailed system walkthroughs and prefers being messaged 15 mins before arrival.`
      }
    }
  };
  return updateClient(id, patch);
}
