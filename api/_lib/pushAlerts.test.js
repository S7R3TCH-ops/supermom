import { describe, it, expect } from 'vitest';
import {
  LEAVE_LEAD_MIN, WRAPUP_LEAD_MIN, TICK_MIN, DEFAULT_DRIVE_MIN,
  computeLeaveAt, computeEndAt, isLeaveDue, isWrapupDue,
  buildLeaveBody, buildWrapupBody, computeUnpaidBalance, capBody,
  formatTorontoTime, formatTorontoDateShort,
  resolveDriveSeconds, LIVE_DRIVE_MAX_AGE_MIN,
} from './pushAlerts.js';

// A 2:00 PM Toronto EDT job (Sep 18 is within DST) = 18:00 UTC.
const START = new Date('2026-09-18T18:00:00Z');

describe('computeLeaveAt', () => {
  it('uses the real drive time when known', () => {
    const leaveAt = computeLeaveAt(START, 18 * 60); // 18 min
    expect(leaveAt.getTime()).toBe(START.getTime() - 18 * 60 * 1000);
  });

  it('falls back to DEFAULT_DRIVE_MIN when drive_to is missing', () => {
    const leaveAt = computeLeaveAt(START, undefined);
    expect(leaveAt.getTime()).toBe(START.getTime() - DEFAULT_DRIVE_MIN * 60 * 1000);
  });

  it('falls back to DEFAULT_DRIVE_MIN when drive_to is false (attempted, no route)', () => {
    const leaveAt = computeLeaveAt(START, false);
    expect(leaveAt.getTime()).toBe(START.getTime() - DEFAULT_DRIVE_MIN * 60 * 1000);
  });

  it('returns null with no start time', () => {
    expect(computeLeaveAt(null, 600)).toBeNull();
  });
});

describe('computeEndAt', () => {
  it('adds estimated_hours', () => {
    const endAt = computeEndAt(START, 2.5);
    expect(endAt.getTime()).toBe(START.getTime() + 2.5 * 3600_000);
  });

  it('returns null when estimated_hours is null — no wrap-up alert for that job', () => {
    expect(computeEndAt(START, null)).toBeNull();
  });

  it('returns null when estimated_hours is 0', () => {
    expect(computeEndAt(START, 0)).toBeNull();
  });

  it('returns null when estimated_hours is undefined', () => {
    expect(computeEndAt(START, undefined)).toBeNull();
  });
});

describe('isLeaveDue — tick boundaries', () => {
  const leaveAt = computeLeaveAt(START, 18 * 60); // start - 18min
  const dueAt = new Date(leaveAt.getTime() - (LEAVE_LEAD_MIN + TICK_MIN) * 60_000);

  it('is false just before the due threshold', () => {
    const now = new Date(dueAt.getTime() - 1000);
    expect(isLeaveDue({ now, startAt: START, leaveAt })).toBe(false);
  });

  it('is true exactly at the due threshold', () => {
    expect(isLeaveDue({ now: dueAt, startAt: START, leaveAt })).toBe(true);
  });

  it('is true just after the due threshold', () => {
    const now = new Date(dueAt.getTime() + 1000);
    expect(isLeaveDue({ now, startAt: START, leaveAt })).toBe(true);
  });

  it('is false once the job has started', () => {
    expect(isLeaveDue({ now: START, startAt: START, leaveAt })).toBe(false);
  });

  it('same-day-booking gate: false when leave_at is already more than TICK_MIN in the past', () => {
    // Job booked 20 min before start, leave_at computed as start-30min default
    // drive, which is already 10 min behind "now" by the time this tick runs —
    // more than TICK_MIN (5) in the past, so it must be skipped, not fired late.
    const staleLeaveAt = new Date(START.getTime() - 30 * 60_000);
    const now = new Date(staleLeaveAt.getTime() + 6 * 60_000); // 6 min past leaveAt
    expect(isLeaveDue({ now, startAt: START, leaveAt: staleLeaveAt })).toBe(false);
  });

  it('same-day-booking gate: still true when leave_at is only just past (within TICK_MIN)', () => {
    const staleLeaveAt = new Date(START.getTime() - 30 * 60_000);
    const now = new Date(staleLeaveAt.getTime() + 4 * 60_000); // 4 min past leaveAt, < TICK_MIN
    expect(isLeaveDue({ now, startAt: START, leaveAt: staleLeaveAt })).toBe(true);
  });
});

