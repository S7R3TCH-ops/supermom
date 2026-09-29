import { describe, it, expect } from 'vitest';
import { decorateInvoiceWithBalances, jobPaymentBadge, getJobPaymentBadge, describeJobCalc } from './invoiceBalances';

// Stub of the two queries decorateInvoiceWithBalances makes: the client's
// completed jobs and their non-void payments. The stub ignores filters (the
// real filtering is SQL) — pass in exactly the rows the query would return.
function stubSupabase({ jobs = [], payments = [] }) {
  const resolveWith = rows => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      is: () => builder,
      order: () => builder,
      then: (onOk, onErr) => Promise.resolve({ data: rows, error: null }).then(onOk, onErr),
    };
    return builder;
  };
  return { from: table => resolveWith(table === 'jobs' ? jobs : payments) };
}

const BIZ = { id: 'biz-1', hst_rate: 0.13, tax_enabled: false };

// Completed flat-rate job helper — total = flat_rate (business tax off, no override)
const job = (id, flat, extra = {}) => ({
  id, client_id: 'c1', business_id: 'biz-1', job_status: 'Completed',
  pricing_type: 'Flat', flat_rate: flat, tax_enabled: null, deleted_at: null,
  ...extra,
});

const invoiceFor = (jobIds, extra = {}) => ({
  id: 'inv-1', business_id: 'biz-1', client_id: 'c1',
  businesses: BIZ,
  invoice_jobs: jobIds.map(job_id => ({ job_id })),
  ...extra,
});

