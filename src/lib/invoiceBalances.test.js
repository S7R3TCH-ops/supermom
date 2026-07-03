import { describe, it, expect } from 'vitest';
import { decorateInvoiceWithBalances } from './invoiceBalances';

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
