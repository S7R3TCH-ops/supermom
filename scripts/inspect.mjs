// Read-only inspection of the Supabase project. Lists row counts and a small
// sample from each table so we know what's there before we write anything.
//
// Run: node scripts/inspect.mjs

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const TABLES = [
  'businesses', 'users', 'services', 'clients', 'jobs',
  'job_templates', 'invoices', 'invoice_jobs', 'payments',
  'expense_log', 'audit_log', 'communication_log',
  'notification_log', 'template_schedule', 'config',
];

console.log(`Inspecting ${url}\n`);

for (const t of TABLES) {
  const { count, error: countErr } = await sb
    .from(t).select('*', { count: 'exact', head: true });
  if (countErr) {
    console.log(`  ${t.padEnd(22)} ERROR  ${countErr.message}`);
    continue;
  }
  const { data: sample } = await sb.from(t).select('*').limit(2);
  console.log(`  ${t.padEnd(22)} ${String(count).padStart(4)} rows`);
  if (sample?.length) {
    for (const row of sample) {
      const keys = Object.keys(row).slice(0, 6).join(', ');
      console.log(`      sample keys: ${keys}${Object.keys(row).length > 6 ? ', …' : ''}`);
      break;
    }
  }
}

const { data: usersList, error: usersErr } = await sb.auth.admin.listUsers();
if (usersErr) {
  console.log(`\nauth.users           ERROR  ${usersErr.message}`);
} else {
  console.log(`\nauth.users             ${String(usersList.users.length).padStart(4)} users`);
  for (const u of usersList.users) {
    console.log(`      ${u.email}  (${u.id})`);
  }
}
