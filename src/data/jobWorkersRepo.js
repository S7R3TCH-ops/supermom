// Data-access layer for job_workers (per-job worker assignment + pay) and
// worker_payouts (disbursement ledger). Replaces the old flat
// jobs.worker_id/worker_pay/worker_paid columns — see docs/plans (worker pay
// data model backend pass).
//
// Deliberately avoids PostgREST nested-embed selects (e.g. `workers(name)`)
// on the job_workers.worker_id FK — it's a brand-new FK as of this migration,
// and this codebase already avoids embedding on freshly-added FKs elsewhere
// (see workersRepo.js's fetchWorkersWithSkills) because PostgREST's schema
// cache isn't guaranteed to have picked it up yet. Batch-fetch + merge in JS
// instead, same pattern as fetchWorkersWithSkills.

import { supabase } from '../lib/supabase';
import { getCurrentBusinessId } from './currentBusiness';

async function attachWorkerNames(jobWorkerRows) {
  const workerIds = [...new Set(jobWorkerRows.map(r => r.worker_id))];
  let workerMap = {};
  if (workerIds.length > 0) {
    const { data: workerRows, error } = await supabase
      .from('workers')
      .select('id, name, person_type')
      .in('id', workerIds);
    if (error) throw error;
    workerMap = Object.fromEntries((workerRows ?? []).map(w => [w.id, w]));
  }
  return jobWorkerRows.map(r => rowToJobWorker(r, workerMap[r.worker_id]));
}

export async function fetchJobWorkers(jobId) {
  const businessId = await getCurrentBusinessId();
  if (!businessId || !jobId) return [];
  const { data, error } = await supabase
    .from('job_workers')
    .select('id, worker_id, pay, paid, paid_at, payout_id')
    .eq('job_id', jobId)
    .eq('business_id', businessId);
  if (error) throw error;
  return attachWorkerNames(data ?? []);
}

// Batch-fetch job_workers for many jobs at once (list screens) — returns
// { [jobId]: JobWorkerRow[] }.
export async function fetchJobWorkersForJobs(jobIds, businessId) {
  if (!jobIds || jobIds.length === 0) return {};
  const { data, error } = await supabase
    .from('job_workers')
    .select('id, job_id, worker_id, pay, paid, paid_at, payout_id')
    .in('job_id', jobIds)
    .eq('business_id', businessId);
  if (error) throw error;
  const decorated = await attachWorkerNames(data ?? []);
  const byJob = {};
  (data ?? []).forEach((row, i) => {
    if (!byJob[row.job_id]) byJob[row.job_id] = [];
    byJob[row.job_id].push(decorated[i]);
  });
  return byJob;
}

// Replace all job_workers rows for a job (delete + re-insert) — same pattern
// as workersRepo's setWorkerSkills. `workers` is [{ worker_id, pay, paid }].
// Preserves each worker's existing paid_at/payout_id when their paid state
// hasn't changed (e.g. editing a job's notes shouldn't restamp or sever a
// payout for a worker who was already marked paid) — only stamps a fresh
// paid_at when paid is newly flipping true right here.
export async function setJobWorkers(jobId, businessId, workers) {
  if (!businessId) throw new Error('No business');
  const { data: existing, error: exErr } = await supabase
    .from('job_workers')
    .select('worker_id, paid, paid_at, payout_id')
    .eq('job_id', jobId)
    .eq('business_id', businessId);
  if (exErr) throw exErr;
  const existingByWorker = Object.fromEntries((existing ?? []).map(r => [r.worker_id, r]));

  const { error: delError } = await supabase
    .from('job_workers')
    .delete()
    .eq('job_id', jobId)
    .eq('business_id', businessId);
  if (delError) throw delError;
  if (!workers || workers.length === 0) return [];

  const rows = workers.map(w => {
    const prior = existingByWorker[w.worker_id];
    const paid = !!w.paid;
    const paidChanged = !prior || !!prior.paid !== paid;
    return {
      business_id: businessId,
      job_id: jobId,
      worker_id: w.worker_id,
      pay: w.pay != null && w.pay !== '' ? Number(w.pay) : null,
      paid,
      paid_at: paid ? (paidChanged ? new Date().toISOString() : prior.paid_at) : null,
      payout_id: paidChanged ? null : (prior?.payout_id ?? null),
    };
  });
  const { data, error } = await supabase.from('job_workers').insert(rows).select('id, worker_id, pay, paid, paid_at, payout_id');
  if (error) throw error;
  return attachWorkerNames(data ?? []);
}

// Flips paid/paid_at for every job_workers row on a job — powers the "Team
// Member Paid?" toggle. Current UI is single-worker-per-job, so in practice
// this touches at most one row. Clears payout_id — a manual toggle isn't a
// bundled-payout settlement.
export async function markJobWorkerPaid(jobId, paid) {
  const businessId = await getCurrentBusinessId();
  const { error } = await supabase
    .from('job_workers')
    .update({ paid: !!paid, paid_at: paid ? new Date().toISOString() : null, payout_id: null })
    .eq('job_id', jobId)
    .eq('business_id', businessId);
  if (error) throw error;
}

// Bundles one or more job_workers rows into a single disbursement — the
// deferred "pay out multiple jobs at once" flow. No UI calls this yet this
// pass; the data model/repo function exist now since it's pure backend
// plumbing (see docs/plans).
export async function createWorkerPayout(businessId, workerId, { amount, payout_date, method, notes }, jobWorkerIds) {
  const { data: payout, error: payoutErr } = await supabase
    .from('worker_payouts')
    .insert({ business_id: businessId, worker_id: workerId, amount, payout_date, method, notes })
    .select()
    .single();
  if (payoutErr) throw payoutErr;

  if (jobWorkerIds && jobWorkerIds.length > 0) {
    const { error: linkErr } = await supabase
      .from('job_workers')
      .update({ payout_id: payout.id, paid: true, paid_at: new Date().toISOString() })
      .in('id', jobWorkerIds)
      .eq('business_id', businessId);
    if (linkErr) throw linkErr;
  }
  return payout;
}

function rowToJobWorker(row, worker) {
  return {
    id: row.id,
    worker_id: row.worker_id,
    name: worker?.name ?? null,
    person_type: worker?.person_type ?? null,
    pay: row.pay ?? null,
    paid: !!row.paid,
    paid_at: row.paid_at ?? null,
    payout_id: row.payout_id ?? null,
  };
}
