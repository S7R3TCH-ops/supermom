import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- in-memory supabase fake: select/eq/is/ilike/in/maybeSingle/update/insert/delete, with a write log ----
let db;
let writes;

function makeQuery(table) {
  const q = { filters: [], op: 'select', patch: null };
  const rows = () => {
    let out = (db[table] || []).filter((r) =>
      q.filters.every(([kind, col, val]) => {
        if (kind === 'eq') return r[col] === val;
        if (kind === 'is') return (r[col] ?? null) === val;
        if (kind === 'in') return val.includes(r[col]);
        if (kind === 'ilike') {
          const needle = val.replace(/%/g, '').toLowerCase();
          return String(r[col] ?? '').toLowerCase().includes(needle);
        }
        return true;
      }),
    );
    return out;
  };
  const api = {
    select: () => api,
    eq: (c, v) => (q.filters.push(['eq', c, v]), api),
    is: (c, v) => (q.filters.push(['is', c, v]), api),
    in: (c, v) => (q.filters.push(['in', c, v]), api),
    ilike: (c, v) => (q.filters.push(['ilike', c, v]), api),
    update: (patch) => ((q.op = 'update'), (q.patch = patch), api),
    insert: (row) => ((q.op = 'insert'), (q.patch = row), api),
    delete: () => ((q.op = 'delete'), api),
    maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    // insert(...).select().single(): store the row (with the DB's column defaults) and return it
    single: () => {
      if (q.op !== 'insert') return Promise.resolve({ data: rows()[0] ?? null, error: null });
      const row = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', pricing_type: 'Hourly', hourly_rate: 40, estimated_hours: null, deleted_at: null, ...q.patch };
      (db[table] ||= []).push(row);
      writes.push({ table, op: 'insert', patch: q.patch });
      return Promise.resolve({ data: row, error: null });
    },
    then: (resolve, reject) => {
      let result;
      if (q.op === 'update') {
        writes.push({ table, op: 'update', patch: q.patch });
        rows().forEach((r) => Object.assign(r, q.patch));
        result = { data: null, error: null };
      } else if (q.op === 'insert') {
        writes.push({ table, op: 'insert', patch: q.patch });
        result = { data: null, error: null };
      } else if (q.op === 'delete') {
        writes.push({ table, op: 'delete' });
        result = { data: null, error: null };
      } else {
        result = { data: rows(), error: null };
      }
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return api;
}
const fakeSupabase = { from: (t) => makeQuery(t) };

vi.mock('@supabase/supabase-js', () => ({ createClient: () => fakeSupabase }));

import { getJobDetail, editJob, EDITABLE_ARGS } from './statlerJobs.js';
import handler from '../ai/[action].js';

const BIZ = '11111111-1111-4111-8111-111111111111';
const OTHER_BIZ = '22222222-2222-4222-8222-222222222222';
const JOB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMPLETED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const baseJob = (over = {}) => ({
  id: JOB,
  business_id: BIZ,
  client_id: 'c1',
  template_id: null,
  deleted_at: null,
  service_id: 's-old',
  service_name: 'Decluttering',
  scheduled_date: '2026-10-05',
  scheduled_time: '09:00:00',
  job_status: 'Scheduled',
  payment_status: '',
  pricing_type: 'Hourly',
  flat_rate: 60,
  estimated_hours: 2,
  actual_duration: null,
  additional_costs_json: [],
  additional_cost: 0,
  tax_enabled: null,
  total_amount: 0,
  job_notes: 'Bring boxes',
  notes_resolved_at: null,
  ai_context: { drive_to: { duration: '10 mins' } },
  clients: { first_name: 'Ann', last_name: 'Rae', phone: '416-555-0100', phone2: null, email: 'ann@example.com', street: '1 Main St', city: 'Georgetown', province: 'ON', postal_code: 'L7G 1A1', access_info: 'Key under mat', notes: null },
  ...over,
});

beforeEach(() => {
  writes = [];
  db = {
    jobs: [baseJob(), baseJob({ id: COMPLETED, job_status: 'Completed', actual_duration: 3, total_amount: 180 }), baseJob({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', business_id: OTHER_BIZ })],
    businesses: [{ id: BIZ, hst_rate: 0.13, tax_enabled: false }],
    services: [
      { id: 's1', business_id: BIZ, name: 'Closet Organizing', active: true },
      { id: 's2', business_id: BIZ, name: 'Garage Organizing', active: true },
      { id: 's3', business_id: BIZ, name: 'Errands', active: true },
      { id: 's4', business_id: BIZ, name: 'Old Service', active: false },
    ],
    job_workers: [{ business_id: BIZ, job_id: JOB, worker_id: 'w1', pay: 777 }],
    workers: [{ id: 'w1', business_id: BIZ, name: 'Bridget' }],
  };
});

const jobRow = (id = JOB) => db.jobs.find((j) => j.id === id);

describe('getJobDetail', () => {
  it('returns schedule, money estimate, workers (names only) and client contact', async () => {
    const out = await getJobDetail(fakeSupabase, BIZ, JOB);
    expect(out.status).toBe(200);
    const { job, client } = out.body;
    expect(job).toMatchObject({ date: '2026-10-05', service: 'Decluttering', duration_hours: 2, total: 120, total_is_estimate: true, workers: ['Bridget'] });
    expect(JSON.stringify(out.body)).not.toMatch(/"pay"|777/); // worker pay never exposed
    expect(client).toMatchObject({ name: 'Ann Rae', phone: '(416) 555-0100', email: 'ann@example.com', address: '1 Main St, Georgetown, ON, L7G 1A1', access_info: 'Key under mat' });
  });
  it('rejects a non-uuid id and a job from another business', async () => {
    expect((await getJobDetail(fakeSupabase, BIZ, 'nope')).status).toBe(400);
    expect((await getJobDetail(fakeSupabase, BIZ, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')).status).toBe(404);
  });
});

describe('editJob: what it may change', () => {
  it('moves date + time, clears stale drive estimates, writes only those fields', async () => {
    const out = await editJob(fakeSupabase, BIZ, { job_id: JOB, date: '2026-10-07', time: '2:30 pm' });
    expect(out.status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(writes[0].patch).toEqual({ scheduled_date: '2026-10-07', scheduled_time: '14:30', ai_context: {} });
  });

  it('duration on an hourly job recalculates the money triple via the mirrored math', async () => {
    const out = await editJob(fakeSupabase, BIZ, { job_id: JOB, duration_hours: 3 });
    expect(out.body.result).toMatch(/recalculated/);
    expect(writes[0].patch).toEqual({ estimated_hours: 3, subtotal: 180, hst_amount: 0, total_amount: 180 });
  });

  it('duration on a flat job leaves the price unchanged', async () => {
    jobRow().pricing_type = 'Flat';
    jobRow().flat_rate = 150;
    const out = await editJob(fakeSupabase, BIZ, { job_id: JOB, duration_hours: 4 });
    expect(writes[0].patch).toMatchObject({ estimated_hours: 4, subtotal: 150, total_amount: 150 });
    expect(out.body.result).toMatch(/flat price did not change/);
  });

  it('service name syncs service_id and leaves rate/price alone; inactive services are ignored', async () => {
    const out = await editJob(fakeSupabase, BIZ, { job_id: JOB, service: 'closet' });
    expect(writes[0].patch).toEqual({ service_id: 's1', service_name: 'Closet Organizing' });
    expect(out.body.result).toMatch(/rate and price did not change/);
    writes.length = 0;
    const none = await editJob(fakeSupabase, BIZ, { job_id: JOB, service: 'Old Service' });
    expect(none.body.result).toMatch(/No service matches/);
    expect(writes).toHaveLength(0);
  });

  it('an ambiguous service writes nothing and returns candidates', async () => {
    const out = await editJob(fakeSupabase, BIZ, { job_id: JOB, service: 'organizing' });
    expect(out.body.candidates).toEqual(['Closet Organizing', 'Garage Organizing']);
    expect(writes).toHaveLength(0);
  });

  it('notes are append-only and reopen a resolved note', async () => {
    jobRow().notes_resolved_at = '2026-10-01T10:00:00Z';
    await editJob(fakeSupabase, BIZ, { job_id: JOB, description: 'Client wants side door' });
    expect(writes[0].patch.job_notes).toBe('Bring boxes\n\n[AI Edit]: Client wants side door');
    expect(writes[0].patch.notes_resolved_at).toBeNull();
  });

  it('validates input before any write', async () => {
    for (const args of [{ job_id: 'x' }, { job_id: JOB }, { job_id: JOB, date: '10/07/2026' }, { job_id: JOB, time: 'noonish' }, { job_id: JOB, duration_hours: 40 }, { job_id: JOB, duration_hours: 0 }]) {
      expect((await editJob(fakeSupabase, BIZ, args)).status).toBe(400);
    }
    expect(writes).toHaveLength(0);
  });
});

describe('editJob: NO delete / cancel / money / status writes (Sandra, 2026-10-01)', () => {
  it('ignores every non-allowlisted arg, even smuggled alongside a valid edit', async () => {
    await editJob(fakeSupabase, BIZ, {
      job_id: JOB,
      date: '2026-10-08',
      deleted_at: '2026-10-01T00:00:00Z',
      job_status: 'Cancelled',
      cancellation_reason: 'x',
      flat_rate: 1,
      total_amount: 1,
      subtotal: 1,
      payment_status: 'Paid',
      tax_enabled: false,
      client_id: 'other',
      business_id: OTHER_BIZ,
    });
    expect(writes).toHaveLength(1);
    const keys = Object.keys(writes[0].patch);
    for (const bad of ['deleted_at', 'job_status', 'cancellation_reason', 'flat_rate', 'total_amount', 'subtotal', 'payment_status', 'tax_enabled', 'client_id', 'business_id']) {
      expect(keys).not.toContain(bad);
    }
    expect(writes[0].patch.scheduled_date).toBe('2026-10-08');
  });

  it('a payload of only forbidden fields is a 400 with no write', async () => {
    const out = await editJob(fakeSupabase, BIZ, { job_id: JOB, deleted_at: 'now', job_status: 'Cancelled', total_amount: 5 });
    expect(out.status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it('refuses to touch a job that is not Scheduled (completed money/invoices are final)', async () => {
    const out = await editJob(fakeSupabase, BIZ, { job_id: COMPLETED, date: '2026-10-09', duration_hours: 1 });
    expect(out.status).toBe(200);
    expect(out.body.result).toMatch(/can't be changed by phone/);
    expect(writes).toHaveLength(0);
  });

  it('cannot reach another business\'s job', async () => {
    const out = await editJob(fakeSupabase, BIZ, { job_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', date: '2026-10-09' });
    expect(out.status).toBe(404);
    expect(writes).toHaveLength(0);
  });

  it('the edit allowlist never contains a destructive or money field', () => {
    expect(EDITABLE_ARGS.sort()).toEqual(['date', 'description', 'duration_hours', 'job_id', 'service', 'time']);
  });
});

describe('statler-tool router: no delete path exists', () => {
  process.env.VITE_SUPABASE_URL = 'http://x';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  process.env.STATLER_SECRET = 's3cret';

  const call = async (body, auth = 'Bearer s3cret') => {
    const out = {};
    const res = { status: (c) => ((out.code = c), res), json: (b) => ((out.body = b), res) };
    await handler({ method: 'POST', query: { action: 'statler-tool' }, headers: { authorization: auth }, body }, res);
    return out;
  };

  it.each(['supermom_delete_job', 'supermom_cancel_job', 'supermom_remove_job', 'supermom_update_job', 'delete_job'])(
    '%s falls through to 400 and writes nothing',
    async (action) => {
      const out = await call({ action, args: { job_id: JOB }, businessId: BIZ });
      expect(out.code).toBe(400);
      expect(writes).toHaveLength(0);
    },
  );

  it('no statler action issues a delete or a deleted_at/status write', async () => {
    await call({ action: 'supermom_edit_schedule', args: { job_id: JOB, date: '2026-10-08', deleted_at: 'now', job_status: 'Cancelled' }, businessId: BIZ });
    expect(writes.some((w) => w.op === 'delete')).toBe(false);
    for (const w of writes.filter((w) => w.table === 'jobs')) {
      expect(w.patch).not.toHaveProperty('deleted_at');
      expect(w.patch).not.toHaveProperty('job_status');
    }
  });

  it('get_job and edit are rejected without the bearer secret', async () => {
    expect((await call({ action: 'supermom_get_job', args: { job_id: JOB }, businessId: BIZ }, 'Bearer wrong')).code).toBe(401);
    expect((await call({ action: 'supermom_edit_schedule', args: { job_id: JOB, date: '2026-10-08' }, businessId: BIZ }, '')).code).toBe(401);
    expect(writes).toHaveLength(0);
  });
});

describe('supermom_schedule_job saves service and duration and reports what saved', () => {
  process.env.VITE_SUPABASE_URL = 'http://x';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  process.env.STATLER_SECRET = 's3cret';
  const NEW_JOB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const book = async (args) => {
    db.clients = [{ id: 'c9', business_id: BIZ, first_name: 'Oscar', last_name: 'Grouch' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({}));
    const out = {};
    const res = { status: (c) => ((out.code = c), res), json: (b) => ((out.body = b), res) };
    await handler(
      { method: 'POST', query: { action: 'statler-tool' }, headers: { authorization: 'Bearer s3cret', host: 'x' },
        body: { action: 'supermom_schedule_job', args: { clientName: 'Oscar Grouch', date: '2026-10-04', time: '9:00 am', ...args }, businessId: BIZ } },
      res,
    );
    return out;
  };

  it('applies a matching service and the duration, and says so', async () => {
    const out = await book({ service: 'closet organizing', duration_hours: 1 });
    expect(out.code).toBe(200);
    const job = jobRow(NEW_JOB);
    expect(job.service_name).toBe('Closet Organizing');
    expect(job.service_id).toBe('s1');
    expect(job.estimated_hours).toBe(1);
    expect(out.body.result).toMatch(/time 09:00/);
    expect(out.body.result).toMatch(/service Closet Organizing, duration 1 hours/);
    expect(out.body.result).not.toMatch(/NOT applied/);
  });

  it('an unknown service is reported, the duration still applies', async () => {
    const out = await book({ service: 'assist', duration_hours: 1 });
    expect(out.code).toBe(200);
    expect(jobRow(NEW_JOB).estimated_hours).toBe(1);
    expect(out.body.result).toMatch(/service Cleaning \(default, not set by phone\)/);
    expect(out.body.result).toMatch(/NOT applied: .*No service matches "assist"/);
    expect(out.body.result).toMatch(/duration 1 hours/);
  });

  it('with no service or duration it says the defaults were used', async () => {
    const out = await book({});
    expect(out.body.result).toMatch(/service Cleaning \(default, not set by phone\), no duration set/);
  });
});
