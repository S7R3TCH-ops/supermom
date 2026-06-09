import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const JOEL_EMAIL = 'jlundie@gmail.com';

async function reset() {
  console.log('🚀 Starting platform reset...');

  // 1. Get Joel's Auth User
  const { data: { users } } = await sb.auth.admin.listUsers();
  const joel = users.find(u => u.email === JOEL_EMAIL);

  if (!joel) {
    console.error('❌ Could not find Joel\'s admin user. Run provision.mjs first.');
    return;
  }

  // 2. Clear all business-related tables
  const tables = [
    'audit_log',
    'communication_log',
    'notification_log',
    'template_schedule',
    'invoice_jobs',
    'invoices',
    'payments',
    'expense_log',
    'jobs',         // must come before job_templates (jobs.template_id → job_templates)
    'job_templates', // must come before clients (job_templates.client_id → clients)
    'clients',      // must come before businesses (clients.business_id → businesses)
    'services',
    'worker_skills', // must come before workers + skill_types
    'workers',       // must come before businesses
    'skill_types',   // must come before businesses
    'config'
  ];

  for (const table of tables) {
    console.log(`  Cleaning ${table}...`);
    const { error } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (error) console.warn(`  ⚠️ Warning cleaning ${table}:`, error.message);
  }

  // 3. Clear Users except Joel
  console.log('  Cleaning users...');
  const { error: userErr } = await sb.from('users').delete().neq('id', joel.id);
  if (userErr) console.warn('  ⚠️ Warning cleaning users:', userErr.message);

  // 4. Clear Businesses
  console.log('  Cleaning businesses...');
  const { error: bizErr } = await sb.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (bizErr) console.warn('  ⚠️ Warning cleaning businesses:', bizErr.message);

  // 5. Ensure Joel is a global admin with NO business_id (or a placeholder)
  console.log('  Restoring Joel as global admin...');
  const { error: updateErr } = await sb.from('users')
    .update({ business_id: null, role: 'admin' })
    .eq('id', joel.id);
  
  if (updateErr) {
    // If business_id is required, we might need a "System" business
    console.log('  (business_id might be required, creating System placeholder)');
    const { data: sysBiz } = await sb.from('businesses').insert({ name: 'SM Platform Admin' }).select().single();
    await sb.from('users').update({ business_id: sysBiz.id, role: 'admin' }).eq('id', joel.id);
  }

  console.log('✅ Platform reset. All client data removed. Joel preserved as Admin.');
}

reset();
