// Async data-access layer for clients.
// Backed by Supabase, queries the existing `clients` table from supabase_schema.sql.
// All queries are scoped by the caller's business_id (resolved via getCurrentBusinessId).

import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';

const SELECT_FULL = '*';

export async function fetchClients() {
  const businessId = await getCurrentBusinessId();
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
  const { data, error } = await supabase
    .from('clients')
    .select(SELECT_FULL)
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createClient(payload) {
  const businessId = await getCurrentBusinessId();
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
  return data;
}

// Soft delete (deleted_at) — never hard delete (per CLAUDE.md).
export async function softDeleteClient(id) {
  return updateClient(id, { deleted_at: new Date().toISOString() });
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
        behavioral_flags: ["Picky about pet hair", "Values quiet while working", "Gate code usually 1234"],
        synthesis_note: `After 10 sessions, I've learned that ${clientName.split(' ')[0]} prefers the back entrance and always checks the baseboards. This client is very appreciative of detailed invoices and prefers being messaged 15 mins before arrival.`
      }
    }
  };
  return updateClient(id, patch);
}
