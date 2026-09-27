import { describe, it, expect, vi, beforeEach } from 'vitest';

// Records every write settleInvoiceOutstanding makes; invoice_jobs reads come
// from `links`. fetchInvoiceById goes through global fetch → `invoiceJson`.
let calls, links, failOn, invoiceJson;

vi.mock('../lib/supabase', () => {
  const from = table => {
    const q = { table, op: 'select', filters: [] };
    const exec = () => {
      if (failOn && failOn(q)) return Promise.resolve({ data: null, error: new Error(`boom ${table}`) });
      calls.push(q);
      if (table === 'invoice_jobs' && q.op === 'select') {
        const ids = q.filters.find(f => f[0] === 'job_id')?.[1] ?? [];
        return Promise.resolve({ data: links.filter(l => ids.includes(l.job_id)), error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };
    const b = {
      select: () => b,
      insert: rows => { q.op = 'insert'; q.rows = rows; return exec(); },
      update: patch => { q.op = 'update'; q.patch = patch; return b; },
      in: (col, vals) => { q.filters.push([col, vals]); return b; },
      eq: (col, val) => {
        q.filters.push([col, val]);
        return col === 'business_id' ? Object.assign(exec(), b) : b;
      },
    };
    return b;
  };
  return { supabase: { from }, authHeaders: async () => ({}) };
});
vi.mock('./currentBusiness', () => ({ getCurrentBusinessId: async () => 'biz-1' }));

const { settleInvoiceOutstanding } = await import('./invoicesRepo');

const bal = (id, owing, date, paid = 0) => ({ job: { id, scheduled_date: date }, owing, paid, total: owing + paid });
const writes = (table, op) => calls.filter(c => c.table === table && c.op === op);
const idsOf = c => c.filters.find(f => f[0] === 'id')?.[1];

beforeEach(() => {
  calls = []; links = []; failOn = null;
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => invoiceJson }));
});

describe('settleInvoiceOutstanding', () => {
  it('partial payment: one bulk insert, oldest job Paid, next Partial, invoice not flipped', async () => {
    invoiceJson = { id: 'inv-A', client_id: 'c1', invoiceJobBalances: [bal('j2', 100, '2026-09-10'), bal('j1', 80, '2026-09-01')], otherOutstanding: [] };
    const res = await settleInvoiceOutstanding('inv-A', 'Cash', ['j1', 'j2'], 120);

    const inserts = writes('payments', 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].rows.map(r => [r.job_id, r.amount, r.invoice_id])).toEqual([['j1', 80, 'inv-A'], ['j2', 40, 'inv-A']]);

    const jobUpdates = writes('jobs', 'update');
    expect(jobUpdates.map(u => [u.patch.payment_status, idsOf(u)])).toEqual([['Paid', ['j1']], ['Partial', ['j2']]]);
    expect(writes('invoices', 'update')).toHaveLength(0);
    expect(res).toEqual({ settled: 1, partial: 1, amount: 120 });
  });

  it('full payment flips the current invoice to Paid and never writes money columns', async () => {
    invoiceJson = { id: 'inv-A', client_id: 'c1', invoiceJobBalances: [bal('j1', 80, '1', 20), bal('done', 0, '0', 50)], otherOutstanding: [] };
    await settleInvoiceOutstanding('inv-A', 'e-Transfer', null);
    const inv = writes('invoices', 'update');
    expect(inv).toHaveLength(1);
    expect([inv[0].patch, idsOf(inv[0])]).toEqual([{ status: 'Paid' }, ['inv-A']]);
    for (const u of writes('jobs', 'update')) {
      expect(Object.keys(u.patch).sort()).toEqual(['payment_method', 'payment_status']);
    }
  });

  it('bundle: another invoice flips only when all of its owing jobs are paid', async () => {
    invoiceJson = {
      id: 'inv-A', client_id: 'c1',
      invoiceJobBalances: [bal('a1', 0, '1', 50)],
      otherOutstanding: [bal('x', 30, '2'), bal('y', 40, '3'), bal('z', 10, '4')],
    };
    links = [{ job_id: 'x', invoice_id: 'inv-B' }, { job_id: 'y', invoice_id: 'inv-B' }, { job_id: 'z', invoice_id: 'inv-C' }];

    await settleInvoiceOutstanding('inv-A', 'Cash', ['x', 'z']); // B still has y owing
    expect(writes('invoices', 'update').flatMap(idsOf).sort()).toEqual(['inv-A', 'inv-C']);

    calls = [];
    await settleInvoiceOutstanding('inv-A', 'Cash', ['x', 'y']);
    expect(writes('invoices', 'update').flatMap(idsOf)).toContain('inv-B');
  });

  it('rejects overpayment before writing anything', async () => {
    invoiceJson = { id: 'inv-A', client_id: 'c1', invoiceJobBalances: [bal('j1', 50, '1')], otherOutstanding: [] };
    await expect(settleInvoiceOutstanding('inv-A', 'Cash', null, 60)).rejects.toThrow(/more than/);
    expect(calls).toHaveLength(0);
  });

  it('status write failure after payments saved → paymentRecorded error (no blind retry)', async () => {
    invoiceJson = { id: 'inv-A', client_id: 'c1', invoiceJobBalances: [bal('j1', 50, '1')], otherOutstanding: [] };
    failOn = q => q.table === 'jobs' && q.op === 'update';
    const err = await settleInvoiceOutstanding('inv-A', 'Cash', null, 20).catch(e => e);
    expect(err.paymentRecorded).toBe(true);
    expect(writes('payments', 'insert')).toHaveLength(1);
  });

  it('payment insert failure → plain error, safe to retry', async () => {
    invoiceJson = { id: 'inv-A', client_id: 'c1', invoiceJobBalances: [bal('j1', 50, '1')], otherOutstanding: [] };
    failOn = q => q.table === 'payments';
    const err = await settleInvoiceOutstanding('inv-A', 'Cash', null).catch(e => e);
    expect(err.paymentRecorded).toBeUndefined();
    expect(writes('jobs', 'update')).toHaveLength(0);
  });
});
