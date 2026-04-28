/**
 * Realistic & Spread Out Seeding Script for Supermom v2.0
 * Date Context: Monday, April 27, 2026
 * 
 * Strategy:
 * 1. Clean up duplicate clients first.
 * 2. Spread jobs: 1-2 per day maximum.
 * 3. Clear existing jobs/payments/expenses.
 * 4. Varied states (Paid, Unpaid, Completed, Scheduled).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const BUSINESS_NAME = 'Supermom for Hire';
const TODAY_STR = '2026-04-27';
const TODAY = new Date(`${TODAY_STR}T12:00:00`);

function log(msg) { console.log(`[SEED] ${msg}`); }
function die(step, err) { console.error(`[${step}] FAILED:`, err.message ?? err); process.exit(1); }

async function run() {
  log('🚀 Starting realistic spread seed...');

  // 1. Get Business
  const { data: biz, error: bizErr } = await sb.from('businesses').select('id').eq('name', BUSINESS_NAME).maybeSingle();
  if (bizErr) die('biz', bizErr);
  if (!biz) die('biz', 'Business not found.');

  // 2. Deduplicate Clients (Keep the oldest one for each email)
  log('  Deduplicating clients...');
  const { data: allClients } = await sb.from('clients').select('id, email, created_at').eq('business_id', biz.id).order('created_at', { ascending: true });
  const seenEmails = new Set();
  const duplicateIds = [];
  const validClients = [];

  for (const c of allClients) {
    if (seenEmails.has(c.email)) {
      duplicateIds.push(c.id);
    } else {
      seenEmails.add(c.email);
      validClients.push(c);
    }
  }

  if (duplicateIds.length > 0) {
    // Delete jobs/payments for duplicates first to avoid FK errors
    await sb.from('payments').delete().in('client_id', duplicateIds);
    await sb.from('jobs').delete().in('client_id', duplicateIds);
    await sb.from('clients').delete().in('id', duplicateIds);
    log(`  Removed ${duplicateIds.length} duplicate client records.`);
  }

  // 2. Clear existing dynamic data (Jobs, Payments, Expenses)
  log('  PERFORMING HARD CLEAR of jobs, payments, invoices, and expenses...');
  
  // Clear Invoice links first
  await sb.from('invoice_jobs').delete().eq('business_id', biz.id);
  await sb.from('invoices').delete().eq('business_id', biz.id);
  
  const { error: pDelErr } = await sb.from('payments').delete().eq('business_id', biz.id);
  if (pDelErr) console.warn('Payment clear error:', pDelErr.message);

  const { error: jDelErr } = await sb.from('jobs').delete().eq('business_id', biz.id);
  if (jDelErr) console.warn('Job clear error:', jDelErr.message);

  const { error: eDelErr } = await sb.from('expense_log').delete().eq('business_id', biz.id);
  if (eDelErr) console.warn('Expense clear error:', eDelErr.message);

  // Double check - if any jobs remain, we have a scoping issue
  const { count } = await sb.from('jobs').select('*', { count: 'exact', head: true }).eq('business_id', biz.id);
  if (count > 0) {
    log(`⚠️ CRITICAL: ${count} jobs still exist after delete! Attempting fallback delete...`);
    await sb.from('jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  
  const cliMap = Object.fromEntries(validClients.map(c => [c.email, c.id]));

  const { data: services } = await sb.from('services').select('*').eq('business_id', biz.id);
  const svcMap = Object.fromEntries(services.map(s => [s.name, s]));

  const fmtDate = (days) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  /**
   * REALISTIC SPREAD (1-2 per day)
   */
  const jobDefinitions = [
    // --- LAST WEEK ---
    { email: 'sarah.c@example.com', svc: 'Regular', days: -7, time: '09:00', status: 'Completed', pay: 'Paid', duration: 2.5, notes: 'Standard weekly.' },
    { email: 'peter.p@example.com', svc: 'Quick Tidy', days: -6, time: '14:00', status: 'Completed', pay: 'Paid', duration: 1.0, notes: 'Living room sweep.' },
    { email: 'bruce.w@example.com', svc: 'Deep Clean', days: -4, time: '08:30', status: 'Completed', pay: 'Paid', duration: 4.0, notes: 'Library dusting.' },
    
    // --- UNPAID DEBTS (Past but not paid) ---
    { email: 'ellen.r@example.com', svc: 'Deep Clean', days: -3, time: '10:00', status: 'Completed', pay: '', duration: 4.5, notes: 'Intense basement sort.' },
    { email: 'tony.s@example.com', svc: 'Regular', days: -1, time: '11:00', status: 'Completed', pay: '', duration: 2.0, notes: 'Office reorganization.' },

    // --- TODAY (Monday, April 27) ---
    { email: 'sarah.c@example.com', svc: 'Regular', days: 0, time: '08:30', status: 'Completed', pay: '', duration: 2.5, notes: 'Finished morning session.' },
    { email: 'peter.p@example.com', svc: 'Quick Tidy', days: 0, time: '15:00', status: 'Scheduled', pay: '', notes: 'Afternoon tidy.' },

    // --- REST OF WEEK (1 per day) ---
    { email: 'clark.k@example.com', svc: 'Custom', days: 1, time: '10:00', status: 'Scheduled', pay: '', notes: 'Hourly assistance.' },
    { email: 'diana.p@example.com', svc: 'Regular', days: 2, time: '09:00', status: 'Scheduled', pay: '', notes: 'Monthly museum check.' },
    { email: 'logan.h@example.com', svc: 'Deep Clean', days: 3, time: '08:00', status: 'Scheduled', pay: '', notes: 'Full cabin clean.' },
    { email: 'nat.r@example.com', svc: 'Quick Tidy', days: 4, time: '13:00', status: 'Scheduled', pay: '', notes: 'Apartment refresh.' }
  ];

  const jobRows = jobDefinitions.map(j => {
    const svc = svcMap[j.svc] || svcMap['Regular'];
    const amount = svc.pricing_type === 'Flat' ? svc.default_price : (svc.default_price * (j.duration || 2));
    const clientId = cliMap[j.email];
    
    if (!clientId) {
      console.warn(`⚠️ Skipping job: Client with email ${j.email} not found.`);
      return null;
    }

    return {
      business_id: biz.id,
      client_id: clientId,
      service_id: svc.id,
      service_name: j.svc,
      scheduled_date: fmtDate(j.days),
      scheduled_time: j.time,
      job_status: j.status,
      payment_status: j.pay,
      job_notes: j.notes,
      total_amount: amount,
      actual_duration: j.duration || null,
      estimated_hours: svc.pricing_type === 'Hourly' ? 2 : (j.svc === 'Deep Clean' ? 4 : 2),
      pricing_type: svc.pricing_type,
      hourly_rate: svc.pricing_type === 'Hourly' ? svc.default_price : null,
      flat_rate: svc.pricing_type === 'Flat' ? svc.default_price : null
    };
  }).filter(Boolean);

  const { data: insertedJobs, error: insertErr } = await sb.from('jobs').insert(jobRows).select();
  if (insertErr) die('insert-jobs', insertErr);
  log(`✅ Inserted ${insertedJobs.length} jobs.`);

  // Record payments for Paid jobs
  const paidJobs = insertedJobs.filter(j => j.payment_status === 'Paid');
  if (paidJobs.length > 0) {
    const paymentRows = paidJobs.map(j => ({
      business_id: biz.id,
      job_id: j.id,
      client_id: j.client_id,
      amount: j.total_amount,
      payment_method: 'Cash',
      payment_date: j.scheduled_date
    }));
    await sb.from('payments').insert(paymentRows);
    log(`✅ Recorded ${paymentRows.length} payments.`);
  }

  log('✅ Added sample expenses.');
  await sb.from('expense_log').insert([
    { business_id: biz.id, category: 'Supplies', amount: 32.40, notes: 'Cleaning sprays', expense_date: fmtDate(-2) }
  ]);

  console.log('\n✨ Realistic spread seed complete! Day: Monday, April 27.');
}

run();
