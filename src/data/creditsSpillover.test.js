import { describe, it, expect, vi, beforeEach } from 'vitest';

let db;
let calls;

vi.mock('../lib/supabase', () => {
  const from = table => {
    const q = { table, op: 'select', filters: [], isSingle: false, patch: null, rows: null };
    const exec = () => {
      calls.push({ ...q, filters: [...q.filters] });
      const tbl = db[table] || [];

      if (q.op === 'insert') {
        const toInsert = Array.isArray(q.rows) ? q.rows : [q.rows];
        const inserted = toInsert.map((r, idx) => ({
          id: `${table}-${Date.now()}-${idx}-${Math.random()}`,
          ...(table === 'payments' ? { is_void: false } : {}),
          ...r,
        }));
        db[table].push(...inserted);
        return Promise.resolve({
          data: q.isSingle ? inserted[0] : inserted,
          error: null,
        });
      }

      if (q.op === 'update') {
        let matching = tbl;
        for (const [col, val] of q.filters) {
          if (Array.isArray(val)) {
            matching = matching.filter(row => val.includes(row[col]));
          } else {
            matching = matching.filter(row => row[col] === val);
          }
        }
        for (const row of matching) {
          Object.assign(row, q.patch);
        }
        return Promise.resolve({ data: matching, error: null });
      }

      if (q.op === 'delete') {
        let matching = [...tbl];
        for (const [col, val] of q.filters) {
          if (Array.isArray(val)) {
            matching = matching.filter(row => val.includes(row[col]));
          } else {
            matching = matching.filter(row => row[col] === val);
          }
        }
        db[table] = tbl.filter(row => !matching.includes(row));
        return Promise.resolve({ data: matching, error: null });
      }

      // op === 'select'
      let matching = [...tbl];
      for (const [col, val] of q.filters) {
        if (Array.isArray(val)) {
          matching = matching.filter(row => val.includes(row[col]));
        } else {
          matching = matching.filter(row => row[col] === val);
        }
      }
      return Promise.resolve({
        data: q.isSingle ? (matching[0] ?? null) : matching,
        error: null,
      });
    };

    const b = {
      select: () => b,
      single: () => { q.isSingle = true; return exec(); },
      maybeSingle: () => { q.isSingle = true; return exec(); },
      insert: rows => { q.op = 'insert'; q.rows = rows; return b; },
      update: patch => { q.op = 'update'; q.patch = patch; return b; },
      delete: () => { q.op = 'delete'; return b; },
      in: (col, vals) => { q.filters.push([col, vals]); return b; },
      eq: (col, val) => {
        q.filters.push([col, val]);
        return b;
      },
      then: (resolve, reject) => exec().then(resolve, reject),
    };
    return b;
  };
  return { supabase: { from } };
});

const { applyCreditToJobs, moveCreditBackFromJob } = await import('./creditsRepo');

beforeEach(() => {
  db = {
    jobs: [],
    payments: [],
    client_credits: [],
  };
  calls = [];
});

