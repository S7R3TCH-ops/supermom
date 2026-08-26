// Translates raw Supabase rows into the denormalized display shape the
// prototype's components were built around (name, init, color, last, next,
// owed, amt, tags, note, etc.). Keeps DB schema clean while letting the UI
// keep using fields like `c.init` and `c.color`.

import { computeJobTotal, JobInput } from '../lib/financialMath';

const PALETTE = [
  '#FC4693', '#8B5CF6', '#06B6D4', '#F59E0B', '#22C55E', '#EC4899',
  '#3B82F6', '#EF4444', '#14B8A6', '#A855F7',
];

// ---------- types ----------

export interface ClientRow {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  access_info?: string | null;
  tags?: string[] | null;
  status?: string | null;
  ai_context?: {
    vip?: boolean;
    recurrence?: string;
    prefs?: string;
    access?: string;
    comms?: string;
    personal?: string;
    learned?: unknown;
  } | null;
}

export interface WorkerRow {
  id?: string;
  name?: string | null;
  person_type?: string | null;
}

// One worker assigned to a job (job_workers row, already joined with the
// worker's name/person_type by jobsRepo's decorateJob).
export interface JobWorkerRow {
  id?: string;
  worker_id: string;
  name?: string | null;
  person_type?: string | null;
  pay?: number | null;
  paid?: boolean;
  paid_at?: string | null;
}

export interface ClientLookup {
  [clientId: string]: DisplayClient | null | undefined;
}

export interface WorkerLookup {
  [workerId: string]: WorkerRow | null | undefined;
}

export interface PaymentsByJobId {
  [jobId: string]: number;
}

export interface CreditsByJobId {
  [jobId: string]: number;
}

export interface UpcomingJobItem {
  id: string;
  date: string;
  service: string | undefined;
  time: string;
  amt: string;
  job_status: string;
  payment_status: string;
}

export interface HistoryJobItem {
  id: string;
  date: string;
  service: string | undefined;
  duration: string;
  amt: string;
  status: 'paid' | 'partial' | 'unpaid';
  job_status: string;
}

export interface DisplayClient {
  id: string;
  raw: ClientRow;
  name: string;
  init: string;
  color: string;
  phone: string;
  email: string;
  address: string;
  vip: boolean;
  recurrence: string | null;
  service: string;
  last: string;
  next: string;
  amt: string;
  owed: boolean;
  tags: string[];
  note: string;
  aiContext: {
    prefs: string;
    access: string;
    comms: string;
    personal: string;
    learned: unknown;
  };
  stats: {
    jobsTotal: number;
    revenueYtd: number;
    totalBilled: number;
    avgPerJob: number;
    lastVisit: string;
  };
  upcoming: UpcomingJobItem[];
  history: HistoryJobItem[];
}

export interface DisplayJob {
  id: string;
  raw: JobInput;
  client_id: string | null;
  client_name: string;
  client_init: string;
  client_color: string;
  address: string;
  client_notes: string;
  client_ai_context: Record<string, unknown>;
  client_tags: string[];
  workers: JobWorkerRow[];
  worker_id: string | null;
  worker_name: string | null;
  worker_pay: number | null;
  worker_paid: boolean;
  assignee_type: string | null;
  service_name: string;
  scheduled_at: string | null;
  duration_est: number | null;
  total: number;
  amount_paid: number;
  status: string;
  payment_status: string;
  actual_duration: number | null;
  notes: string;
  photo_links: string;
  voice_note: string | null;
  ai_context: Record<string, unknown>;
  recurrence_rule: string | null;
  gcal_event_id: string | null;
  is_deleted: boolean;
  issued_credit: number;
}

// ---------- helpers ----------

