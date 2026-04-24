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
  const { data, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Soft delete (deleted_at) — never hard delete (per CLAUDE.md).
export async function softDeleteClient(id) {
  return updateClient(id, { deleted_at: new Date().toISOString() });
}
