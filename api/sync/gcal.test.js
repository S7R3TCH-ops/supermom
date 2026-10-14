import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- fake Google Calendar: events keyed by id, 409 on duplicate insert, 404 on missing ----
let events;
let gcalCalls;
const gErr = (code) => Object.assign(new Error(`google ${code}`), { code });

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: class { setCredentials() {} } },
    calendar: () => ({
      events: {
        insert: async ({ resource }) => {
          gcalCalls.push(['insert', resource.id]);
          const id = resource.id || 'rand' + events.size;
          if (events.has(id)) throw gErr(409);
          events.set(id, { ...resource, id });
          return { data: { id } };
        },
        update: async ({ eventId, resource }) => {
          gcalCalls.push(['update', eventId]);
          if (!events.has(eventId)) throw gErr(404);
          events.set(eventId, { ...events.get(eventId), ...resource });
          return { data: { id: eventId } };
        },
        delete: async ({ eventId }) => {
          gcalCalls.push(['delete', eventId]);
          if (!events.has(eventId)) throw gErr(404);
          events.delete(eventId);
          return {};
        },
      },
    }),
  },
}));

// ---- in-memory supabase: only what the handler uses ----
let db;
function makeQuery(table) {
  const q = { filters: [], op: 'select', patch: null };
  const matches = () =>
    (db[table] || []).filter((r) =>
      q.filters.every(([kind, col, val]) => {
        const v = col.includes('->>')
          ? (r[col.split('->>')[0]] || {})[col.split('->>')[1]]
          : r[col];
        if (kind === 'eq') return v === val;
        if (kind === 'neq') return v !== val;
        if (kind === 'is') return (v ?? null) === val;
        return true;
      }),
    );
  const api = {
    select: () => api,
    eq: (c, v) => (q.filters.push(['eq', c, v]), api),
    neq: (c, v) => (q.filters.push(['neq', c, v]), api),
    is: (c, v) => (q.filters.push(['is', c, v]), api),
    limit: () => api,
    update: (patch) => ((q.op = 'update'), (q.patch = patch), api),
    single: () => Promise.resolve({ data: matches()[0] ?? null, error: matches()[0] ? null : { message: 'none' } }),
    maybeSingle: () => Promise.resolve({ data: matches()[0] ?? null, error: null }),
    then: (res, rej) => {
      if (q.op === 'update') matches().forEach((r) => Object.assign(r, q.patch));
      const rows = q.op === 'select' ? matches() : null;
      return Promise.resolve({ data: rows, error: null }).then(res, rej);
    },
  };
  return api;
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: makeQuery }) }));

const { default: handler, detEventId } = await import('./gcal.js');

const BIZ = 'biz-1';
const J1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const J2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const mkJob = (id, ctx = {}, extra = {}) => ({
  id,
  business_id: BIZ,
  scheduled_date: '2026-10-13',
  scheduled_time: '09:15:00',
  estimated_hours: 2,
  service_name: 'Chores',
  job_notes: null,
  deleted_at: null,
  ai_context: ctx,
  clients: { first_name: 'Katie', last_name: 'S' },
  ...extra,
});
const call = async (jobId, action) => {
  const out = {};
  const res = { status: (c) => ((out.code = c), res), json: (b) => ((out.body = b), res), send: () => res };
  await handler({ method: 'POST', body: { jobId, action } }, res);
  return out;
};

beforeEach(() => {
  events = new Map();
  gcalCalls = [];
  db = {
    integrations: [{ business_id: BIZ, service_name: 'google_calendar', calendar_id: 'primary', refresh_token: 'rt' }],
    jobs: [],
  };
});

describe('gcal sync', () => {
  it('creates one event with a deterministic id and records it', async () => {
    db.jobs = [mkJob(J1)];
    const out = await call(J1, 'upsert');
    expect(out.body.eventId).toBe(detEventId(J1));
    expect(events.size).toBe(1);
    expect(db.jobs[0].ai_context.gcal_event_id).toBe(out.body.eventId);
  });

  it('moving a job updates its event in place (no second event)', async () => {
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    db.jobs[0].scheduled_date = '2026-10-14';
    await call(J1, 'upsert');
    expect(events.size).toBe(1);
    expect([...events.values()][0].start.dateTime).toContain('2026-10-14');
  });

  it('lost gcal_event_id re-finds its own event instead of orphaning it', async () => {
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    db.jobs[0].ai_context = {}; // id lost (stale-snapshot overwrite)
    db.jobs[0].scheduled_date = '2026-10-14';
    await call(J1, 'upsert');
    expect(events.size).toBe(1);
    expect([...events.values()][0].start.dateTime).toContain('2026-10-14');
  });

  it('two concurrent first syncs create exactly one event', async () => {
    db.jobs = [mkJob(J1)];
    await Promise.all([call(J1, 'upsert'), call(J1, 'upsert')]);
    expect(events.size).toBe(1);
  });

  it('a job whose stored id is held by another live job gets its own event', async () => {
    events.set('shared', { id: 'shared' });
    db.jobs = [mkJob(J1, { gcal_event_id: 'shared' }), mkJob(J2, { gcal_event_id: 'shared' })];
    await call(J1, 'upsert');
    expect(db.jobs[0].ai_context.gcal_event_id).toBe(detEventId(J1));
    // job 2 is now the only holder, so it keeps the original event
    await call(J2, 'upsert');
    expect(db.jobs[1].ai_context.gcal_event_id).toBe('shared');
    expect(events.size).toBe(2);
  });

  it('recreates when Google no longer has the stored event (404)', async () => {
    db.jobs = [mkJob(J1, { gcal_event_id: 'gone' })];
    const out = await call(J1, 'upsert');
    expect(out.body.eventId).toBe(detEventId(J1));
    expect(events.size).toBe(1);
  });

  it('delete removes the event; a missing event is not an error', async () => {
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    expect((await call(J1, 'delete')).body.status).toBe('deleted');
    expect(events.size).toBe(0);
    expect((await call(J1, 'delete')).body.status).toBe('deleted');
  });

  it('delete with a lost stored id still removes the deterministic event', async () => {
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    db.jobs[0].ai_context = {};
    await call(J1, 'delete');
    expect(events.size).toBe(0);
  });

  it('delete never removes an event another live job still holds', async () => {
    events.set('shared', { id: 'shared' });
    db.jobs = [mkJob(J1, { gcal_event_id: 'shared' }), mkJob(J2, { gcal_event_id: 'shared' })];
    const out = await call(J1, 'delete');
    expect(out.body.shared).toBe(true);
    expect(events.has('shared')).toBe(true);
  });

  it('write-back merges onto fresh ai_context instead of clobbering concurrent keys', async () => {
    db.jobs = [mkJob(J1, { drive_to: { duration: '8 mins' } })];
    await call(J1, 'upsert');
    expect(db.jobs[0].ai_context.drive_to).toEqual({ duration: '8 mins' });
  });
});