function hashStr(s: string | null | undefined): number {
  let h = 0;
  for (let i = 0; i < (s ?? '').length; i++) h = (h * 31 + (s as string).charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function clientDisplayName(row: ClientRow): string {
  const a = (row.first_name ?? '').trim();
  const b = (row.last_name ?? '').trim();
  return [a, b].filter(Boolean).join(' ') || 'Unnamed';
}

function clientInit(row: ClientRow): string {
  const name = clientDisplayName(row);
  return name.charAt(0).toUpperCase();
}

function clientColor(row: ClientRow): string {
  return PALETTE[hashStr(row.id ?? clientDisplayName(row)) % PALETTE.length];
}

// Combine a client row + their job rows into the display object the UI consumes.
// `jobs` should be all jobs for this client (already decorated by jobsRepo).
// `paymentsByJobId` maps jobId → total amount paid (for Partial balance calculation).
export function toDisplayClient(
  row: ClientRow,
  jobs: JobInput[] = [],
  paymentsByJobId: PaymentsByJobId = {}
): DisplayClient | null {
  if (!row) return null;
  const ai = row.ai_context || {};
  const name = clientDisplayName(row);

  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const sorted = [...safeJobs].sort((a, b) => {
    const da = new Date((a as Record<string, unknown>)?.scheduled_at as string || 0).getTime();
    const db = new Date((b as Record<string, unknown>)?.scheduled_at as string || 0).getTime();
    return db - da;
  });

  const jobsAny = sorted as (JobInput & Record<string, unknown>)[];
  const past = jobsAny.filter(j => j?.job_status === 'Completed');
  const future = jobsAny.filter(j => j?.job_status === 'Scheduled');

  const lastJob = past[0];
  const nextJob = future[future.length - 1];
  const unpaidJobs = jobsAny.filter(j =>
    j?.job_status === 'Completed' &&
    (j?.payment_status == null || j?.payment_status === '' || j?.payment_status === 'Partial')
  );
  const owedTotal = unpaidJobs.reduce((sum, j) => {
    const total = computeJobTotal(j);
    const alreadyPaid = paymentsByJobId[j.id as string] || 0;
    return sum + Math.max(0, total - alreadyPaid);
  }, 0);
  const lastService = (lastJob?.service_name || nextJob?.service_name || '—') as string;

  const recurrence = ai.recurrence ?? null;
  const tags: string[] = Array.isArray(row.tags) ? [...row.tags] : [];
  if (recurrence && !tags.find(t => t?.toLowerCase?.() === recurrence)) {
    tags.unshift(recurrence.charAt(0).toUpperCase() + recurrence.slice(1));
  }
  if (ai.vip && !tags.find(t => t?.toLowerCase?.().includes('vip'))) tags.push('VIP ★');
  if (row.status === 'lead' && !tags.includes('Lead')) tags.push('Lead');

  return {
    id: row.id,
    raw: row,
    name,
    init: clientInit(row),
    color: clientColor(row),
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: [row.street, row.city, row.province, row.postal_code].filter(Boolean).join(', '),
    vip: !!ai.vip,
    recurrence: recurrence ?? null,
    service: lastService,
    last: lastJob ? fmtShortDate(lastJob.scheduled_at as string) : '—',
    next: nextJob ? fmtShortDate(nextJob.scheduled_at as string) : '—',
    amt: owedTotal > 0 ? `$${owedTotal.toFixed(0)}` : '',
    owed: owedTotal > 0,
    tags,
    note: row.notes ?? '',
    aiContext: {
      prefs: ai.prefs ?? '',
      access: ai.access ?? row.access_info ?? '',
      comms: ai.comms ?? '',
      personal: ai.personal ?? '',
      learned: ai.learned || null,
    },
    stats: {
      jobsTotal: sorted.length,
      revenueYtd: past.reduce((sum, j) => sum + computeJobTotal(j), 0),
      totalBilled: past.reduce((sum, j) => sum + computeJobTotal(j), 0),
      avgPerJob: past.length > 0
        ? past.reduce((sum, j) => sum + computeJobTotal(j), 0) / past.length
        : 0,
      lastVisit: lastJob ? fmtShortDate(lastJob.scheduled_at as string) : '—',
    },
    upcoming: future.map(j => {
      const startStr = fmtTime(j?.scheduled_at as string);
      const endStr = fmtEndTime(j?.scheduled_at as string, j?.estimated_hours as number);
      return {
        id: j?.id as string,
        date: fmtShortDate(j?.scheduled_at as string),
        service: j?.service_name as string,
        time: endStr ? `${startStr} – ${endStr}` : startStr,
        amt: `$${computeJobTotal(j).toFixed(0)}`,
        job_status: (j?.job_status as string) || 'Scheduled',
        payment_status: (j?.payment_status as string) || '',
      };
    }),
    history: past.map(j => ({
      id: j?.id as string,
      date: fmtShortDate(j?.scheduled_at as string),
      service: j?.service_name as string,
      duration: j?.actual_duration ? fmtDur(Number(j.actual_duration) * 60)
              : j?.estimated_hours ? fmtDur(Number(j.estimated_hours) * 60)
              : '—',
      amt: `$${computeJobTotal(j).toFixed(0)}`,
      status: j?.payment_status === 'Paid' ? 'paid' : j?.payment_status === 'Partial' ? 'partial' : 'unpaid',
      job_status: (j?.job_status as string) || 'Completed',
    })),
  };
}

// Decorate the jobs themselves with the display shape pages expect.
// jobsRepo's decorateJob has already attached `workers` (job_workers rows,
// pre-joined with each worker's name/person_type) plus the derived
// worker_id/worker_name/worker_pay/worker_paid/assignee_type convenience
// fields (from workers[0]) onto jobRow — this just passes them through.
export function toDisplayJob(
  jobRow: JobInput & Record<string, unknown>,
  clientLookup: ClientLookup = {},
  paymentsByJobId: PaymentsByJobId = {},
  creditsByJobId: CreditsByJobId = {}
): DisplayJob | null {
  if (!jobRow) return null;
  const c = clientLookup[jobRow.client_id as string] || null;
  const workers: JobWorkerRow[] = Array.isArray(jobRow.workers) ? jobRow.workers as JobWorkerRow[] : [];
  return {
    id: jobRow.id as string,
    raw: jobRow,
    client_id: (jobRow.client_id as string) ?? null,
    client_name: c ? c.name : 'Unknown',
    client_init: c ? c.init : '?',
    client_color: c ? c.color : '#888',
    address: c ? c.address : '',
    client_notes: c?.note || '',
    client_ai_context: (c?.raw?.ai_context as Record<string, unknown>) || {},
    client_tags: Array.isArray(c?.raw?.tags) ? c.raw.tags as string[] : [],
    workers,
    worker_id: (jobRow.worker_id as string) ?? null,
    worker_name: (jobRow.worker_name as string) ?? null,
    worker_pay: (jobRow.worker_pay as number) ?? null,
    worker_paid: !!jobRow.worker_paid,
    assignee_type: (jobRow.assignee_type as string) ?? null,
    service_name: (jobRow.service_name as string) || 'Service',
    scheduled_at: (jobRow.scheduled_at as string) ?? null,
    duration_est: (jobRow.duration_est as number) ?? null,
    total: computeJobTotal(jobRow),
    amount_paid: paymentsByJobId[jobRow.id as string] || 0,
    status: (jobRow.job_status as string) || 'Scheduled',
    payment_status: (jobRow.payment_status as string) || '',
    actual_duration: (jobRow.actual_duration as number) ?? null,
    notes: (jobRow.job_notes as string) ?? '',
    photo_links: (jobRow.photo_links as string) ?? '',
    voice_note: (jobRow.ai_context as Record<string, unknown>)?.voice_note as string ?? null,
    ai_context: (jobRow.ai_context as Record<string, unknown>) || {},
    recurrence_rule: ((jobRow.ai_context as Record<string, unknown>)?.recurrence_rule as string) ?? null,
    gcal_event_id: (jobRow.calendar_event_id as string) ?? null,
    is_deleted: !!(jobRow.deleted_at),
    issued_credit: creditsByJobId[jobRow.id as string] || 0,
  };
}

// ---------- formatting ----------
function fmtEndTime(iso: string | null | undefined, estimatedHours: number | null | undefined): string {
  if (!iso || !estimatedHours) return '';
  const end = new Date(new Date(iso).getTime() + estimatedHours * 3600000);
  if (Number.isNaN(end.getTime())) return '';
  return end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto' });
}
function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' });
}
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Toronto' });
}
function fmtDur(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}