describe('decorateInvoiceWithBalances', () => {
  it('returns empty decoration when the invoice has no linked jobs', async () => {
    const inv = await decorateInvoiceWithBalances(stubSupabase({}), invoiceFor([]));
    expect(inv.amountPaid).toBe(0);
    expect(inv.balanceOwing).toBe(0);
    expect(inv.isPaidInFull).toBe(false);
    expect(inv.invoiceJobBalances).toEqual([]);
    expect(inv.otherOutstanding).toEqual([]);
  });

  it('computes paid/owing for a single unpaid job', async () => {
    const sb = stubSupabase({ jobs: [job('j1', 150)], payments: [] });
    const inv = await decorateInvoiceWithBalances(sb, invoiceFor(['j1']));
    expect(inv.amountPaid).toBe(0);
    expect(inv.balanceOwing).toBe(150);
    expect(inv.isPaidInFull).toBe(false);
  });

  it('marks paid-in-full when payments cover the job total (within 1 cent)', async () => {
    const sb = stubSupabase({
      jobs: [job('j1', 150)],
      payments: [{ id: 'p1', job_id: 'j1', amount: 149.995, payment_date: '2026-06-01', invoice_id: null }],
    });
    const inv = await decorateInvoiceWithBalances(sb, invoiceFor(['j1']));
    expect(inv.isPaidInFull).toBe(true);
    expect(inv.balanceOwing).toBe(0); // 0.005 remainder rounds to zero cents
  });

  it('aggregates paid/owing across a multi-job invoice', async () => {
    const sb = stubSupabase({
      jobs: [job('j1', 100), job('j2', 200)],
      payments: [{ id: 'p1', job_id: 'j1', amount: 100, payment_date: '2026-06-01', invoice_id: null }],
    });
    const inv = await decorateInvoiceWithBalances(sb, invoiceFor(['j1', 'j2']));
    expect(inv.amountPaid).toBe(100);
    expect(inv.balanceOwing).toBe(200);
    expect(inv.isPaidInFull).toBe(false); // j2 unpaid
    expect(inv.invoiceJobBalances).toHaveLength(2);
  });

  it('is NOT paid-in-full when a linked job has zero payments even if others are settled', async () => {
    const sb = stubSupabase({
      jobs: [job('j1', 100), job('j2', 0)], // j2 total is 0 but never paid
      payments: [{ id: 'p1', job_id: 'j1', amount: 100, payment_date: '2026-06-01', invoice_id: null }],
    });
    const inv = await decorateInvoiceWithBalances(sb, invoiceFor(['j1', 'j2']));
    expect(inv.isPaidInFull).toBe(false); // paid > 0 required per job
  });

  it('lists the client\'s other unpaid completed jobs as otherOutstanding', async () => {
    const sb = stubSupabase({
      jobs: [job('j1', 100), job('j2', 80), job('j3', 60)],
      payments: [{ id: 'p1', job_id: 'j3', amount: 60, payment_date: '2026-06-01', invoice_id: null }],
    });
    const inv = await decorateInvoiceWithBalances(sb, invoiceFor(['j1']));
    expect(inv.otherOutstanding).toHaveLength(1);
    expect(inv.otherOutstanding[0].job.id).toBe('j2');
    expect(inv.otherOutstanding[0].owing).toBe(80);
    expect(inv.runningTotalOwing).toBe(180); // 100 owing on invoice + 80 elsewhere
  });

  it('surfaces jobs settled through this invoice but not on it as alsoPaid', async () => {
    const sb = stubSupabase({
      jobs: [job('j1', 100), job('j2', 50)],
      payments: [
        { id: 'p1', job_id: 'j1', amount: 100, payment_date: '2026-06-01', invoice_id: 'inv-1' },
        { id: 'p2', job_id: 'j2', amount: 50, payment_date: '2026-06-01', invoice_id: 'inv-1' },
      ],
    });
    const inv = await decorateInvoiceWithBalances(sb, invoiceFor(['j1']));
    expect(inv.isPaidInFull).toBe(true);
    expect(inv.alsoPaid).toHaveLength(1);
    expect(inv.alsoPaid[0].job.id).toBe('j2');
    expect(inv.settlementCount).toBe(2); // both payments tagged with this invoice
    expect(inv.totalPaidAllJobs).toBe(150);
  });

  it('only counts payments for invoice-linked jobs in the payments column', async () => {
    const sb = stubSupabase({
      jobs: [job('j1', 100), job('j2', 50)],
      payments: [
        { id: 'p1', job_id: 'j1', amount: 40, payment_date: '2026-06-01', invoice_id: null },
        { id: 'p2', job_id: 'j2', amount: 50, payment_date: '2026-06-02', invoice_id: null },
      ],
    });
    const inv = await decorateInvoiceWithBalances(sb, invoiceFor(['j1']));
    expect(inv.payments).toHaveLength(1);
    expect(inv.payments[0].id).toBe('p1');
    expect(inv.amountPaid).toBe(40);
    expect(inv.balanceOwing).toBe(60);
  });

  it('respects business tax inheritance when computing job totals', async () => {
    const taxedBiz = { ...BIZ, tax_enabled: true };
    const sb = stubSupabase({ jobs: [job('j1', 100)], payments: [] });
    const inv = await decorateInvoiceWithBalances(
      sb,
      invoiceFor(['j1'], { businesses: taxedBiz })
    );
    expect(inv.balanceOwing).toBe(113); // 100 + 13% HST inherited from business
  });

  it('rounds money to cents (no floating-point drift)', async () => {
    const sb = stubSupabase({
      jobs: [job('j1', 33.33), job('j2', 33.33), job('j3', 33.33)],
      payments: [
        { id: 'p1', job_id: 'j1', amount: 11.11, payment_date: '2026-06-01', invoice_id: null },
        { id: 'p2', job_id: 'j2', amount: 11.11, payment_date: '2026-06-01', invoice_id: null },
      ],
    });
    const inv = await decorateInvoiceWithBalances(sb, invoiceFor(['j1', 'j2', 'j3']));
    expect(inv.amountPaid).toBe(22.22);
    expect(inv.balanceOwing).toBe(77.77);
  });
});

describe('jobPaymentBadge', () => {
  const inv = (balances, isPaidInFull = false) => ({
    isPaidInFull,
    invoiceJobBalances: balances.map(([id, paid, owing]) => ({ job: { id }, paid, owing })),
  });

  it('marks a fully paid job on an open multi-job invoice as paid', () => {
    expect(jobPaymentBadge(inv([['a', 100, 0], ['b', 0, 50]]), 'a')).toEqual({ kind: 'paid', paid: 100, owing: 0 });
  });
  it('marks a partly paid job as partial', () => {
    expect(jobPaymentBadge(inv([['a', 40, 60]]), 'a')).toEqual({ kind: 'partial', paid: 40, owing: 60 });
  });
  it('no badge for an unpaid job', () => {
    expect(jobPaymentBadge(inv([['a', 0, 60]]), 'a')).toBeNull();
  });
  it('no badges on a receipt', () => {
    expect(jobPaymentBadge(inv([['a', 100, 0]], true), 'a')).toBeNull();
  });
  it('no badge for a job not on the invoice', () => {
    expect(jobPaymentBadge(inv([['a', 100, 0]]), 'zzz')).toBeNull();
  });
});

