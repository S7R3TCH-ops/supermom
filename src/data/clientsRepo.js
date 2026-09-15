// Async data-access layer for clients.
// Backed by Supabase, queries the existing `clients` table from supabase_schema.sql.
// All queries are scoped by the caller's business_id (resolved via getCurrentBusinessId).

import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';

function assertWrote(data, op) {
  const rows = Array.isArray(data) ? data : (data ? [data] : []);
  if (rows.length === 0) throw new Error(`${op} failed — no rows changed (RLS or filter mismatch)`);
}

// Narrow select for list queries — drops phone2, referral_source, created_at (not accessed by UI).
// fetchClientById keeps * for full profile/edit views.
const SELECT_LIST = 'id, first_name, last_name, email, phone, street, city, province, postal_code, status, notes, access_info, tags, ai_context, pending_note, pending_note_source_job_id';

export async function fetchClients() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return []; // Global Admin fallback

  const { data, error } = await supabase
    .from('clients')
    .select(SELECT_LIST)
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
    .select('*')
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
    .select(SELECT_LIST)
    .eq('business_id', businessId)
    .is('deleted_at', null);

  if (email) {
    const { data: byEmail } = await query.eq('email', email).maybeSingle();
    if (byEmail) return byEmail;
  }

  if (!first_name || (!phone && !last_name)) return null;

  let nameQuery = supabase
    .from('clients')
    .select(SELECT_LIST)
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

// Set (or clear, with null args) the single in-flight carry-forward note on a client.
// A second carried note from a DIFFERENT job before the first is consumed APPENDS to it
// (2026-09-15 decision — silently replacing would lose whichever note completed first; she
// can backspace what she doesn't want on the next pre-fill).
// EXACT-repeat no-op guard: if this exact text was the last thing THIS job appended (verbatim
// tail match), skip the write — reachable via a partial-then-final payment re-triggering
// PostJobSheet's completion flow, or Admin's Revert-then-re-complete, with the checkbox still
// checked and the note untouched. Deliberately NOT a blind overwrite-on-same-job: if another
// job's note is still stacked ahead of this job's own segment (unconsumed), overwriting the
// whole field would silently delete it — the exact data-loss failure append exists to prevent,
// just triggered from a different angle. A same-job repeat with EDITED text still appends
// (a near-duplicate line, cosmetic, backspaceable) rather than risk deleting someone else's note.
export async function setPendingNote(clientId, noteText, sourceJobId) {
  if (noteText) {
    const businessId = await getCurrentBusinessId();
    const { data: existing, error: fetchError } = await supabase
      .from('clients')
      .select('pending_note, pending_note_source_job_id')
      .eq('id', clientId)
      .eq('business_id', businessId)
      .single();
    if (fetchError) throw fetchError;
    const prior = existing?.pending_note?.trim();
    const trimmedNote = noteText.trim();
    const sameSource = sourceJobId && existing?.pending_note_source_job_id === sourceJobId;
    if (sameSource && prior && prior.endsWith(trimmedNote)) return existing; // exact repeat, no-op
    noteText = prior ? `${prior}\n\n${noteText}` : noteText;
  }
  return updateClient(clientId, {
    pending_note: noteText,
    pending_note_source_job_id: sourceJobId,
  });
}

// Soft delete (deleted_at) — never hard delete (per CLAUDE.md).
export async function softDeleteClient(id) {
  return updateClient(id, { deleted_at: new Date().toISOString() });
}

export async function hardDeleteClient(clientId) {
  const businessId = await getCurrentBusinessId();
  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('id')
    .eq('client_id', clientId)
    .eq('business_id', businessId);
  if (jobsErr) throw jobsErr;
  for (const job of jobs ?? []) {
    const { error: payErr } = await supabase.from('payments').delete().eq('job_id', job.id).eq('business_id', businessId);
    if (payErr) throw payErr;
    const { error: linkErr } = await supabase.from('invoice_jobs').delete().eq('job_id', job.id).eq('business_id', businessId);
    if (linkErr) throw linkErr;
    const { error: jobDelErr } = await supabase.from('jobs').delete().eq('id', job.id).eq('business_id', businessId);
    if (jobDelErr) throw jobDelErr;
  }
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('business_id', businessId);
  if (error) throw error;
}

