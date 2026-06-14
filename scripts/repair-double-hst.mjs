// Diagnoses and repairs payment amounts corrupted by the double-HST bug.
//
// Usage:
//   node scripts/repair-double-hst.mjs <clientId>          -- show discrepancies (dry run)
//   node scripts/repair-double-hst.mjs <clientId> --apply  -- fix the data
//
// Requirements: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const clientId = process.argv[2];
const apply = process.argv.includes('--apply');

if (!clientId) {
  console.error('\nUsage: node scripts/repair-double-hst.mjs <clientId> [--apply]\n');
  console.error('Find clientId via: node scripts/inspect.mjs\n');
  process.exit(1);
}

function correctFinancials(job, business) {
  const isHourly = job.pricing_type === 'Hourly';

  let subtotal = 0;
  if (isHourly) {
    const hours = Number(job.actual_duration ?? job.estimated_hours ?? 0);
    const rate = Number(job.flat_rate ?? business?.hourly_rate ?? 60);
    subtotal = hours * rate;
  } else {
    // flat_rate is the pre-tax booking rate (never post-tax)
    // subtotal DB column is also pre-tax base (written by recordPayment)
    // total_amount is tax-inclusive after completion — never use as subtotal
    const flat = Number(job.flat_rate ?? job.subtotal ?? 0);
    subtotal = isNaN(flat) ? 0 : flat;
  }

  const additionalTotal = (Array.isArray(job.additional_costs_json) ? job.additional_costs_json : [])
    .reduce((s, c) => s + Number(c.amount || 0), 0);

  const taxRate = Number(business?.hst_rate ?? 0.13);
  const perJobTax = job.tax_enabled;
  const hasTaxOverride = perJobTax !== null && perJobTax !== undefined;
  let taxAmount = 0;

  if (hasTaxOverride) {
    taxAmount = perJobTax ? (subtotal + additionalTotal) * taxRate : 0;
  } else if (business?.tax_enabled) {
    taxAmount = (subtotal + additionalTotal) * taxRate;
  }

  return {
    subtotal: round(subtotal),
    additionalTotal: round(additionalTotal),
    hstAmount: round(taxAmount),
    total: round(subtotal + additionalTotal + taxAmount),
  };
}

function round(n) { return Math.round(n * 100) / 100; }
function fmt(n) { return `$${Number(n).toFixed(2)}`; }