describe('isWrapupDue — tick boundaries', () => {
  const endAt = computeEndAt(START, 3); // 3h job
  const dueAt = new Date(endAt.getTime() - (WRAPUP_LEAD_MIN + TICK_MIN) * 60_000);

  it('is false just before the due threshold', () => {
    const now = new Date(dueAt.getTime() - 1000);
    expect(isWrapupDue({ now, endAt })).toBe(false);
  });

  it('is true exactly at the due threshold', () => {
    expect(isWrapupDue({ now: dueAt, endAt })).toBe(true);
  });

  it('is false once the job has ended', () => {
    expect(isWrapupDue({ now: endAt, endAt })).toBe(false);
  });

  it('is false when endAt is null (no estimated_hours)', () => {
    expect(isWrapupDue({ now: START, endAt: null })).toBe(false);
  });
});

describe('buildLeaveBody', () => {
  it('includes drive time and address when drive_to is known', () => {
    const leaveAt = computeLeaveAt(START, 18 * 60);
    const { title, body } = buildLeaveBody({
      clientName: 'Ann Rae', startAt: START, leaveAt, driveSeconds: 18 * 60, address: '14 Main St',
    });
    expect(title).toBe(`Leave by ${formatTorontoTime(leaveAt)} for Ann Rae`);
    expect(body).toBe(`18 min drive · job at ${formatTorontoTime(START)} · 14 Main St`);
  });

  it('falls back to "drive time not calculated" when drive_to is missing', () => {
    const leaveAt = computeLeaveAt(START, undefined);
    const { body } = buildLeaveBody({
      clientName: 'Ann Rae', startAt: START, leaveAt, driveSeconds: undefined, address: '14 Main St',
    });
    expect(body).toBe(`Drive time not calculated · job at ${formatTorontoTime(START)}`);
  });

  it('falls back to a generic client label when clientName is missing', () => {
    const leaveAt = computeLeaveAt(START, 600);
    const { title } = buildLeaveBody({ clientName: '', startAt: START, leaveAt, driveSeconds: 600, address: null });
    expect(title).toContain('your client');
  });
});

describe('buildWrapupBody', () => {
  const endAt = computeEndAt(START, 3);

  it('shows only the time cue when nothing else applies', () => {
    const { body } = buildWrapupBody({ clientName: 'Ann Rae', endAt, pendingNote: null, jobNotes: null, balance: null, jobId: 'B' });
    expect(body).toBe(`Scheduled to finish at ${formatTorontoTime(endAt)}.`);
  });

  it('includes an unconsumed carried note, this job\'s own notes, and the unpaid balance in order', () => {
    const { body } = buildWrapupBody({
      clientName: 'Ann Rae', endAt,
      pendingNote: 'Collect payment before you leave', pendingNoteSourceJobId: 'A', jobId: 'B',
      jobNotes: 'Side gate code 4471, dog stays in',
      balance: { amount: 120, oldestDate: '2026-06-15' },
    });
    const lines = body.split('\n');
    expect(lines[0]).toBe('✦ Collect payment before you leave');
    expect(lines[1]).toBe('Notes: Side gate code 4471, dog stays in');
    expect(lines[2]).toBe('Owes $120.00 from Jun 15');
  });

  it('pending_note source-exclusion: omits the carried note when this job is its own source', () => {
    const { body } = buildWrapupBody({
      clientName: 'Ann Rae', endAt,
      pendingNote: 'Some note', pendingNoteSourceJobId: 'B', jobId: 'B',
      jobNotes: null, balance: null,
    });
    expect(body).not.toContain('Some note');
    expect(body).toBe(`Scheduled to finish at ${formatTorontoTime(endAt)}.`);
  });

  it('truncates a long carried note to 110 chars (plus ellipsis) — isolated from the overall 160-char cap', () => {
    const longNote = 'x'.repeat(200);
    const { body } = buildWrapupBody({
      clientName: 'Ann Rae', endAt,
      pendingNote: longNote, pendingNoteSourceJobId: 'A', jobId: 'B',
      jobNotes: null, balance: null,
    });
    expect(body.length).toBe(112); // '✦ ' (2 chars) + 110
    expect(body.endsWith('…')).toBe(true);
  });

  it('truncates long job notes to 80 chars (plus ellipsis) — isolated from the overall 160-char cap', () => {
    const longJobNotes = 'y'.repeat(200);
    const { body } = buildWrapupBody({
      clientName: 'Ann Rae', endAt,
      pendingNote: null, jobId: 'B',
      jobNotes: longJobNotes, balance: null,
    });
    expect(body.length).toBe(87); // 'Notes: ' (7 chars) + 80
    expect(body.endsWith('…')).toBe(true);
  });

  it('caps the whole body at ~160 chars even with all three sources present', () => {
    const { body } = buildWrapupBody({
      clientName: 'Ann Rae', endAt,
      pendingNote: 'x'.repeat(110), pendingNoteSourceJobId: 'A', jobId: 'B',
      jobNotes: 'y'.repeat(80),
      balance: { amount: 120, oldestDate: '2026-06-15' },
    });
    expect(body.length).toBeLessThanOrEqual(160);
    expect(body.endsWith('…')).toBe(true);
  });
});