describe('getJobPaymentBadge', () => {
  const inv = (balances, isPaidInFull = false) => ({
    isPaidInFull,
    invoiceJobBalances: balances.map(([id, paid, owing]) => ({ job: { id }, paid, owing })),
  });

  it('marks a fully paid job with "Paid in full ✓"', () => {
    expect(getJobPaymentBadge(inv([['a', 100, 0], ['b', 0, 50]]), 'a')).toEqual({
      kind: 'paid',
      text: 'Paid in full ✓',
      paid: 100,
      owing: 0,
    });
  });

  it('marks a partly paid job with "Paid $X · Owing $Y"', () => {
    expect(getJobPaymentBadge(inv([['a', 40, 60]]), 'a')).toEqual({
      kind: 'partial',
      text: 'Paid $40.00 · Owing $60.00',
      paid: 40,
      owing: 60,
    });
  });

  it('formats decimals to two decimal places', () => {
    expect(getJobPaymentBadge(inv([['a', 42.5, 57.5]]), 'a')).toEqual({
      kind: 'partial',
      text: 'Paid $42.50 · Owing $57.50',
      paid: 42.5,
      owing: 57.5,
    });
  });

  it('shows badge even when invoice is marked paid in full (receipt)', () => {
    expect(getJobPaymentBadge(inv([['a', 100, 0]], true), 'a')).toEqual({
      kind: 'paid',
      text: 'Paid in full ✓',
      paid: 100,
      owing: 0,
    });
  });

  it('returns null for an unpaid job', () => {
    expect(getJobPaymentBadge(inv([['a', 0, 60]]), 'a')).toBeNull();
  });

  it('returns null for a job not on the invoice', () => {
    expect(getJobPaymentBadge(inv([['a', 100, 0]]), 'zzz')).toBeNull();
  });

  it('returns null when invoice is null', () => {
    expect(getJobPaymentBadge(null, 'a')).toBeNull();
  });
});

describe('describeJobCalc', () => {
  it('formats hourly jobs with hours and rate', () => {
    const j = { pricing_type: 'Hourly', actual_duration: 3, flat_rate: 50 };
    expect(describeJobCalc(j)).toBe('3.0 hrs × $50.00/hr');
  });

  it('formats hourly jobs with extras when additionalTotal > 0', () => {
    const j = {
      pricing_type: 'Hourly',
      actual_duration: 3,
      flat_rate: 50,
      additional_costs_json: [{ amount: 10, description: 'Tip' }],
    };
    expect(describeJobCalc(j)).toBe('3.0 hrs × $50.00/hr + $10.00 extras');
  });

  it('formats flat rate jobs without extras', () => {
    const j = { pricing_type: 'Flat', flat_rate: 150 };
    expect(describeJobCalc(j)).toBe('Flat rate');
  });

  it('formats flat rate jobs with extras', () => {
    const j = {
      pricing_type: 'Flat',
      flat_rate: 150,
      additional_costs_json: [{ amount: 25 }],
    };
    expect(describeJobCalc(j)).toBe('Flat rate + $25.00 extras');
  });

  it('guards against null/undefined/missing hours or rate without throwing or NaN', () => {
    expect(describeJobCalc(null)).toBe('');
    expect(describeJobCalc(undefined)).toBe('');

    const emptyJob = {};
    const resEmpty = describeJobCalc(emptyJob);
    expect(resEmpty).not.toContain('NaN');
    expect(resEmpty).toBe('0.0 hrs × $60.00/hr');

    const missingRate = { pricing_type: 'Hourly', actual_duration: 2 };
    const resRate = describeJobCalc(missingRate);
    expect(resRate).not.toContain('NaN');
    expect(resRate).toBe('2.0 hrs × $60.00/hr');

    const nanHours = { pricing_type: 'Hourly', actual_duration: 'abc', flat_rate: 'def' };
    const resNan = describeJobCalc(nanHours);
    expect(resNan).not.toContain('NaN');
    expect(resNan).toBe('0.0 hrs × $60.00/hr');
  });
});

