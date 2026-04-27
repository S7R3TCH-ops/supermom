import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function die(label, msg) {
  console.error(`[${label}] ${msg}`);
  process.exit(1);
}

// ─── Pass 1: Services ────────────────────────────────────────────────────────

async function dedupServices() {
  const { data: services, error } = await sb
    .from('services')
    .select('id, business_id, name, created_at')
    .order('created_at', { ascending: true });

  if (error) die('services-fetch', error.message);

  // Group by (business_id, name lowercased)
  const groups = {};
  for (const svc of services) {
    const key = `${svc.business_id}::${svc.name.toLowerCase()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(svc);
  }

  let dupGroups = 0;
  let removedCount = 0;

  for (const [, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;
    dupGroups++;

    const canonical = group[0]; // earliest created_at
    const duplicates = group.slice(1).map(s => s.id);

    console.log(`  [services] "${canonical.name}" — keeping ${canonical.id}, removing ${duplicates.length} duplicate(s)`);

    // Re-point jobs to canonical service
    const { error: jobUpdateErr } = await sb
      .from('jobs')
      .update({ service_id: canonical.id })
      .in('service_id', duplicates);
    if (jobUpdateErr) die('services-job-update', jobUpdateErr.message);

    // Re-point job_templates to canonical service
    const { error: tplUpdateErr } = await sb
      .from('job_templates')
      .update({ service_id: canonical.id })
      .in('service_id', duplicates);
    if (tplUpdateErr) die('services-template-update', tplUpdateErr.message);

    // Hard-delete duplicate services (no soft-delete column on services)
    const { error: deleteErr } = await sb
      .from('services')
      .delete()
      .in('id', duplicates);
    if (deleteErr) die('services-delete', deleteErr.message);

    removedCount += duplicates.length;
  }

  if (dupGroups === 0) {
    console.log('  [services] No duplicates found.');
  } else {
    console.log(`  [services] Resolved ${dupGroups} group(s), removed ${removedCount} duplicate row(s).`);
  }
}

// ─── Pass 2: Clients ─────────────────────────────────────────────────────────

async function dedupClients() {
  const { data: clients, error } = await sb
    .from('clients')
    .select('id, business_id, email, first_name, last_name, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) die('clients-fetch', error.message);

  const groups = {};
  for (const c of clients) {
    let key;
    if (c.email) {
      key = `${c.business_id}::email::${c.email.toLowerCase()}`;
    } else {
      key = `${c.business_id}::name::${c.first_name.toLowerCase()}::${(c.last_name || '').toLowerCase()}`;
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  let dupGroups = 0;
  let removedCount = 0;

  for (const [, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;
    dupGroups++;

    const canonical = group[0];
    const duplicates = group.slice(1).map(c => c.id);
    const name = `${canonical.first_name} ${canonical.last_name || ''}`.trim();

    console.log(`  [clients] "${name}" — keeping ${canonical.id}, removing ${duplicates.length} duplicate(s)`);

    // Re-point all FK references to canonical client
    for (const [table, col] of [
      ['jobs', 'client_id'],
      ['invoices', 'client_id'],
      ['payments', 'client_id'],
      ['communication_log', 'client_id'],
      ['notification_log', 'client_id'],
      ['job_templates', 'client_id'],
    ]) {
      const { error: updateErr } = await sb
        .from(table)
        .update({ [col]: canonical.id })
        .in(col, duplicates);
      if (updateErr) die(`clients-${table}-update`, updateErr.message);
    }

    // Soft-delete duplicates per CLAUDE.md rule
    const { error: softDeleteErr } = await sb
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', duplicates);
    if (softDeleteErr) die('clients-soft-delete', softDeleteErr.message);

    removedCount += duplicates.length;
  }

  if (dupGroups === 0) {
    console.log('  [clients] No duplicates found.');
  } else {
    console.log(`  [clients] Resolved ${dupGroups} group(s), removed ${removedCount} duplicate row(s).`);
  }
}

// ─── Pass 3: Jobs ─────────────────────────────────────────────────────────────

async function dedupJobs() {
  const { data: jobs, error } = await sb
    .from('jobs')
    .select('id, business_id, client_id, scheduled_date, scheduled_time, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) die('jobs-fetch', error.message);

  const groups = {};
  for (const j of jobs) {
    // Jobs without a scheduled_date are ASAP/floating — skip dedup (no natural key)
    if (!j.scheduled_date) continue;
    const time = j.scheduled_time ?? 'null';
    const key = `${j.business_id}::${j.client_id}::${j.scheduled_date}::${time}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(j);
  }

  let dupGroups = 0;
  let removedCount = 0;

  for (const [, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;
    dupGroups++;

    const canonical = group[0];
    const duplicates = group.slice(1).map(j => j.id);

    console.log(`  [jobs] ${canonical.scheduled_date} ${canonical.scheduled_time ?? ''} — keeping ${canonical.id}, removing ${duplicates.length} duplicate(s)`);

    // Soft-delete duplicates per CLAUDE.md rule
    const { error: softDeleteErr } = await sb
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', duplicates);
    if (softDeleteErr) die('jobs-soft-delete', softDeleteErr.message);

    removedCount += duplicates.length;
  }

  if (dupGroups === 0) {
    console.log('  [jobs] No duplicates found.');
  } else {
    console.log(`  [jobs] Resolved ${dupGroups} group(s), removed ${removedCount} duplicate row(s).`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('🔍 Scanning for duplicates...\n');

await dedupServices();
console.log('');
await dedupClients();
console.log('');
await dedupJobs();

console.log('\n✅ Done.');
