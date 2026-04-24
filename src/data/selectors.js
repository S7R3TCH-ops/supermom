// Translates raw Supabase rows into the denormalized display shape the
// prototype's components were built around (name, init, color, last, next,
// owed, amt, tags, note, etc.). Keeps DB schema clean while letting the UI
// keep using fields like `c.init` and `c.color`.

const PALETTE = [
  '#E91E6A', '#8B5CF6', '#06B6D4', '#F59E0B', '#22C55E', '#EC4899',
  '#3B82F6', '#EF4444', '#14B8A6', '#A855F7',
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < (s ?? '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function clientDisplayName(row) {
  const a = (row.first_name ?? '').trim();
  const b = (row.last_name ?? '').trim();
  return [a, b].filter(Boolean).join(' ') || 'Unnamed';
}

function clientInit(row) {
  const name = clientDisplayName(row);
  return name.charAt(0).toUpperCase();
}

function clientColor(row) {
  return PALETTE[hashStr(row.id ?? clientDisplayName(row)) % PALETTE.length];
}

// Combine a client row + their job rows into the display object the UI consumes.
// `jobs` should be all jobs for this client (already decorated by jobsRepo).
export function toDisplayClient(row, jobs = []) {
  const ai = row.ai_context || {};
  const name = clientDisplayName(row);

  const sorted = [...jobs].sort((a, b) =>
    new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0)
  );
  const past = sorted.filter(j => j.job_status === 'Completed');
  const future = sorted.filter(j => j.job_status === 'Scheduled');

  const lastJob = past[0];
  const nextJob = future[future.length - 1];
  const unpaidJobs = sorted.filter(j =>
    j.job_status !== 'Cancelled' &&
    (j.payment_status === '' || j.payment_status === 'Partial')
  );
  const owedTotal = unpaidJobs.reduce((sum, j) => sum + Number(j.total_amount || 0), 0);
  const lastService = lastJob?.service_name || nextJob?.service_name || '—';

  const recurrence = ai.recurrence ?? null;
  const tags = [...(row.tags || [])];
  if (recurrence && !tags.find(t => t.toLowerCase() === recurrence)) {
    tags.unshift(recurrence.charAt(0).toUpperCase() + recurrence.slice(1));
  }
  if (ai.vip && !tags.find(t => t.toLowerCase().includes('vip'))) tags.push('VIP ★');
  if (row.status === 'lead' && !tags.includes('Lead')) tags.push('Lead');

  return {
    id: row.id,
    raw: row,
    name,
    init: clientInit(row),
    color: clientColor(row),
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: [row.street, row.city, row.province].filter(Boolean).join(', '),
    vip: !!ai.vip,
    recurrence,
    service: lastService,
    last: lastJob ? fmtShortDate(lastJob.scheduled_at) : '—',
    next: nextJob ? fmtShortDate(nextJob.scheduled_at) : '—',
    amt: owedTotal > 0 ? `$${owedTotal.toFixed(0)}` : '',
    owed: owedTotal > 0,
    tags,
    note: row.notes ?? '',
    aiContext: {
      prefs: ai.prefs ?? '',
      access: ai.access ?? row.access_info ?? '',
      comms: ai.comms ?? '',
      personal: ai.personal ?? '',
    },
    stats: {
      jobsTotal: sorted.length,
      revenueYtd: past.reduce((sum, j) => sum + Number(j.total_amount || 0), 0),
      lastVisit: lastJob ? fmtShortDate(lastJob.scheduled_at) : '—',
    },
    upcoming: future.map(j => ({
      id: j.id,
      date: fmtShortDate(j.scheduled_at),
      service: j.service_name,
      time: fmtTime(j.scheduled_at),
      amt: `$${Number(j.total_amount || 0).toFixed(0)}`,
    })),
    history: past.map(j => ({
      id: j.id,
      date: fmtShortDate(j.scheduled_at),
      service: j.service_name,
      duration: j.actual_duration ? fmtDur(Number(j.actual_duration) * 60)
              : j.estimated_hours ? fmtDur(Number(j.estimated_hours) * 60)
              : '—',
      amt: `$${Number(j.total_amount || 0).toFixed(0)}`,
      status: j.payment_status === 'Paid' ? 'paid' : 'unpaid',
    })),
  };
}

// Decorate the jobs themselves with the display shape pages expect.
export function toDisplayJob(jobRow, clientLookup = {}) {
  const c = clientLookup[jobRow.client_id];
  return {
    id: jobRow.id,
    raw: jobRow,
    client_id: jobRow.client_id,
    client_name: c ? c.name : 'Unknown',
    client_init: c ? c.init : '?',
    client_color: c ? c.color : '#888',
    service_name: jobRow.service_name,
    scheduled_at: jobRow.scheduled_at,
    duration_est: jobRow.duration_est,
    total: Number(jobRow.total_amount || 0),
    status: jobRow.job_status,
    payment_status: jobRow.payment_status,
    notes: jobRow.job_notes ?? '',
    recurrence_rule: jobRow.ai_context?.recurrence_rule ?? null,
    gcal_event_id: jobRow.calendar_event_id,
    is_deleted: !!jobRow.deleted_at,
  };
}

// ---------- formatting ----------
function fmtShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' });
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto' });
}
function fmtDur(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}
