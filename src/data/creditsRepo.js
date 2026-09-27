// Data-access layer for client_credits (client account credit ledger).
// Overpayment on a job auto-issues credit; the client's next job auto-applies
// it. Balance is always re-derived from the ledger (SUM(amount)), never
// cached — same pattern as payment_status. See docs/plans (client credit
// design, 2026-08-26).

import { supabase } from '../lib/supabase';
import { computeJobTotal } from '../lib/financialMath';

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

export async function applyCreditToJobs(businessId, clientId, allocations) {
  if (!businessId || !clientId || !allocations || allocations.length === 0) {
    return { payments: [], ledgers: [], applied: [], totalApplied: 0 };
  }
  const totalAllocations = allocations.reduce((s, a) => s + round2(a.amount), 0);
  const balance = await getClientCreditBalance(businessId, clientId);
  if (totalAllocations > balance + 0.009) {
    throw new Error('Allocated amount exceeds available credit');
  }

  const createdPayments = [];
  const createdLedgers = [];
  const applied = [];

  for (const alloc of allocations) {
    const [{ data: job, error: jobErr }, { data: existingPayments, error: paymentsErr }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', alloc.jobId).eq('business_id', businessId).single(),
      supabase.from('payments').select('amount').eq('job_id', alloc.jobId).eq('business_id', businessId).eq('is_void', false),
    ]);
    if (jobErr) throw jobErr;
    if (paymentsErr) throw paymentsErr;

    const alreadyPaid = (existingPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const total = Math.round(computeJobTotal(job) * 100) / 100;
    const currentOwing = Math.max(0, Math.round((total - alreadyPaid) * 100) / 100);

    if (currentOwing <= 0.009) continue;

    const amountToApply = round2(Math.min(alloc.amount, currentOwing));
    if (amountToApply <= 0.009) continue;

    const payDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
    const { data: pData, error: pErr } = await supabase.from('payments').insert({
      business_id: businessId,
      client_id: clientId,
      job_id: alloc.jobId,
      amount: amountToApply,
      payment_method: 'Credit',
      payment_date: payDate,
    }).select().single();
    if (pErr) throw pErr;
    createdPayments.push(pData);

    const cData = await applyCredit(businessId, clientId, alloc.jobId, amountToApply);
    createdLedgers.push(cData);

    const newPaid = alreadyPaid + amountToApply;
    const status = newPaid >= total - 0.01 && newPaid > 0 ? 'Paid' : newPaid > 0 ? 'Partial' : '';
    const { error: statusErr } = await supabase.from('jobs').update({ payment_status: status }).eq('id', alloc.jobId).eq('business_id', businessId);
    if (statusErr) throw statusErr;

    applied.push({ jobId: alloc.jobId, amount: amountToApply, payment: pData, ledger: cData });
  }

  return {
    payments: createdPayments,
    ledgers: createdLedgers,
    applied,
    totalApplied: round2(applied.reduce((s, a) => s + a.amount, 0)),
  };
}

export async function moveCreditBackFromJob(businessId, clientId, jobId) {
  const { data: pays, error: paysErr } = await supabase.from('payments')
    .select('id, amount')
    .eq('business_id', businessId)
    .eq('job_id', jobId)
    .eq('payment_method', 'Credit')
    .eq('is_void', false);
  if (paysErr) throw paysErr;

  const { data: ledgers, error: ledgersErr } = await supabase.from('client_credits')
    .select('id, amount')
    .eq('business_id', businessId)
    .eq('job_id', jobId)
    .eq('kind', 'applied');
  if (ledgersErr) throw ledgersErr;

  if ((!pays || pays.length === 0) && (!ledgers || ledgers.length === 0)) {
    return { voidedPayments: 0, deletedLedgerRows: 0 };
  }

  if (pays && pays.length > 0) {
    const { error: voidErr } = await supabase.from('payments')
      .update({ is_void: true })
      .in('id', pays.map(p => p.id))
      .eq('business_id', businessId);
    if (voidErr) throw voidErr;
  }

  if (ledgers && ledgers.length > 0) {
    const { error: delErr } = await supabase.from('client_credits')
      .delete()
      .in('id', ledgers.map(l => l.id))
      .eq('business_id', businessId);
    if (delErr) throw delErr;
  }

  const [{ data: job, error: jobErr }, { data: remaining, error: remErr }] = await Promise.all([
    supabase.from('jobs').select('*').eq('id', jobId).eq('business_id', businessId).single(),
    supabase.from('payments').select('amount').eq('job_id', jobId).eq('business_id', businessId).eq('is_void', false),
  ]);
  if (jobErr) throw jobErr;
  if (remErr) throw remErr;
  if (job) {
    const paid = (remaining ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const total = Math.round(computeJobTotal(job) * 100) / 100;
    const status = paid >= total - 0.01 && paid > 0 ? 'Paid' : paid > 0 ? 'Partial' : '';
    const { error: statusErr } = await supabase.from('jobs').update({ payment_status: status }).eq('id', jobId).eq('business_id', businessId);
    if (statusErr) throw statusErr;
  }

  return { voidedPayments: pays?.length || 0, deletedLedgerRows: ledgers?.length || 0 };
}

