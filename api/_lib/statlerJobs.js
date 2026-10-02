// Job detail read + guarded edit for the Statler voice tools (Sandra, by phone).
// Pure functions over a supabase client so they are unit-testable
// (src/lib/statlerJobs.test.js). The router in api/ai/[action].js adds the
// audit-log row and the Google Calendar sync after a successful edit.
//
// HARD RULES (Joel, 2026-10-01, from Sandra's call): by phone a job can be read
// and moved/edited, but NEVER deleted, cancelled or have its status or money
// changed. Enforced here by an explicit field allowlist, a Scheduled-only gate,
// and the absence of any delete/cancel action. Tests pin all three.

import { computeMoney, buildHoursPatch } from './jobMoney.js';
import { formatPhone } from './phone.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The only args supermom_edit_schedule will ever act on. Anything else the
// model (or a caller) sends is ignored, never written.
export const EDITABLE_ARGS = ['job_id', 'date', 'time', 'duration_hours', 'service', 'description'];

export function normalizeTime(time) {
  if (!time || typeof time !== 'string') return time;
  const match = time.toLowerCase().trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/);
  if (!match) return time;
  let hour = parseInt(match[1], 10);
  if (hour < 1 || hour > 12) return time;
  const min = match[2] || '00';
  const ampm = match[3].replace(/\./g, '');
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, '0')}:${min}`;
}

const trim = (s) => (typeof s === 'string' ? s.trim() : '');
const addressOf = (c) =>
  [c?.street, c?.city, c?.province, c?.postal_code].map(trim).filter(Boolean).join(', ') || null;

export async function getJobDetail(supabase, businessId, jobId) {
  if (!jobId || !UUID_RE.test(String(jobId))) {
    return { status: 400, body: { error: 'Missing or invalid job_id. Use supermom_read_schedule first to find the job_id.' } };
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .select(
      'id, client_id, template_id, service_name, scheduled_date, scheduled_time, job_status, payment_status, ' +
        'pricing_type, flat_rate, estimated_hours, actual_duration, additional_costs_json, additional_cost, ' +
        'additional_cost_notes, tax_enabled, total_amount, job_notes, completion_notes, ' +
        'clients!jobs_client_id_fkey(first_name, last_name, phone, phone2, email, street, city, province, postal_code, access_info, notes)',
    )
    .eq('business_id', businessId)
    .eq('id', jobId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { status: 500, body: { error: 'Failed to read job' } };
  if (!job) return { status: 404, body: { error: `Job not found with ID ${jobId}` } };

  const { data: biz } = await supabase
    .from('businesses')
    .select('hst_rate, tax_enabled')
    .eq('id', businessId)
    .maybeSingle();

  // Worker names only (never pay). Two queries, no PostgREST embed on the new FK.
  let workers = [];
  const { data: assigns } = await supabase
    .from('job_workers')
    .select('worker_id')
    .eq('business_id', businessId)
    .eq('job_id', job.id);
  if (assigns?.length) {
    const { data: ws } = await supabase
      .from('workers')
      .select('id, name')
      .eq('business_id', businessId)
      .in('id', assigns.map((a) => a.worker_id));
    workers = (ws || []).map((w) => w.name).filter(Boolean);
  }

  const completed = job.job_status === 'Completed';
  const hours = completed ? Number(job.actual_duration ?? job.estimated_hours) || 0 : Number(job.estimated_hours) || 0;
  const money = computeMoney(job, biz, hours);
  const hourly = job.pricing_type === 'Hourly';
  const c = job.clients || {};

  return {
    status: 200,
    body: {
      job: {
        id: job.id,
        date: job.scheduled_date,
        time: job.scheduled_time,
        service: job.service_name,
        status: job.job_status,
        duration_hours: hours,
        pricing: hourly ? `Hourly, $${(Number(job.flat_rate) || 0).toFixed(2)}/hr` : `Flat, $${(Number(job.flat_rate) || 0).toFixed(2)}`,
        extras_total: money.additional_total,
        tax_applies: money.tax_enabled,
        // Completed jobs carry a finalized total; Scheduled ones are an estimate.
        total: completed ? Number(job.total_amount) || money.total_amount : money.total_amount,
        total_is_estimate: !completed,
        payment_status: job.payment_status || 'Unpaid',
        notes: job.job_notes || null,
        completion_notes: job.completion_notes || null,
        workers,
        part_of_recurring_series: !!job.template_id,
      },
      client: {
        name: [trim(c.first_name), trim(c.last_name)].filter(Boolean).join(' '),
        phone: formatPhone(c.phone) || null,
        phone2: formatPhone(c.phone2) || null,
        email: c.email || null,
        address: addressOf(c),
        access_info: c.access_info || null,
        notes: c.notes || null,
      },
    },
  };
}

/**
 * Validates and applies an edit. Returns { status, body, jobId?, updates?, old? };
 * on success `updates` is exactly what was written, for the audit log.
 */
export async function editJob(supabase, businessId, rawArgs) {
  const args = {};
  for (const k of EDITABLE_ARGS) if (rawArgs && rawArgs[k] !== undefined) args[k] = rawArgs[k];

  const { job_id } = args;
  if (!job_id || !UUID_RE.test(String(job_id))) {
    return { status: 400, body: { error: 'Missing or invalid job_id. Please use supermom_read_schedule first to find the job_id.' } };
  }

  const date = args.date;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { status: 400, body: { error: 'date must be YYYY-MM-DD' } };
  }

  const time = normalizeTime(args.time);
  if (time && !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    return { status: 400, body: { error: 'time must be HH:MM or HH:MM:SS' } };
  }

  let duration = null;
  if (args.duration_hours !== undefined && args.duration_hours !== null && args.duration_hours !== '') {
    duration = Number(args.duration_hours);
    if (!isFinite(duration) || duration < 0.25 || duration > 12) {
      return { status: 400, body: { error: 'duration_hours must be between 0.25 and 12' } };
    }
  }

  const serviceQuery = trim(args.service).replace(/[^\p{L}\p{N} \-'&]/gu, '');
  const description = trim(args.description);

  if (!date && !time && duration === null && !serviceQuery && !description) {
    return { status: 400, body: { error: 'No new date, time, duration, service or notes provided.' } };
  }

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select(
      'id, client_id, template_id, scheduled_date, scheduled_time, job_status, service_id, service_name, job_notes, ' +
        'notes_resolved_at, ai_context, pricing_type, flat_rate, estimated_hours, additional_costs_json, additional_cost, additional_cost_notes, tax_enabled',
    )
    .eq('business_id', businessId)
    .eq('id', job_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (jobErr || !job) {
    return { status: 404, body: { error: `Job not found with ID ${job_id}` } };
  }

  // Finished or cancelled jobs carry final money and invoices; changing them by
  // phone is out. Returned as a normal 200 result so Statler can say it out loud.
  if (job.job_status !== 'Scheduled') {
    return {
      status: 200,
      body: { result: `This job is ${job.job_status}, so it can't be changed by phone. Only upcoming jobs can be moved or edited here. Joel can help with anything else.` },
    };
  }

  if (date && date !== job.scheduled_date) {
    const { data: existing, error: existingErr } = await supabase
      .from('jobs')
      .select('id')
      .eq('business_id', businessId)
      .eq('client_id', job.client_id)
      .eq('scheduled_date', date)
      .is('deleted_at', null);
    if (existingErr) return { status: 500, body: { error: 'Failed to check conflicts' } };
    if (existing && existing.length > 0 && existing[0].id !== job.id) {
      return { status: 200, body: { result: 'Conflict: This client already has a job scheduled on the new date.' } };
    }
  }

  const updates = {};
  const notes = [];

  if (date) updates.scheduled_date = date;
  if (time) updates.scheduled_time = time;

  // Moved in time -> drive estimates are for the old slot (same rule as JobDetailSheet).
  const moved = (date && date !== job.scheduled_date) ||
    (time && time.slice(0, 5) !== (job.scheduled_time || '').slice(0, 5));
  if (moved && job.ai_context && ('drive_to' in job.ai_context || 'drive_to_live' in job.ai_context)) {
    const { drive_to: _dt, drive_to_live: _dtl, ...restCtx } = job.ai_context;
    updates.ai_context = restCtx;
  }

  if (serviceQuery) {
    const { data: services, error: svcErr } = await supabase
      .from('services')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('active', true)
      .ilike('name', `%${serviceQuery}%`);
    if (svcErr) return { status: 500, body: { error: 'Failed to look up service' } };
    const exact = (services || []).filter((s) => s.name.toLowerCase() === serviceQuery.toLowerCase());
    const matches = exact.length ? exact : services || [];
    if (matches.length !== 1) {
      return {
        status: 200,
        body: {
          result: matches.length === 0
            ? `No service matches "${serviceQuery}". Nothing was changed.`
            : `${matches.length} services match "${serviceQuery}". Ask which one. Nothing was changed.`,
          candidates: matches.slice(0, 5).map((s) => s.name),
        },
      };
    }
    // Name + id move together; rate and totals are deliberately left alone.
    updates.service_id = matches[0].id;
    updates.service_name = matches[0].name;
    notes.push(`service is now ${matches[0].name}; the rate and price did not change`);
  }

  if (duration !== null) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('hst_rate, tax_enabled')
      .eq('id', businessId)
      .maybeSingle();
    Object.assign(updates, buildHoursPatch(job, biz, duration));
    notes.push(
      job.pricing_type === 'Hourly'
        ? `duration is now ${duration} hours and the estimated total was recalculated`
        : `duration is now ${duration} hours; the flat price did not change`,
    );
  }

  if (description) {
    const old = job.job_notes || '';
    updates.job_notes = old ? `${old}\n\n[AI Edit]: ${description}` : `[AI Edit]: ${description}`;
    // An edited to-do is a new to-do (design doc 3.1): reopen if it was marked done.
    if (job.notes_resolved_at) updates.notes_resolved_at = null;
  }

  const { error: updateErr } = await supabase
    .from('jobs')
    .update(updates)
    .eq('business_id', businessId)
    .eq('id', job.id);

  if (updateErr) return { status: 500, body: { error: 'Failed to update job' } };

  if (date || time) notes.unshift('schedule updated');
  if (description) notes.push('note added');
  if (job.template_id) notes.push('only this one visit changed, not the rest of the recurring series');

  return {
    status: 200,
    jobId: job.id,
    updates,
    old: { scheduled_date: job.scheduled_date, scheduled_time: job.scheduled_time, service_name: job.service_name, estimated_hours: job.estimated_hours },
    body: { result: `Done: ${notes.join('; ')}.` },
  };
}
