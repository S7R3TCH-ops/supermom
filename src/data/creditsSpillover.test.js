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
      if (q.order && q.order.col) {
        const { col, ascending } = q.order;
        matching.sort((a, b) => {
          const valA = a[col];
          const valB = b[col];
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return ascending ? 1 : -1;
          if (valB === undefined || valB === null) return ascending ? -1 : 1;
          if (valA < valB) return ascending ? -1 : 1;
          return ascending ? 1 : -1;
        });
      }
      if (typeof q.limit === 'number') {
        matching = matching.slice(0, q.limit);
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
      order: (col, opts) => {
        if (col) {
          q.order = { col, ascending: opts?.ascending ?? true };
        }
        return b;
      },
      limit: n => {
        q.limit = n;
        return b;
      },
      then: (resolve, reject) => exec().then(resolve, reject),
    };
    return b;
  };
  return { supabase: { from } };
});

vi.mock('./currentBusiness', () => ({
  getCurrentBusinessId: vi.fn(async () => 'biz-1'),
}));

const { applyCreditToJobs, moveCreditBackFromJob, getJobIssuedCredit, getClientCreditBalance } = await import('./creditsRepo');
const { revertJobToPreCompletion } = await import('./jobsRepo');

beforeEach(() => {
  db = {
    jobs: [],
    payments: [],
    client_credits: [],
    invoice_jobs: [],
    invoices: [],
    clients: [],
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

  it('skips job 1 if already fully paid (owing <= 0) and applies remaining to job 2', async () => {
    db.client_credits.push({
      id: 'cc-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      amount: 100,
      kind: 'issued',
    });
    // job-1 is already fully paid ($60 total, $60 paid)
    db.jobs.push(
      { id: 'job-1', business_id: 'biz-1', client_id: 'client-1', pricing_type: 'Flat', flat_rate: 60, payment_status: 'Paid' },
      { id: 'job-2', business_id: 'biz-1', client_id: 'client-1', pricing_type: 'Flat', flat_rate: 80, payment_status: '' }
    );
    db.payments.push({
      id: 'pay-existing-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      job_id: 'job-1',
      amount: 60,
      payment_method: 'Cash',
      is_void: false,
    });

    const allocations = [
      { jobId: 'job-1', amount: 30 },
      { jobId: 'job-2', amount: 40 },
    ];

    const res = await applyCreditToJobs('biz-1', 'client-1', allocations);

    // job-1 was skipped (owing <= 0), only job-2 received payment
    expect(res.payments).toHaveLength(1);
    expect(res.ledgers).toHaveLength(1);
    expect(res.applied).toHaveLength(1);
    expect(res.applied[0].jobId).toBe('job-2');
    expect(res.applied[0].amount).toBe(40);
    expect(res.totalApplied).toBe(40);

    // Verify payments in DB: job-1 still only has its original cash payment
    const j1Payments = db.payments.filter(p => p.job_id === 'job-1' && !p.is_void);
    expect(j1Payments).toHaveLength(1);
    expect(j1Payments[0].payment_method).toBe('Cash');

    // job-2 has credit payment
    const j2Payments = db.payments.filter(p => p.job_id === 'job-2' && !p.is_void);
    expect(j2Payments).toHaveLength(1);
    expect(j2Payments[0].payment_method).toBe('Credit');
    expect(j2Payments[0].amount).toBe(40);

    // Verify client_credits in DB: only applied for job-2
    const appliedRows = db.client_credits.filter(c => c.kind === 'applied');
    expect(appliedRows).toHaveLength(1);
    expect(appliedRows[0].job_id).toBe('job-2');
    expect(appliedRows[0].amount).toBe(-40);

    // Verify status
    expect(db.jobs.find(j => j.id === 'job-1').payment_status).toBe('Paid');
    expect(db.jobs.find(j => j.id === 'job-2').payment_status).toBe('Partial');
  });

  it('clamps credit allocation to job current owing', async () => {
    db.client_credits.push({
      id: 'cc-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      amount: 100,
      kind: 'issued',
    });
    db.jobs.push(
      { id: 'job-1', business_id: 'biz-1', client_id: 'client-1', pricing_type: 'Flat', flat_rate: 50, payment_status: '' }
    );
    db.payments.push({
      id: 'pay-part',
      business_id: 'biz-1',
      client_id: 'client-1',
      job_id: 'job-1',
      amount: 30,
      payment_method: 'Cash',
      is_void: false,
    });

    // Allocates 40, but owing is only 20
    const allocations = [{ jobId: 'job-1', amount: 40 }];
    const res = await applyCreditToJobs('biz-1', 'client-1', allocations);

    expect(res.totalApplied).toBe(20);
    expect(res.applied[0].amount).toBe(20);
    expect(db.jobs.find(j => j.id === 'job-1').payment_status).toBe('Paid');
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

describe('revertJobToPreCompletion', () => {
  it('voids payments for the job (update is_void: true, does not delete)', async () => {
    db.jobs.push({
      id: 'job-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      job_status: 'Completed',
      payment_status: 'Paid',
    });
    db.payments.push({
      id: 'pay-1',
      business_id: 'biz-1',
      job_id: 'job-1',
      client_id: 'client-1',
      amount: 150,
      payment_method: 'E-Transfer',
      is_void: false,
    });

    await revertJobToPreCompletion('job-1');

    // Payments must NOT be hard-deleted, but marked is_void: true
    expect(db.payments).toHaveLength(1);
    expect(db.payments[0].id).toBe('pay-1');
    expect(db.payments[0].is_void).toBe(true);

    // Job reverted to Scheduled with empty payment status
    const j1 = db.jobs.find(j => j.id === 'job-1');
    expect(j1.job_status).toBe('Scheduled');
    expect(j1.payment_status).toBe('');
  });

  it('deletes all client_credits ledger rows where job_id = id (issued, applied, reclassified_to_tip)', async () => {
    db.jobs.push({
      id: 'job-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      job_status: 'Completed',
    });
    db.client_credits.push(
      { id: 'cc-1', business_id: 'biz-1', client_id: 'client-1', job_id: 'job-1', amount: 50, kind: 'issued' },
      { id: 'cc-2', business_id: 'biz-1', client_id: 'client-1', job_id: 'job-1', amount: -20, kind: 'applied' },
      { id: 'cc-3', business_id: 'biz-1', client_id: 'client-1', job_id: 'job-1', amount: -30, kind: 'reclassified_to_tip' }
    );

    await revertJobToPreCompletion('job-1');

    // All ledger rows for job-1 must be deleted
    const remainingJob1Credits = db.client_credits.filter(c => c.job_id === 'job-1');
    expect(remainingJob1Credits).toHaveLength(0);
  });

  it("does not touch other jobs' ledger rows or payments", async () => {
    db.jobs.push(
      { id: 'job-1', business_id: 'biz-1', client_id: 'client-1', job_status: 'Completed' },
      { id: 'job-2', business_id: 'biz-1', client_id: 'client-1', job_status: 'Completed' }
    );
    db.payments.push(
      { id: 'pay-1', business_id: 'biz-1', job_id: 'job-1', amount: 100, is_void: false },
      { id: 'pay-2', business_id: 'biz-1', job_id: 'job-2', amount: 80, is_void: false }
    );
    db.client_credits.push(
      { id: 'cc-1', business_id: 'biz-1', client_id: 'client-1', job_id: 'job-1', amount: 20, kind: 'issued' },
      { id: 'cc-2', business_id: 'biz-1', client_id: 'client-1', job_id: 'job-2', amount: 30, kind: 'issued' },
      { id: 'cc-3', business_id: 'biz-1', client_id: 'client-1', job_id: 'job-2', amount: -15, kind: 'applied' }
    );

    await revertJobToPreCompletion('job-1');

    // job-1 payment is voided, job-2 payment is untouched
    const p1 = db.payments.find(p => p.id === 'pay-1');
    const p2 = db.payments.find(p => p.id === 'pay-2');
    expect(p1.is_void).toBe(true);
    expect(p2.is_void).toBe(false);

    // job-1 ledger deleted, job-2 ledgers untouched
    expect(db.client_credits.filter(c => c.job_id === 'job-1')).toHaveLength(0);
    const j2Credits = db.client_credits.filter(c => c.job_id === 'job-2');
    expect(j2Credits).toHaveLength(2);
    expect(j2Credits.map(c => c.id)).toEqual(['cc-2', 'cc-3']);
  });

  it('revert then re-complete: getJobIssuedCredit(businessId, jobId) returns null after revert', async () => {
    db.jobs.push({
      id: 'job-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      job_status: 'Completed',
    });
    db.payments.push({
      id: 'pay-1',
      business_id: 'biz-1',
      job_id: 'job-1',
      client_id: 'client-1',
      amount: 150,
      is_void: false,
    });
    db.client_credits.push({
      id: 'cc-1',
      business_id: 'biz-1',
      client_id: 'client-1',
      job_id: 'job-1',
      amount: 50,
      kind: 'issued',
    });

    // Before revert: issued credit exists
    const beforeCredit = await getJobIssuedCredit('biz-1', 'job-1');
    expect(beforeCredit).not.toBeNull();
    expect(beforeCredit.amount).toBe(50);

    // Revert job
    await revertJobToPreCompletion('job-1');

    // After revert: getJobIssuedCredit returns null so re-complete can re-issue credit
    const afterCredit = await getJobIssuedCredit('biz-1', 'job-1');
    expect(afterCredit).toBeNull();
  });

  it('unwinds spent credit when revert leaves deficit: A issued $50, B applied $50 -> voids B Credit payment, deletes B applied row, re-derives B status, returns unwoundJobIds: [job-B], balance is 0', async () => {
    db.jobs.push(
      {
        id: 'job-A',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_status: 'Completed',
        pricing_type: 'Flat',
        flat_rate: 100,
        payment_status: 'Paid',
      },
      {
        id: 'job-B',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_status: 'Completed',
        pricing_type: 'Flat',
        flat_rate: 50,
        payment_status: 'Paid',
      }
    );
    // Job A had payment $150 (overpaid $50)
    db.payments.push(
      {
        id: 'pay-A',
        business_id: 'biz-1',
        job_id: 'job-A',
        client_id: 'client-1',
        amount: 150,
        payment_method: 'E-Transfer',
        is_void: false,
      },
      // Job B had $50 Credit payment
      {
        id: 'pay-B',
        business_id: 'biz-1',
        job_id: 'job-B',
        client_id: 'client-1',
        amount: 50,
        payment_method: 'Credit',
        is_void: false,
      }
    );
    db.client_credits.push(
      {
        id: 'cc-A',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_id: 'job-A',
        amount: 50,
        kind: 'issued',
        created_at: '2026-09-20T10:00:00.000Z',
      },
      {
        id: 'cc-B',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_id: 'job-B',
        amount: -50,
        kind: 'applied',
        created_at: '2026-09-21T10:00:00.000Z',
      }
    );

    const res = await revertJobToPreCompletion('job-A');

    expect(res).toEqual({ unwoundJobIds: ['job-B'] });

    // Job B's Credit payment should be voided
    const payB = db.payments.find(p => p.id === 'pay-B');
    expect(payB.is_void).toBe(true);

    // Job B's applied ledger row should be deleted
    const remainingCredits = db.client_credits.filter(c => c.client_id === 'client-1');
    expect(remainingCredits).toHaveLength(0);

    // Job B's status should be re-derived to '' (unpaid)
    const jobB = db.jobs.find(j => j.id === 'job-B');
    expect(jobB.payment_status).toBe('');

    // Final balance is 0
    const finalBalance = await getClientCreditBalance('biz-1', 'client-1');
    expect(finalBalance).toBe(0);
  });

  it('does not unwind credit when balance >= 0 after ledger delete (credit not spent)', async () => {
    db.jobs.push(
      {
        id: 'job-A',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_status: 'Completed',
        pricing_type: 'Flat',
        flat_rate: 100,
        payment_status: 'Paid',
      },
      {
        id: 'job-B',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_status: 'Completed',
        pricing_type: 'Flat',
        flat_rate: 50,
        payment_status: 'Paid',
      }
    );
    db.payments.push(
      {
        id: 'pay-A',
        business_id: 'biz-1',
        job_id: 'job-A',
        client_id: 'client-1',
        amount: 150,
        payment_method: 'E-Transfer',
        is_void: false,
      },
      {
        id: 'pay-B',
        business_id: 'biz-1',
        job_id: 'job-B',
        client_id: 'client-1',
        amount: 30,
        payment_method: 'Credit',
        is_void: false,
      }
    );
    // Prior credit of 100 existed before A, B applied 30, A issued 50. Total balance before revert: 100 + 50 - 30 = 120.
    // After A's 50 is deleted, balance is 70 >= 0, so no unwinding occurs.
    db.client_credits.push(
      {
        id: 'cc-prior',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_id: null,
        amount: 100,
        kind: 'issued',
        created_at: '2026-09-10T10:00:00.000Z',
      },
      {
        id: 'cc-A',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_id: 'job-A',
        amount: 50,
        kind: 'issued',
        created_at: '2026-09-20T10:00:00.000Z',
      },
      {
        id: 'cc-B',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_id: 'job-B',
        amount: -30,
        kind: 'applied',
        created_at: '2026-09-21T10:00:00.000Z',
      }
    );

    const res = await revertJobToPreCompletion('job-A');

    expect(res).toEqual({ unwoundJobIds: [] });

    // Job B's Credit payment remains active
    const payB = db.payments.find(p => p.id === 'pay-B');
    expect(payB.is_void).toBe(false);

    // Job B's applied ledger row remains
    const bApplied = db.client_credits.find(c => c.id === 'cc-B');
    expect(bApplied).toBeDefined();

    // Final balance is 100 - 30 = 70
    const finalBalance = await getClientCreditBalance('biz-1', 'client-1');
    expect(finalBalance).toBe(70);
  });

  it('unwinds newest-first across multiple applied jobs: $30 older on B, $40 newer on C, deficit -$50 -> unwinds C first then B, final balance +$20', async () => {
    db.jobs.push(
      {
        id: 'job-A',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_status: 'Completed',
        pricing_type: 'Flat',
        flat_rate: 100,
        payment_status: 'Paid',
      },
      {
        id: 'job-B',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_status: 'Completed',
        pricing_type: 'Flat',
        flat_rate: 30,
        payment_status: 'Paid',
      },
      {
        id: 'job-C',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_status: 'Completed',
        pricing_type: 'Flat',
        flat_rate: 40,
        payment_status: 'Paid',
      }
    );
    db.payments.push(
      {
        id: 'pay-A',
        business_id: 'biz-1',
        job_id: 'job-A',
        client_id: 'client-1',
        amount: 150,
        payment_method: 'Cash',
        is_void: false,
      },
      {
        id: 'pay-B',
        business_id: 'biz-1',
        job_id: 'job-B',
        client_id: 'client-1',
        amount: 30,
        payment_method: 'Credit',
        is_void: false,
      },
      {
        id: 'pay-C',
        business_id: 'biz-1',
        job_id: 'job-C',
        client_id: 'client-1',
        amount: 40,
        payment_method: 'Credit',
        is_void: false,
      }
    );
    // Client had $20 baseline credit + $50 issued by A = $70 credit total.
    // Job B applied $30 (older), Job C applied $40 (newer).
    // Balance before revert: 20 + 50 - 30 - 40 = 0.
    // Reverting A removes $50 issued row -> balance is 20 - 30 - 40 = -$50 deficit.
    db.client_credits.push(
      {
        id: 'cc-base',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_id: null,
        amount: 20,
        kind: 'issued',
        created_at: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 'cc-A',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_id: 'job-A',
        amount: 50,
        kind: 'issued',
        created_at: '2026-09-10T10:00:00.000Z',
      },
      {
        id: 'cc-B',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_id: 'job-B',
        amount: -30,
        kind: 'applied',
        created_at: '2026-09-15T10:00:00.000Z',
      },
      {
        id: 'cc-C',
        business_id: 'biz-1',
        client_id: 'client-1',
        job_id: 'job-C',
        amount: -40,
        kind: 'applied',
        created_at: '2026-09-20T10:00:00.000Z',
      }
    );

    const res = await revertJobToPreCompletion('job-A');

    // Job C ($40, newer) unwound first, deficit was -$10, then Job B ($30, older) unwound
    expect(res).toEqual({ unwoundJobIds: ['job-C', 'job-B'] });

    // Both Credit payments voided
    expect(db.payments.find(p => p.id === 'pay-C').is_void).toBe(true);
    expect(db.payments.find(p => p.id === 'pay-B').is_void).toBe(true);

    // Both applied rows deleted; cc-base remains
    const remainingCredits = db.client_credits.filter(c => c.client_id === 'client-1');
    expect(remainingCredits.map(c => c.id)).toEqual(['cc-base']);

    // Final balance is +$20
    const finalBalance = await getClientCreditBalance('biz-1', 'client-1');
    expect(finalBalance).toBe(20);
  });
});

