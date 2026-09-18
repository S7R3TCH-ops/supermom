// Pure logic for the lockscreen-push feature — leave-time + wrap-up alert
// window math and body assembly. Deliberately has ZERO imports from web-push
// or @supabase/* (those live only in api/reminders/[action].js) so every
// function here is a plain (input) -> output transform, testable without
// mocking a network client, and every "now" is passed in rather than read
// from Date.now() internally — see api/_lib/pushAlerts.test.js.
//
// Design doc: second-brain/00-inbox/2026-09-18-supermom-lockscreen-notifications-design.md §2.6/§2.7/§3.

export const LEAVE_LEAD_MIN = 5;
export const WRAPUP_LEAD_MIN = 10;
export const TICK_MIN = 5;
export const DEFAULT_DRIVE_MIN = 30;
export const TTL_SEC = 600;

const MS_PER_MIN = 60_000;

// ── formatting ──────────────────────────────────────────────────────────────

/** "1:42 PM" in America/Toronto, from a real Date. */
export function formatTorontoTime(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** "Jun 15" in America/Toronto, from a 'YYYY-MM-DD' string. */
export function formatTorontoDateShort(dateStr) {
  if (!dateStr) return '';
  // Noon-UTC anchor (same trick as composeTorontoISO) — the calendar date is
  // unambiguous regardless of DST state, we only need month/day out of it.
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

function truncate(s, max) {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1).trimEnd()}…`;
}

/** Caps a (possibly multi-line) body at ~160 chars — iOS lock-screen budget. */
export function capBody(body, max = 160) {
  const str = String(body ?? '');
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1).trimEnd()}…`;
}

// ── window math ─────────────────────────────────────────────────────────────

/**
 * leave_at = start − drive time (or DEFAULT_DRIVE_MIN when drive_to is
 * missing/false). driveSeconds should be `ai_context.drive_to.durationValue`
 * or null/undefined/false.
 */
export function computeLeaveAt(startAt, driveSeconds) {
  if (!startAt) return null;
  const driveMs = (typeof driveSeconds === 'number' && driveSeconds > 0)
    ? driveSeconds * 1000
    : DEFAULT_DRIVE_MIN * MS_PER_MIN;
  return new Date(startAt.getTime() - driveMs);
}

/** end_at = start + estimated_hours. Returns null when estimated_hours is null/0 — no wrap-up alert for that job. */
export function computeEndAt(startAt, estimatedHours) {
  if (!startAt) return null;
  const hrs = Number(estimatedHours);
  if (!hrs || hrs <= 0 || Number.isNaN(hrs)) return null;
  return new Date(startAt.getTime() + hrs * 3600_000);
}

/**
 * Due when now >= leave_at - (LEAVE_LEAD_MIN + TICK_MIN) AND now < start_at,
 * with a same-day-booking gate: skip if leave_at is already more than
 * TICK_MIN in the past (a job booked 20-30 min out shouldn't fire a
 * "leave now" for a time that's already passed by the first tick that sees it).
 */
export function isLeaveDue({ now, startAt, leaveAt }) {
  if (!now || !startAt || !leaveAt) return false;
  const nowMs = now.getTime();
  const dueAt = leaveAt.getTime() - (LEAVE_LEAD_MIN + TICK_MIN) * MS_PER_MIN;
  if (nowMs < dueAt) return false;
  if (nowMs >= startAt.getTime()) return false;
  if (leaveAt.getTime() < nowMs - TICK_MIN * MS_PER_MIN) return false;
  return true;
}

/** Due when now >= end_at - (WRAPUP_LEAD_MIN + TICK_MIN) AND now < end_at. */
export function isWrapupDue({ now, endAt }) {
  if (!now || !endAt) return false;
  const nowMs = now.getTime();
  const dueAt = endAt.getTime() - (WRAPUP_LEAD_MIN + TICK_MIN) * MS_PER_MIN;
  if (nowMs < dueAt) return false;
  if (nowMs >= endAt.getTime()) return false;
  return true;
}

// ── balance math (§3, source 3 — "prior unpaid balance") ──────────────────

/**
 * jobs: [{ scheduled_date: 'YYYY-MM-DD', total_amount, payments: [{amount, is_void}] }]
 * (already filtered to this client's completed, non-deleted, non-'Paid' jobs).
 * Mirrors useData.js's is_void filter (v0.13.67 fix) — a voided payment must
 * never count toward "paid". Returns null when nothing is owed.
 */
export function computeUnpaidBalance(jobs) {
  let total = 0;
  let oldestDate = null;
  for (const j of jobs ?? []) {
    const paid = (j.payments ?? [])
      .filter(p => !p.is_void)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const owed = (Number(j.total_amount) || 0) - paid;
    if (owed > 0.005) {
      total += owed;
      if (!oldestDate || j.scheduled_date < oldestDate) oldestDate = j.scheduled_date;
    }
  }
  return total > 0.005 ? { amount: total, oldestDate } : null;
}

// ── body assembly (§2.7 leave payload, §3 wrap-up body) ────────────────────

/**
 * { clientName, startAt, leaveAt, driveSeconds, address } -> { title, body }
 */
export function buildLeaveBody({ clientName, startAt, leaveAt, driveSeconds, address }) {
  const leaveLabel = formatTorontoTime(leaveAt);
  const startLabel = formatTorontoTime(startAt);
  const title = `Leave by ${leaveLabel} for ${clientName || 'your client'}`;
  const hasDrive = typeof driveSeconds === 'number' && driveSeconds > 0;
  const body = hasDrive
    ? `${Math.round(driveSeconds / 60)} min drive · job at ${startLabel}${address ? ` · ${address}` : ''}`
    : `Drive time not calculated · job at ${startLabel}`;
  return { title, body: capBody(body) };
}

/**
 * { clientName, endAt, pendingNote, pendingNoteSourceJobId, jobId, jobNotes, balance }
 * -> { title, body }. balance is the computeUnpaidBalance() result or null.
 * The alert always fires even with no note/balance — the body just becomes
 * the bare "Scheduled to finish at X." time cue (§3).
 */
export function buildWrapupBody({ clientName, endAt, pendingNote, pendingNoteSourceJobId, jobId, jobNotes, balance }) {
  const endLabel = formatTorontoTime(endAt);
  const title = `Wrapping up at ${clientName || 'the job'}'s — ends ${endLabel}`;

  const lines = [];

  // Source 1: unconsumed carried note. `!== jobId` exclusion only matters
  // post-completion in practice (this sweep only ever evaluates Scheduled
  // jobs) — kept as a belt-and-braces check per the design doc.
  const note = (pendingNote ?? '').trim();
  if (note && pendingNoteSourceJobId !== jobId) {
    lines.push(`✦ ${truncate(note, 110)}`);
  }

  // Source 2: this job's own notes.
  const own = (jobNotes ?? '').trim();
  if (own) {
    lines.push(`Notes: ${truncate(own, 80)}`);
  }

  // Source 3: prior unpaid balance — no note needed at all, most reliable signal.
  if (balance && balance.amount > 0.005) {
    lines.push(`Owes $${balance.amount.toFixed(2)} from ${formatTorontoDateShort(balance.oldestDate)}`);
  }

  const body = lines.length > 0
    ? lines.join('\n')
    : `Scheduled to finish at ${endLabel}.`;

  return { title, body: capBody(body) };
}
