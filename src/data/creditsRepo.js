// Data-access layer for client_credits (client account credit ledger).
// Overpayment on a job auto-issues credit; the client's next job auto-applies
// it. Balance is always re-derived from the ledger (SUM(amount)), never
// cached — same pattern as payment_status. See docs/plans (client credit
// design, 2026-08-26).

import { supabase } from '../lib/supabase';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export async function getClientCreditBalance(businessId, clientId) {
  if (!businessId || !clientId) return 0;
  const { data, error } = await supabase
    .from('client_credits')
    .select('amount')
    .eq('business_id', businessId)
    .eq('client_id', clientId);
  if (error) throw error;
  return round2((data ?? []).reduce((s, r) => s + Number(r.amount), 0));
}

export async function getClientCreditHistory(businessId, clientId) {
  if (!businessId || !clientId) return [];
  const { data, error } = await supabase
    .from('client_credits')
    .select('id, job_id, amount, kind, created_at')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// The 'issued' ledger row for a specific job, if that job generated credit
// (used by JobDetailSheet's "mark as tip instead" control). Null if none.
export async function getJobIssuedCredit(businessId, jobId) {
  if (!businessId || !jobId) return null;
  const { data, error } = await supabase
    .from('client_credits')
    .select('id, client_id, job_id, amount, kind, created_at')
    .eq('business_id', businessId)
    .eq('job_id', jobId)
    .eq('kind', 'issued')
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function issueCredit(businessId, clientId, jobId, amount) {
  const { data, error } = await supabase
    .from('client_credits')
    .insert({ business_id: businessId, client_id: clientId, job_id: jobId, amount: round2(amount), kind: 'issued' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function applyCredit(businessId, clientId, jobId, amount) {
  const { data, error } = await supabase
    .from('client_credits')
    .insert({ business_id: businessId, client_id: clientId, job_id: jobId, amount: -round2(Math.abs(amount)), kind: 'applied' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Reclassifies an issued credit as a tip instead — only allowed while the
// full amount is still sitting unconsumed in the client's balance (i.e. no
// later job has already drawn it down). Throws otherwise so the UI can
// disable/hide the control.
export async function reclassifyToTip(businessId, clientId, jobId, amount) {
  const balance = await getClientCreditBalance(businessId, clientId);
  if (balance < round2(amount) - 0.009) {
    throw new Error('This credit has already been applied to a later job — it can no longer be reclassified as a tip.');
  }
  const { data, error } = await supabase
    .from('client_credits')
    .insert({ business_id: businessId, client_id: clientId, job_id: jobId, amount: -round2(Math.abs(amount)), kind: 'reclassified_to_tip' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
