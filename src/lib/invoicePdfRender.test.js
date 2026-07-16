// Render smoke test for the invoice PDF builder (api/_lib/invoicePdf.ts).
// This pipeline has 500'd in prod twice — every structural change to the
// document tree gets verified by an actual renderToBuffer() run, not by eye.
// The logo is a data URI so the render is hermetic (no network fetch).
import { Buffer } from 'node:buffer';
import { describe, it, expect } from 'vitest';
import { buildInvoicePdfBuffer } from '../../api/_lib/invoicePdf';

// 1x1 transparent PNG
const LOGO_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function makeJob(id, date, time, overrides = {}) {
  return {
    id,
    service_name: 'Decluttering', // deliberately the same name on both jobs
    scheduled_date: date,
    scheduled_time: time,
    pricing_type: 'Hourly',
    flat_rate: 50,
    estimated_hours: 3,
    actual_duration: 3,
    subtotal: 150,
    hst_amount: 19.5,
    total_amount: 169.5,
    additional_costs_json: [],
    tax_enabled: true,
    ...overrides,
  };
}

function makeInvoice() {
  const jobA = makeJob('job-a', '2026-07-02', '09:00:00');
  const jobB = makeJob('job-b', '2026-07-09', '13:30:00');
  return {
    id: 'inv-1',
    invoice_number: '2026-042',
    invoice_date: '2026-07-10',
    due_date: '2026-07-24',
    business_id: 'biz-1',
    isPaidInFull: false,
    balanceOwing: 169.5,
    runningTotalOwing: 169.5,
    businesses: {
      name: 'Supermom for Hire',
      hst_number: '777616178 RT0001',
      email: 'sandra@supermomforhire.com',
      phone: '(416) 738-0309',
      city: 'Georgetown',
      province: 'ON',
      tax_enabled: true,
      logo_url: LOGO_DATA_URI,
    },
    clients: {
      first_name: 'Test',
      last_name: 'Client',
      street: '1 Main St',
      city: 'Georgetown',
      province: 'ON',
      postal_code: 'L7G 1A1',
      phone: '(905) 555-0100',
      email: 'client@example.com',
    },
    invoice_jobs: [{ jobs: jobA }, { jobs: jobB }],
    payments: [
      { id: 'pmt-1', job_id: 'job-a', amount: 169.5, payment_date: '2026-07-03', payment_method: 'e-Transfer' },
    ],
    otherOutstanding: [],
    alsoPaid: [],
  };
}

describe('buildInvoicePdfBuffer', () => {
  it('renders a multi-job invoice (same service name, different dates/times) to a real PDF', async () => {
    const buf = await buildInvoicePdfBuffer(makeInvoice());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }, 30000);

  it('renders a job with no scheduled_time / no duration without crashing', async () => {
    const invoice = makeInvoice();
    invoice.invoice_jobs = [
      { jobs: makeJob('job-c', '2026-07-05', null, { actual_duration: null, estimated_hours: null }) },
    ];
    invoice.payments = [];
    const buf = await buildInvoicePdfBuffer(invoice);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }, 30000);
});