describe('capBody', () => {
  it('leaves short bodies untouched', () => {
    expect(capBody('short')).toBe('short');
  });

  it('truncates at the max length with an ellipsis', () => {
    const capped = capBody('x'.repeat(200), 160);
    expect(capped.length).toBe(160);
    expect(capped.endsWith('…')).toBe(true);
  });
});

describe('computeUnpaidBalance — is_void math', () => {
  it('excludes voided payments from the paid total (v0.13.67 lesson)', () => {
    const jobs = [{
      scheduled_date: '2026-06-15',
      total_amount: 120,
      payments: [{ amount: 120, is_void: true }], // fully voided — should NOT count as paid
    }];
    const balance = computeUnpaidBalance(jobs);
    expect(balance).toEqual({ amount: 120, oldestDate: '2026-06-15' });
  });

  it('counts only non-void payments toward paid', () => {
    const jobs = [{
      scheduled_date: '2026-06-15',
      total_amount: 120,
      payments: [{ amount: 50, is_void: false }, { amount: 50, is_void: true }],
    }];
    const balance = computeUnpaidBalance(jobs);
    expect(balance.amount).toBeCloseTo(70);
  });

  it('returns null when nothing is owed', () => {
    const jobs = [{ scheduled_date: '2026-06-15', total_amount: 100, payments: [{ amount: 100, is_void: false }] }];
    expect(computeUnpaidBalance(jobs)).toBeNull();
  });

  it('returns null for an empty job list', () => {
    expect(computeUnpaidBalance([])).toBeNull();
  });

  it('picks the oldest unpaid date across multiple jobs', () => {
    const jobs = [
      { scheduled_date: '2026-07-01', total_amount: 50, payments: [] },
      { scheduled_date: '2026-06-15', total_amount: 40, payments: [] },
    ];
    const balance = computeUnpaidBalance(jobs);
    expect(balance.oldestDate).toBe('2026-06-15');
    expect(balance.amount).toBeCloseTo(90);
  });
});

describe('formatTorontoDateShort', () => {
  it('formats a plain date string', () => {
    expect(formatTorontoDateShort('2026-06-15')).toBe('Jun 15');
  });

  it('handles a DST-boundary date (2026-11-01) without shifting the day', () => {
    expect(formatTorontoDateShort('2026-11-01')).toBe('Nov 1');
  });

  it('returns empty string for falsy input', () => {
    expect(formatTorontoDateShort(null)).toBe('');
  });
});

