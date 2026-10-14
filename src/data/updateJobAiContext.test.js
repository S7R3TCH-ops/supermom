import { describe, it, expect, vi, beforeEach } from 'vitest';

// Generic in-memory table: select/update with eq filters, .single(), thenable.
let db;

vi.mock('../lib/supabase', () => {
  const from = table => {
    const q = { op: 'select', filters: [], patch: null, single: false };
    const exec = () => {
      let rows = (db[table] || []).filter(r => q.filters.every(([c, v]) => r[c] === v));
      if (q.op === 'update') rows.forEach(r => Object.assign(r, q.patch));
      const data = q.single ? (rows[0] ?? null) : rows;
      return Promise.resolve({ data, error: null });
    };
    const b = {
      select: () => b,
      update: patch => { q.op = 'update'; q.patch = patch; return b; },
      eq: (c, v) => { q.filters.push([c, v]); return b; },
      single: () => { q.single = true; return exec(); },
      then: (res, rej) => exec().then(res, rej),
    };
    return b;
  };
  return { supabase: { from }, authHeaders: async () => ({}) };
});
vi.mock('./currentBusiness', () => ({ getCurrentBusinessId: async () => 'biz-1' }));
vi.mock('../lib/errorTracking', () => ({ logClientError: () => {} }));

const { updateJob } = await import('./jobsRepo');

const job = (id, ctx = {}, extra = {}) => ({
  id,
  business_id: 'biz-1',
  job_status: 'Scheduled',
  template_id: null,
  scheduled_date: '2026-10-12',
  ai_context: ctx,
  ...extra,
});

beforeEach(() => {
  db = { jobs: [] };
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
});

describe('updateJob ai_context safety', () => {
  it("single save keeps the row's gcal_event_id even when the caller's snapshot lacks or has a stale one", async () => {
    db.jobs = [job('j1', { gcal_event_id: 'evFresh', drive_to: { duration: '8 mins' } })];
    await updateJob('j1', { scheduled_date: '2026-10-14', ai_context: { payment_method: 'Cash' } });
    expect(db.jobs[0].ai_context.gcal_event_id).toBe('evFresh');
    expect(db.jobs[0].ai_context.payment_method).toBe('Cash');
    expect('drive_to' in db.jobs[0].ai_context).toBe(false); // omitted by the caller => cleared on reschedule

    await updateJob('j1', { ai_context: { gcal_event_id: 'evStale' } });
    expect(db.jobs[0].ai_context.gcal_event_id).toBe('evFresh');
  });

  it('a patch without ai_context does not touch it', async () => {
    db.jobs = [job('j1', { gcal_event_id: 'evFresh' })];
    await updateJob('j1', { job_notes: 'hi' });
    expect(db.jobs[0].ai_context).toEqual({ gcal_event_id: 'evFresh' });
  });

  it('series edit never copies gcal_event_id / drive_to / occurrence_index to sibling jobs', async () => {
    db.jobs = [
      job('j1', { gcal_event_id: 'ev1', occurrence_index: 0 }, { template_id: 't1' }),
      job('j2', { gcal_event_id: 'ev2', occurrence_index: 1 }, { template_id: 't1', scheduled_date: '2026-10-19' }),
      job('j3', { gcal_event_id: 'ev3', occurrence_index: 2 }, { template_id: 't1', scheduled_date: '2026-10-26' }),
    ];
    // Snapshot carries a different id / drive_to than the row (stale) plus a real change.
    await updateJob(
      'j1',
      {
        job_notes: 'series note',
        ai_context: {
          gcal_event_id: 'evSTALE',
          occurrence_index: 99,
          drive_to: { duration: '5 mins' },
          payment_method: 'E-Transfer',
        },
      },
      'all',
    );
    expect(db.jobs.map(j => j.ai_context.gcal_event_id)).toEqual(['ev1', 'ev2', 'ev3']);
    expect(db.jobs.map(j => j.ai_context.occurrence_index)).toEqual([0, 1, 2]);
    expect(db.jobs.some(j => 'drive_to' in j.ai_context)).toBe(false);
    expect(db.jobs.map(j => j.ai_context.payment_method)).toEqual(['E-Transfer', 'E-Transfer', 'E-Transfer']);
  });
});
