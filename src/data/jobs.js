// Mock jobs store. Matches the `jobs` table shape from CLAUDE.md.
// All scheduled_at values use America/Toronto (-04:00 DST in April 2026).

export const SERVICES = [
  { key: 'deep_clean', label: 'Deep Clean',       rate: 185, defaultDuration: 150, emoji: '🧼' },
  { key: 'regular',    label: 'Regular',          rate: 120, defaultDuration: 105, emoji: '✨' },
  { key: 'quick_tidy', label: 'Quick Tidy',       rate: 85,  defaultDuration: 60,  emoji: '🌀' },
  { key: 'organizing', label: 'Organize',         rate: 160, defaultDuration: 180, emoji: '📦' },
  { key: 'declutter',  label: 'Declutter + Org.', rate: 240, defaultDuration: 240, emoji: '🗂' },
  { key: 'move_out',   label: 'Move Out',         rate: 320, defaultDuration: 300, emoji: '📤' },
  { key: 'custom',     label: 'Custom',           rate: 0,   defaultDuration: 120, emoji: '✎' },
];

export function serviceByKey(key) {
  return SERVICES.find(s => s.key === key) || null;
}

export function serviceByLabel(label) {
  return SERVICES.find(s => s.label.toLowerCase() === (label || '').toLowerCase()) || null;
}

export const jobs = [
  {
    id: 'job-anne-0422',
    client_id: 'anne-k',
    service_type: 'deep_clean',
    scheduled_at: '2026-04-22T09:00:00-04:00',
    duration_est: 150,
    rate: 185,
    total: 185,
    status: 'scheduled',
    payment_status: 'unpaid',
    notes: 'Side-door key under mat. Big dog is friendly. Extra time on kitchen.',
    recurrence_rule: 'weekly',
    is_deleted: false,
  },
  {
    id: 'job-patel-0422',
    client_id: 'patel-family',
    service_type: 'organizing',
    scheduled_at: '2026-04-22T13:00:00-04:00',
    duration_est: 180,
    rate: 160,
    total: 160,
    status: 'scheduled',
    payment_status: 'unpaid',
    notes: 'Bring extra bins. 2nd floor office priority.',
    recurrence_rule: 'biweekly',
    is_deleted: false,
  },
  {
    id: 'job-westbrook-0422',
    client_id: 'westbrook',
    service_type: 'quick_tidy',
    scheduled_at: '2026-04-22T16:00:00-04:00',
    duration_est: 60,
    rate: 85,
    total: 85,
    status: 'scheduled',
    payment_status: 'unpaid',
    notes: 'Lockbox 4829. Kitchen + bathroom only.',
    recurrence_rule: 'monthly',
    is_deleted: false,
  },
  {
    id: 'job-anne-0419',
    client_id: 'anne-k',
    service_type: 'deep_clean',
    scheduled_at: '2026-04-19T09:00:00-04:00',
    duration_est: 150,
    rate: 185,
    total: 185,
    status: 'completed',
    payment_status: 'paid',
    notes: '',
    recurrence_rule: 'weekly',
    is_deleted: false,
  },
  {
    id: 'job-chen-0412',
    client_id: 'chen-family',
    service_type: 'deep_clean',
    scheduled_at: '2026-04-12T10:00:00-04:00',
    duration_est: 120,
    rate: 120,
    total: 120,
    status: 'completed',
    payment_status: 'unpaid',
    notes: '',
    recurrence_rule: 'biweekly',
    is_deleted: false,
  },
  {
    id: 'job-marchetti-0503',
    client_id: 'marchetti',
    service_type: 'declutter',
    scheduled_at: '2026-05-03T09:00:00-04:00',
    duration_est: 240,
    rate: 240,
    total: 240,
    status: 'scheduled',
    payment_status: 'unpaid',
    notes: 'Full basement project.',
    recurrence_rule: 'monthly',
    is_deleted: false,
  },
];

export function getJobById(id) {
  return jobs.find(j => j.id === id && !j.is_deleted) || null;
}

export function getJobsByClientId(clientId) {
  return jobs.filter(j => j.client_id === clientId && !j.is_deleted);
}

export function getActiveJobs() {
  return jobs.filter(j => !j.is_deleted);
}

// Returns jobs within `windowMinutes` of the given scheduled_at ISO string.
export function findConflicts(scheduledAtISO, durationMin, windowMinutes = 60) {
  const t = new Date(scheduledAtISO).getTime();
  if (Number.isNaN(t)) return [];
  const endT = t + durationMin * 60_000;
  return jobs.filter(j => {
    if (j.is_deleted) return false;
    const jt = new Date(j.scheduled_at).getTime();
    const je = jt + (j.duration_est || 0) * 60_000;
    const gapBefore = jt - endT;       // new ends, existing starts after
    const gapAfter  = t - je;          // existing ends, new starts after
    const overlap   = jt < endT && je > t;
    if (overlap) return true;
    const gap = Math.min(Math.abs(gapBefore), Math.abs(gapAfter));
    return gap < windowMinutes * 60_000;
  });
}

// Build America/Toronto ISO string from date (YYYY-MM-DD) + time (HH:mm).
// April 2026 is DST, so offset is -04:00. November–March would be -05:00.
export function torontoISO(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const month = parseInt(dateStr.slice(5, 7), 10);
  const day = parseInt(dateStr.slice(8, 10), 10);
  // DST in Canada: 2nd Sun March → 1st Sun Nov (approx)
  const isDST = (month > 3 && month < 11) ||
    (month === 3 && day >= 8) ||
    (month === 11 && day < 1);
  const offset = isDST ? '-04:00' : '-05:00';
  return `${dateStr}T${timeStr}:00${offset}`;
}

let nextId = 1000;
export function addJob(partial) {
  const id = `job-new-${nextId++}`;
  const job = {
    id,
    client_id: partial.client_id ?? null,
    service_type: partial.service_type ?? 'custom',
    scheduled_at: partial.scheduled_at ?? '',
    duration_est: partial.duration_est ?? 120,
    rate: partial.rate ?? 0,
    total: partial.total ?? partial.rate ?? 0,
    status: 'scheduled',
    payment_status: 'unpaid',
    notes: partial.notes ?? '',
    recurrence_rule: partial.recurrence_rule ?? null,
    is_deleted: false,
  };
  jobs.push(job);
  return job;
}