async function main() {
  // Resolve the client's business
  const { data: clientRow, error: cErr } = await sb.from('clients').select('business_id, first_name, last_name').eq('id', clientId).single();
  if (cErr || !clientRow) { console.error('Client not found:', clientId, cErr?.message); process.exit(1); }

  const clientName = [clientRow.first_name, clientRow.last_name].filter(Boolean).join(' ');
  const { data: business } = await sb.from('businesses').select('*').eq('id', clientRow.business_id).single();

  console.log(`\nClient: ${clientName} (${clientId})`);
  console.log(`Business: ${business?.name} | HST rate: ${(Number(business?.hst_rate ?? 0.13) * 100).toFixed(0)}% | Tax enabled: ${business?.tax_enabled}`);
  console.log('─'.repeat(80));

  // Fetch completed jobs
  const { data: jobs } = await sb
    .from('jobs')
    .select('id, scheduled_date, service_name, pricing_type, flat_rate, subtotal, hst_amount, total_amount, actual_duration, estimated_hours, additional_costs_json, tax_enabled, payment_status')
    .eq('client_id', clientId)
    .eq('business_id', clientRow.business_id)
    .eq('job_status', 'Completed')
    .is('deleted_at', null)
    .order('scheduled_date');

  if (!jobs?.length) { console.log('No completed jobs found.'); return; }

  // Fetch all payments for those jobs
  const { data: payments } = await sb
    .from('payments')
    .select('id, job_id, amount, payment_date, payment_method')
    .in('job_id', jobs.map(j => j.id))
    .eq('is_void', false)
    .order('payment_date');

  const paysByJob = {};
  for (const p of payments || []) {
    (paysByJob[p.job_id] = paysByJob[p.job_id] || []).push(p);
  }

  const fixes = [];

  for (const job of jobs) {
    const correct = correctFinancials(job, business);
    const jobPays = paysByJob[job.id] || [];
    const paidSum = round(jobPays.reduce((s, p) => s + Number(p.amount), 0));
    const storedTotal = round(Number(job.total_amount));

    const totalMismatch = Math.abs(storedTotal - correct.total) > 0.02;
    const payMismatch = jobPays.length > 0 && Math.abs(paidSum - correct.total) > 0.02;
    const hasIssue = totalMismatch || payMismatch;

    if (!hasIssue) {
      console.log(`\n✓  ${job.scheduled_date}  ${job.service_name}  ${fmt(storedTotal)}  — OK`);
      continue;
    }

    console.log(`\n⚠️  ${job.scheduled_date}  ${job.service_name}  [${job.id}]`);
    console.log(`   flat_rate: ${job.flat_rate != null ? fmt(job.flat_rate) : 'NULL'}  |  subtotal DB: ${job.subtotal != null ? fmt(job.subtotal) : 'NULL'}`);
    console.log(`   Stored total_amount: ${fmt(storedTotal)}  →  Correct: ${fmt(correct.total)}  (subtotal ${fmt(correct.subtotal)} + add'l ${fmt(correct.additionalTotal)} + HST ${fmt(correct.hstAmount)})`);
    console.log(`   Payments recorded: ${fmt(paidSum)} (${jobPays.length} payment(s))  |  Should be: ${fmt(correct.total)}`);

    if (!job.flat_rate && !job.subtotal) {
      console.log(`   ⛔ Cannot auto-fix: flat_rate and subtotal are both null — set flat_rate manually first`);
    } else {
      fixes.push({ job, correct, pays: jobPays, paidSum });
    }
  }

  console.log('\n' + '─'.repeat(80));

  if (fixes.length === 0) {
    console.log('No auto-fixable discrepancies. Done.\n');
    return;
  }

  if (!apply) {
    console.log(`Found ${fixes.length} job(s) to fix. Re-run with --apply to update the database.\n`);
    return;
  }

  // ── Apply fixes ──────────────────────────────────────────────────────────────
  console.log('Applying fixes...\n');

  for (const { job, correct, pays, paidSum } of fixes) {
    // 1. Fix job financial columns
    const { error: jobErr } = await sb.from('jobs').update({
      subtotal: correct.subtotal,
      hst_amount: correct.hstAmount,
      total_amount: correct.total,
    }).eq('id', job.id);

    if (jobErr) { console.error(`  ✗ Job update failed [${job.id}]:`, jobErr.message); continue; }
    console.log(`  ✓ Job ${job.scheduled_date} ${job.service_name}: total_amount ${fmt(job.total_amount)} → ${fmt(correct.total)}`);

    // 2. Fix payment amounts
    if (pays.length === 0) {
      console.log(`     No payment records — job columns corrected, nothing else to update`);
    } else if (pays.length === 1 && Math.abs(Number(pays[0].amount) - round(Number(job.total_amount))) < 0.02) {
      // Single payment equalling the (now-corrected) wrong total → update it to the correct total
      const { error: pErr } = await sb.from('payments').update({ amount: correct.total }).eq('id', pays[0].id);
      if (pErr) { console.error(`     ✗ Payment update failed:`, pErr.message); }
      else console.log(`     Payment updated: ${fmt(pays[0].amount)} → ${fmt(correct.total)}`);
    } else {
      console.log(`     ⚠️  ${pays.length} payment records — review manually (can't auto-merge):`);
      for (const p of pays) console.log(`       ${p.payment_date}  ${fmt(p.amount)}  (${p.payment_method})  id: ${p.id}`);
    }

    // 3. Re-derive payment_status from new correct total
    const newPaidSum = round(pays.length === 1 && Math.abs(Number(pays[0].amount) - round(Number(job.total_amount))) < 0.02
      ? correct.total
      : paidSum);
    const newStatus = newPaidSum >= correct.total - 0.01 && newPaidSum > 0 ? 'Paid'
                    : newPaidSum > 0 ? 'Partial' : '';
    await sb.from('jobs').update({ payment_status: newStatus }).eq('id', job.id);
    console.log(`     payment_status → ${newStatus || '(none)'}`);
  }

  console.log('\nDone. Hard-refresh the app to see updated values.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
