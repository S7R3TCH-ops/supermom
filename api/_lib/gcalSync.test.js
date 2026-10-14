import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- fake Google Calendar: events keyed by id, 409 on duplicate insert, 404 on missing ----
let events;
let gcalCalls;
let googleError;
const gErr = (code) => Object.assign(new Error(`google ${code}`), { code });

let reviveTombstones;
let onInsert;
vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: class { setCredentials() {} } },
    calendar: () => ({
      events: {
        insert: async ({ resource }) => {
          gcalCalls.push(['insert', resource.id]);
          if (googleError) throw googleError;
          const id = resource.id || 'rand' + events.size;
          if (events.has(id)) throw gErr(409); // live event OR cancelled tombstone
          events.set(id, { ...resource, id });
          if (onInsert) onInsert();
          return { data: { id } };
        },
        update: async ({ eventId, resource }) => {
          gcalCalls.push(['update', eventId]);
          const cur = events.get(eventId);
          if (!cur) throw gErr(404);
          if (cur.status === 'cancelled' && !reviveTombstones) throw gErr(410);
          events.set(eventId, { ...cur, ...resource });
          return { data: { id: eventId } };
        },
        delete: async ({ eventId }) => {
          gcalCalls.push(['delete', eventId]);
          const cur = events.get(eventId);
          if (!cur) throw gErr(404);
          if (cur.status === 'cancelled') throw gErr(410);
          events.set(eventId, { ...cur, status: 'cancelled' }); // Google keeps a tombstone
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

const { default: handler, detEventId } = await import('../sync/gcal.js');

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
const live = () => [...events.values()].filter((e) => e.status !== 'cancelled');
const call = async (jobId, action) => {
  const out = {};
  const res = { status: (c) => ((out.code = c), res), json: (b) => ((out.body = b), res), send: () => res };
  await handler({ method: 'POST', body: { jobId, action } }, res);
  return out;
};

beforeEach(() => {
  events = new Map();
  gcalCalls = [];
  googleError = null;
  reviveTombstones = true;
  onInsert = null;
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
    expect(live().length).toBe(1);
    expect(db.jobs[0].ai_context.gcal_event_id).toBe(out.body.eventId);
  });

  it('moving a job updates its event in place (no second event)', async () => {
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    db.jobs[0].scheduled_date = '2026-10-14';
    await call(J1, 'upsert');
    expect(live().length).toBe(1);
    expect(live()[0].start.dateTime).toContain('2026-10-14');
  });

  it('lost gcal_event_id re-finds its own event instead of orphaning it', async () => {
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    db.jobs[0].ai_context = {}; // id lost (stale-snapshot overwrite)
    db.jobs[0].scheduled_date = '2026-10-14';
    await call(J1, 'upsert');
    expect(live().length).toBe(1);
    expect(live()[0].start.dateTime).toContain('2026-10-14');
  });

  it('two concurrent first syncs create exactly one event', async () => {
    db.jobs = [mkJob(J1)];
    await Promise.all([call(J1, 'upsert'), call(J1, 'upsert')]);
    expect(live().length).toBe(1);
  });

  it('a job whose stored id is held by another live job gets its own event', async () => {
    events.set('shared', { id: 'shared' });
    db.jobs = [mkJob(J1, { gcal_event_id: 'shared' }), mkJob(J2, { gcal_event_id: 'shared' })];
    await call(J1, 'upsert');
    expect(db.jobs[0].ai_context.gcal_event_id).toBe(detEventId(J1));
    // job 2 is now the only holder, so it keeps the original event
    await call(J2, 'upsert');
    expect(db.jobs[1].ai_context.gcal_event_id).toBe('shared');
    expect(live().length).toBe(2);
  });

  it('recreates when Google no longer has the stored event (404)', async () => {
    db.jobs = [mkJob(J1, { gcal_event_id: 'gone' })];
    const out = await call(J1, 'upsert');
    expect(out.body.eventId).toBe(detEventId(J1));
    expect(live().length).toBe(1);
  });

  it('delete removes the event; a missing event is not an error', async () => {
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    expect((await call(J1, 'delete')).body.status).toBe('deleted');
    expect(live().length).toBe(0);
    expect((await call(J1, 'delete')).body.status).toBe('deleted');
  });

  it('delete with a lost stored id still removes the deterministic event', async () => {
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    db.jobs[0].ai_context = {};
    await call(J1, 'delete');
    expect(live().length).toBe(0);
  });

  it('delete never removes an event another live job still holds', async () => {
    events.set('shared', { id: 'shared' });
    db.jobs = [mkJob(J1, { gcal_event_id: 'shared' }), mkJob(J2, { gcal_event_id: 'shared' })];
    const out = await call(J1, 'delete');
    expect(out.body.shared).toBe(true);
    expect(events.get('shared').status).not.toBe('cancelled');
  });

  it('write-back merges onto fresh ai_context instead of clobbering concurrent keys', async () => {
    db.jobs = [mkJob(J1, { drive_to: { duration: '8 mins' } })];
    await call(J1, 'upsert');
    expect(db.jobs[0].ai_context.drive_to).toEqual({ duration: '8 mins' });
  });

  it('re-syncing after the event was deleted revives it (no second event)', async () => {
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    await call(J1, 'delete');
    expect(live().length).toBe(0);
    await call(J1, 'upsert');
    expect(live().length).toBe(1);
    expect(db.jobs[0].ai_context.gcal_event_id).toBe(detEventId(J1));
  });

  it("falls back to a fresh event if Google refuses to revive the deleted one (410)", async () => {
    reviveTombstones = false;
    db.jobs = [mkJob(J1)];
    await call(J1, 'upsert');
    await call(J1, 'delete');
    const out = await call(J1, 'upsert');
    expect(out.code).toBe(200);
    expect(live().length).toBe(1);
    expect(db.jobs[0].ai_context.gcal_event_id).not.toBe(detEventId(J1));
  });

  it('write-back keeps keys written to the row while the Google call was in flight', async () => {
    db.jobs = [mkJob(J1, { payment_method: 'Cash' })];
    // Another writer (drive-time patch) lands between the job read and the write-back.
    onInsert = () => { db.jobs[0].ai_context = { ...db.jobs[0].ai_context, drive_to: { duration: '9 mins' } }; };
    await call(J1, 'upsert');
    expect(db.jobs[0].ai_context.drive_to).toEqual({ duration: '9 mins' });
    expect(db.jobs[0].ai_context.payment_method).toBe('Cash');
    expect(db.jobs[0].ai_context.gcal_event_id).toBe(detEventId(J1));
  });

  it('never writes ai_context if the fresh re-read fails (would wipe other keys)', async () => {
    db.jobs = [mkJob(J1, { payment_method: 'Cash', drive_to: { duration: '8 mins' } })];
    const realFrom = db.jobs;
    // Make the re-read (second jobs select by id) fail by removing the row mid-flight.
    onInsert = () => { db.jobs = []; };
    const out = await call(J1, 'upsert');
    expect(out.code).toBe(500);
    expect(realFrom[0].ai_context).toEqual({ payment_method: 'Cash', drive_to: { duration: '8 mins' } });
  });

  it('persists token_expired on the integration when Google says invalid_grant', async () => {
    db.jobs = [mkJob(J1)];
    googleError = Object.assign(new Error('invalid_grant'), { response: { data: { error: 'invalid_grant' } } });
    const out = await call(J1, 'upsert');
    expect(out.body.status).toBe('token_expired');
    expect(db.integrations[0].sync_status).toBe('token_expired');
  });
});