describe('resolveDriveSeconds', () => {
  const NOW = new Date('2026-09-18T17:00:00Z');
  const minsAgo = m => new Date(NOW.getTime() - m * 60_000).toISOString();
  const live = (secs, ago) => ({ durationValue: secs, duration: `${secs / 60} mins`, computed_at: minsAgo(ago) });
  const chain = secs => ({ from: 'Previous Job', durationValue: secs });

  it('prefers a fresh live GPS reading over the static chain', () => {
    expect(resolveDriveSeconds({ drive_to_live: live(1500, 20), drive_to: chain(600) }, NOW)).toBe(1500);
  });
  it('uses live even when there is no static chain at all', () => {
    expect(resolveDriveSeconds({ drive_to_live: live(900, 5) }, NOW)).toBe(900);
  });
  it('accepts live right at the staleness cutoff', () => {
    expect(resolveDriveSeconds({ drive_to_live: live(900, LIVE_DRIVE_MAX_AGE_MIN), drive_to: chain(600) }, NOW)).toBe(900);
  });
  it('falls back to the static chain once live is older than the cutoff', () => {
    expect(resolveDriveSeconds({ drive_to_live: live(900, LIVE_DRIVE_MAX_AGE_MIN + 1), drive_to: chain(600) }, NOW)).toBe(600);
  });
  it('tolerates a slightly-ahead client clock, rejects one far in the future', () => {
    expect(resolveDriveSeconds({ drive_to_live: live(900, -3), drive_to: chain(600) }, NOW)).toBe(900);
    expect(resolveDriveSeconds({ drive_to_live: live(900, -60), drive_to: chain(600) }, NOW)).toBe(600);
  });
  it('ignores malformed live readings', () => {
    for (const bad of [
      { durationValue: 0, computed_at: minsAgo(1) },
      { durationValue: 'fast', computed_at: minsAgo(1) },
      { durationValue: 900 },
      { durationValue: 900, computed_at: 'not a date' },
      null,
    ]) {
      expect(resolveDriveSeconds({ drive_to_live: bad, drive_to: chain(600) }, NOW)).toBe(600);
    }
  });
  it('returns null when nothing usable (static false = attempted, no route)', () => {
    expect(resolveDriveSeconds({ drive_to: false }, NOW)).toBeNull();
    expect(resolveDriveSeconds({}, NOW)).toBeNull();
    expect(resolveDriveSeconds(null, NOW)).toBeNull();
  });
  it('feeds computeLeaveAt: live 25 min → leave 25 min before start', () => {
    const secs = resolveDriveSeconds({ drive_to_live: live(1500, 10), drive_to: chain(600) }, NOW);
    expect(computeLeaveAt(START, secs).toISOString()).toBe('2026-09-18T17:35:00.000Z');
  });
});

describe('isLeaveDue — live estimate grows (running late, not a late booking)', () => {
  // 10:00 job (14:00Z). Static 15 min → leave 9:45. Live 45 min → leave 9:15.
  const start = new Date('2026-09-18T14:00:00Z');
  const staticLeave = computeLeaveAt(start, 15 * 60);
  const liveLeave = computeLeaveAt(start, 45 * 60);
  const at = hhmm => new Date(`2026-09-18T${hhmm}:00Z`);

  it('without a gate baseline the grown estimate is suppressed (old behaviour)', () => {
    expect(isLeaveDue({ now: at('13:35'), startAt: start, leaveAt: liveLeave })).toBe(false);
  });
  it('with the static baseline it fires on the next tick', () => {
    expect(isLeaveDue({ now: at('13:35'), startAt: start, leaveAt: liveLeave, gateLeaveAt: staticLeave })).toBe(true);
  });
  it('a genuine late booking is still gated (static leave time long past too)', () => {
    expect(isLeaveDue({ now: at('13:55'), startAt: start, leaveAt: liveLeave, gateLeaveAt: staticLeave })).toBe(false);
  });
  it('resolveDriveSeconds liveAllowed:false ignores the live tier', () => {
    const ctx = { drive_to_live: { durationValue: 2700, computed_at: '2026-09-18T13:30:00Z' }, drive_to: { durationValue: 900 } };
    expect(resolveDriveSeconds(ctx, at('13:35'), { liveAllowed: false })).toBe(900);
    expect(resolveDriveSeconds(ctx, at('13:35'))).toBe(2700);
  });
});