describe('applyCreditToJobs', () => {
  it('applies credit to 2 jobs: creates Credit payment rows, applied ledger rows, sets Partial status', async () => {
    db.client_credits.push({
      id: 'cc-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      amount: 100,
      kind: 'issued',
    });
    db.jobs.push(
      { id: 'job-1', business_id: 'biz-1', client_id: 'client-1', pricing_type: 'Flat', flat_rate: 60, payment_status: '' },
      { id: 'job-2', business_id: 'biz-1', client_id: 'client-1', pricing_type: 'Flat', flat_rate: 80, payment_status: '' }
    );

    const allocations = [
      { jobId: 'job-1', amount: 30 },
      { jobId: 'job-2', amount: 20 },
    ];

    const res = await applyCreditToJobs('biz-1', 'client-1', allocations);

    expect(res.payments).toHaveLength(2);
    expect(res.ledgers).toHaveLength(2);

    // Verify payments in DB
    const creditPayments = db.payments.filter(p => p.payment_method === 'Credit' && !p.is_void);
    expect(creditPayments).toHaveLength(2);
    expect(creditPayments.map(p => ({ jobId: p.job_id, amount: p.amount, method: p.payment_method }))).toEqual([
      { jobId: 'job-1', amount: 30, method: 'Credit' },
      { jobId: 'job-2', amount: 20, method: 'Credit' },
    ]);

    // Verify client_credits ledger rows in DB
    const appliedRows = db.client_credits.filter(c => c.kind === 'applied');
    expect(appliedRows).toHaveLength(2);
    expect(appliedRows.map(c => ({ jobId: c.job_id, amount: c.amount, kind: c.kind }))).toEqual([
      { jobId: 'job-1', amount: -30, kind: 'applied' },
      { jobId: 'job-2', amount: -20, kind: 'applied' },
    ]);

    // Verify jobs statuses re-derived
    const j1 = db.jobs.find(j => j.id === 'job-1');
    const j2 = db.jobs.find(j => j.id === 'job-2');
    expect(j1.payment_status).toBe('Partial');
    expect(j2.payment_status).toBe('Partial');
  });

  it('allocation > balance throws and writes nothing', async () => {
    db.client_credits.push({
      id: 'cc-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      amount: 40,
      kind: 'issued',
    });
    db.jobs.push({
      id: 'job-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      pricing_type: 'Flat',
      flat_rate: 100,
      payment_status: '',
    });

    const allocations = [{ jobId: 'job-1', amount: 50 }];

    await expect(applyCreditToJobs('biz-1', 'client-1', allocations)).rejects.toThrow(
      'Allocated amount exceeds available credit'
    );

    // Check nothing was written
    expect(db.payments).toHaveLength(0);
    expect(db.client_credits.filter(c => c.kind === 'applied')).toHaveLength(0);
    expect(db.jobs.find(j => j.id === 'job-1').payment_status).toBe('');
  });
});

describe('moveCreditBackFromJob', () => {
  it('voids payments (is_void: true, never deletes), deletes applied ledger rows, and re-derives status', async () => {
    db.jobs.push({
      id: 'job-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      pricing_type: 'Flat',
      flat_rate: 60,
      payment_status: 'Partial',
    });
    db.payments.push({
      id: 'pay-credit-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      job_id: 'job-1',
      amount: 30,
      payment_method: 'Credit',
      is_void: false,
    });
    db.client_credits.push({
      id: 'cc-applied-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      job_id: 'job-1',
      amount: -30,
      kind: 'applied',
    });

    const res = await moveCreditBackFromJob('biz-1', 'client-1', 'job-1');

    expect(res).toEqual({ voidedPayments: 1, deletedLedgerRows: 1 });

    // Payment must NOT be deleted, only voided
    expect(db.payments).toHaveLength(1);
    expect(db.payments[0].is_void).toBe(true);

    // Applied ledger row MUST be deleted
    expect(db.client_credits.filter(c => c.id === 'cc-applied-1')).toHaveLength(0);

    // Job payment status must be re-derived to '' (0 non-void payments remaining)
    const j1 = db.jobs.find(j => j.id === 'job-1');
    expect(j1.payment_status).toBe('');
  });

  it('no-op if job has no credit applied', async () => {
    db.jobs.push({
      id: 'job-2',
      business_id: 'biz-1',
      client_id: 'client-1',
      pricing_type: 'Flat',
      flat_rate: 50,
      payment_status: 'Paid',
    });
    db.payments.push({
      id: 'pay-cash-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      job_id: 'job-2',
      amount: 50,
      payment_method: 'Cash',
      is_void: false,
    });

    const res = await moveCreditBackFromJob('biz-1', 'client-1', 'job-2');
    expect(res).toEqual({ voidedPayments: 0, deletedLedgerRows: 0 });

    // Payment not touched
    expect(db.payments[0].is_void).toBe(false);
    expect(db.jobs.find(j => j.id === 'job-2').payment_status).toBe('Paid');
  });
});
