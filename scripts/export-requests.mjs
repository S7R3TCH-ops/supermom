// Pulls unexported client_requests rows into second-brain's 00-inbox as
// markdown captures. Run by a second-brain SessionStart hook (and optionally
// a Windows Task Scheduler entry) — see the design doc for the full mechanism:
// second-brain/00-inbox/2026-09-17-supermom-request-pipeline-design.md
//
// Run: node scripts/export-requests.mjs --dest <path>
//
// Idempotent: the id is embedded in the filename, so a re-run overwrites the
// same file (content is deterministic) instead of duplicating. If the DB
// stamp (exported_at) fails after a successful write, the next run just
// rewrites the same file — no data loss, no dupes.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function parseDest() {
  const idx = process.argv.indexOf('--dest');
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error('Usage: node scripts/export-requests.mjs --dest <path>');
    process.exit(1);
  }
  return path.resolve(process.argv[idx + 1]);
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'untitled';
}

function torontoDateStr(d) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
}

function torontoISO(d) {
  // en-CA sv-SE-style parts are annoying to assemble; simplest reliable path
  // for a display timestamp is toLocaleString with explicit parts, not a
  // real ISO-with-offset string — this is a capture file, not machine-read.
  return new Date(d).toLocaleString('sv-SE', { timeZone: 'America/Toronto' }).replace(' ', 'T');
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const dest = parseDest();
  // supermom's own repo is public (see CLAUDE.md/decisions.md 2026-09-15) —
  // exported files contain Sandra's words and client names and must never
  // land inside it.
  if (dest.startsWith(REPO_ROOT)) {
    console.error(`Refusing to export into the supermom repo itself (public repo): ${dest}`);
    process.exit(1);
  }
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: rows, error } = await sb
    .from('client_requests')
    .select('id, business_id, submitted_by, kind, title, body, context, status, created_at, notified_at, exported_at, businesses(name), users(email, first_name)')
    .is('exported_at', null)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Query failed:', error.message);
    // Not process.exit(1) here — the supabase client already has open handles
    // by this point and forcing exit crashes with a libuv assertion on
    // Windows/Node 24. exitCode lets the event loop drain and exit naturally.
    process.exitCode = 1;
    return;
  }

  let exported = 0;
  for (const row of rows ?? []) {
    const dateStr = torontoDateStr(row.created_at);
    const filename = `${dateStr}-${row.kind}-${row.id.slice(0, 8)}-${slugify(row.title)}.md`;
    const filePath = path.join(dest, filename);
    const exportPath = `00-inbox/supermom-requests/${filename}`;

    let recentErrors = [];
    if (row.kind === 'bug') {
      const since = new Date(new Date(row.created_at).getTime() - 24 * 3600_000).toISOString();
      const { data: errs } = await sb
        .from('error_logs')
        .select('created_at, source, severity, message')
        .eq('business_id', row.business_id)
        .gte('created_at', since)
        .lte('created_at', row.created_at)
        .order('created_at', { ascending: false })
        .limit(10);
      recentErrors = errs ?? [];
    }

    const context = row.context || {};
    const md = `---
type: supermom-request
id: ${row.id}
kind: ${row.kind}
status: ${row.status}
business: ${row.businesses?.name || row.business_id}
submitted_by: ${row.users?.email || 'unknown'}
created: ${torontoISO(row.created_at)}
app_commit: ${context.commit || 'unknown'}
route: ${context.route || 'unknown'}
device: ${context.user_agent || 'unknown'}; ${context.theme || ''} mode; ${context.standalone ? 'standalone' : 'browser'} PWA; ${context.viewport ? `${context.viewport.w}x${context.viewport.h}` : ''}
exported: ${torontoISO(Date.now())}
---

# ${row.kind.toUpperCase()} — ${row.title}

${row.body}

## Auto-captured context
- Screen: \`${context.route || 'unknown'}\`
- Build: \`${context.commit || 'unknown'}\` · theme: ${context.theme || 'unknown'} · standalone: ${context.standalone ? 'yes' : 'no'} · viewport ${context.viewport ? `${context.viewport.w}×${context.viewport.h}` : 'unknown'} · --app-height ${context.app_height || 'unknown'}
- User agent: ${context.user_agent || 'unknown'}
${row.kind === 'bug' ? `
## Recent errors for this business (24h before submission)
${recentErrors.length ? recentErrors.map(e => `- ${torontoISO(e.created_at)} · ${e.source} · ${e.severity} · "${e.message}"`).join('\n') : '- (none)'}
` : ''}
## Routing
Mark triaged/planned/done in the app (Admin › Requests) — this file is a capture, not the status record.
Source: \`client_requests\` row \`${row.id}\` in Supabase project.
`;

    writeFileSync(filePath, md, 'utf8');

    const { error: stampErr } = await sb
      .from('client_requests')
      .update({ exported_at: new Date().toISOString(), export_path: exportPath })
      .eq('id', row.id);
    if (stampErr) {
      console.error(`Wrote ${filename} but failed to stamp exported_at (will retry next run): ${stampErr.message}`);
      continue;
    }
    exported++;
  }

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: pendingNotify } = await sb
    .from('client_requests')
    .select('id', { count: 'exact', head: true })
    .is('notified_at', null)
    .lt('created_at', hourAgo);

  console.log(`exported ${exported}, skipped 0, pending-notify ${pendingNotify ?? 0}`);
}

main().catch(e => {
  console.error('export-requests.mjs failed:', e.message);
  process.exitCode = 1;
});
